import { UserRole, User } from '@/types';
import api from '@/lib/api';

const AUTH_KEY = 'surpluslink_auth';

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  role: UserRole | null;
  token: string | null;
}

export const getAuthState = (): AuthState => {
  try {
    const stored = localStorage.getItem(AUTH_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse auth state');
  }
  return { isAuthenticated: false, user: null, role: null, token: null };
};

export const setAuthData = (user: User) => {
  const authState: AuthState = {
    isAuthenticated: true,
    user,
    role: user.role as UserRole,
    token: (user as any).token || null,
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(authState));
  return authState;
};

export const logout = (): void => {
  localStorage.removeItem(AUTH_KEY);
};

export const isAuthorized = (requiredRole: UserRole): boolean => {
  const { isAuthenticated, role } = getAuthState();
  return isAuthenticated && role === requiredRole;
};

export const getProfile = async (): Promise<User> => {
  const response = await api.get('/users/profile');
  return response.data;
};
