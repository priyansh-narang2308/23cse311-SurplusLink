/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import NotificationService from '@/services/notification.service';
import { useAuth } from './auth-context';

interface Notification {
    id: string; 
    _id: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
    relatedDonation?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAllRead: () => Promise<void>;
    refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const data = await NotificationService.getNotifications();
            setNotifications(data);
            setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
        } catch (error) {
            // Silent fail
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 60000); // Increased to 60s poll
            return () => clearInterval(interval);
        }
    }, [user, fetchNotifications]);

    const markAllRead = async () => {
        if (unreadCount === 0) return;
        try {
            await NotificationService.markAsRead();
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, markAllRead, refresh: fetchNotifications }}>
            {children}
        </NotificationContext.Provider>
    );
}

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
};
