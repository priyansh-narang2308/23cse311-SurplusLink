import axios from 'axios';
import { queueAction, getCachedData, cacheData } from './offline-storage';
import { toast } from '@/hooks/use-toast';
import { getAuthState } from '@/utils/auth';

const getBaseURL = () => {
  return import.meta.env.VITE_API_BASE_URL || "https://surpluslink-9fq6.onrender.com/api/v1";
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true,
});

api.interceptors.request.use(async (config) => {
  // Add Authorization header
  const { token } = getAuthState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (!navigator.onLine && (config.method !== 'get')) {
    const syncKey = `${config.method}-${config.url}-${Date.now()}`;
    let type = 'UPDATE_STATUS';
    if (config.url === '/donations' && config.method === 'post') type = 'CREATE_DONATION';

    await queueAction({
      type,
      data: config.data,
      endpoint: config.url || '',
      method: config.method || 'post',
      timestamp: new Date().toISOString(),
      syncKey
    });

    toast({
      title: 'Offline',
      description: 'Action queued.',
    });

    return Promise.reject({ isOffline: true });
  }
  return config;
});

api.interceptors.response.use(
  async (response) => {
    if (response.config.method === 'get' && response.config.url) {
      await cacheData(response.config.url, response.data);
    }
    return response;
  },
  async (error) => {
    if (!navigator.onLine || error.message === 'Network Error') {
      if (error.config?.method === 'get' && error.config.url) {
        const cached = await getCachedData(error.config.url);
        if (cached) {
          return { data: cached, status: 200, statusText: 'OK', headers: {}, config: error.config };
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
