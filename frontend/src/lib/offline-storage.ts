import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'SurplusLinkOffline';
const STORE_NAME = 'queued_actions';
const CACHE_STORE = 'cached_data';
const DB_VERSION = 1;

interface QueuedAction {
    id?: number;
    type: string;
    data: any;
    endpoint: string;
    method: string;
    timestamp: string;
    syncKey: string;
}

export const initDB = async (): Promise<IDBPDatabase> => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
            if (!db.objectStoreNames.contains(CACHE_STORE)) {
                db.createObjectStore(CACHE_STORE, { keyPath: 'endpoint' });
            }
        },
    });
};

export const queueAction = async (action: Omit<QueuedAction, 'id'>) => {
    const db = await initDB();
    return db.add(STORE_NAME, action);
};

export const getQueuedActions = async (): Promise<QueuedAction[]> => {
    const db = await initDB();
    return db.getAll(STORE_NAME);
};

export const removeQueuedAction = async (id: number) => {
    const db = await initDB();
    return db.delete(STORE_NAME, id);
};

export const cacheData = async (endpoint: string, data: any) => {
    const db = await initDB();
    return db.put(CACHE_STORE, { endpoint, data, timestamp: new Date().toISOString() });
};

export const getCachedData = async (endpoint: string) => {
    const db = await initDB();
    const result = await db.get(CACHE_STORE, endpoint);
    return result?.data;
};
