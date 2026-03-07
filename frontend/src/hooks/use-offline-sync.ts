import { useState, useEffect, useCallback } from 'react';
import { getQueuedActions, removeQueuedAction } from '@/lib/offline-storage';
import api from '@/lib/api';
import { toast } from '@/hooks/use-toast';

export const useOfflineSync = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);

    const syncActions = useCallback(async () => {
        const actions = await getQueuedActions();
        if (actions.length === 0 || isSyncing) return;

        setIsSyncing(true);
        try {
            const bulkData = actions.map(a => ({
                type: a.type,
                data: a.data,
                syncKey: a.syncKey,
                clientUpdatedAt: a.timestamp
            }));

            const response = await api.post('/sync/bulk', { actions: bulkData });
            const syncedKeys = response.data.success.map((s: { syncKey: string }) => s.syncKey);

            for (const action of actions) {
                if (syncedKeys.includes(action.syncKey)) {
                    await removeQueuedAction(action.id!);
                }
            }

            if (syncedKeys.length > 0) {
                toast({
                    title: 'System Synced',
                    description: `${syncedKeys.length} actions uploaded.`,
                });
            }
        } catch (error) {
            console.error('[OfflineSync] Sync failed:', error);
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing]);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            syncActions();
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        if (navigator.onLine) {
            syncActions();
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncActions]);

    return { isOnline, isSyncing };
};
