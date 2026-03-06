import mongoose from 'mongoose';
import Notification from '../models/Notification.model.js';
import User from '../models/User.model.js';
import { t } from './i18n.js';
import { publishToQueue, consumeFromQueue } from './rabbitmq.js';

/**
 * Internal worker function that actually performs the DB operations.
 */
const processNotificationInternal = async (data) => {
    const { recipientId, message, type, relatedDonationId, params } = data;
    try {
        if (!recipientId || !mongoose.Types.ObjectId.isValid(recipientId)) {
            return null;
        }

        const user = await User.findById(recipientId).select('language notificationPreferences role');
        if (!user) return null;

        const lang = user.language || 'en';
        const prefs = user.notificationPreferences || { enabled: true, channels: { push: true, email: true }, types: { donations: true, missions: true, reminders: true } };

        if (prefs.enabled === false) return null;

        const typeMapping = {
            'donation_created': user.role === 'ngo' ? 'missions' : 'donations',
            'donation_cancelled': 'donations',
            'donation_completed': 'donations',
            'donation_assigned': 'donations',
            'donation_rejected': 'donations',
            'donation_picked_up': 'donations',
            'donation_delivered': 'donations',
            'donation_expired': 'reminders',
            'volunteer_accepted': 'missions',
            'priority_dispatch': 'missions',
            'mission_reassigned': 'missions',
            'mission_delayed': 'reminders',
            'mission_nudge': 'reminders',
            'level_up': 'missions',
            'general': 'donations'
        };

        const prefCategory = typeMapping[type] || 'donations';
        if (prefs.types && prefs.types[prefCategory] === false) return null;

        if (prefs.channels && prefs.channels.push === false) return null;

        const translatedMessage = t(lang, message, params);

        return await Notification.create({
            recipient: recipientId,
            message: translatedMessage,
            type,
            relatedDonation: relatedDonationId,
        });
    } catch (error) {
        console.error('Error processing notification in worker:', error);
    }
};

/**
 * Public function to trigger a notification. 
 * Now offloads to RabbitMQ for high-load resilience.
 */
export const createNotification = async (recipientId, message, type, relatedDonationId = null, params = {}) => {
    const data = { recipientId, message, type, relatedDonationId, params };

    // Attempt to publish to queue
    const queued = await publishToQueue(data);

    if (!queued) {
        // Graceful Degradation: Fallback to synchronous processing if RabbitMQ is down
        console.warn('[Notification] RabbitMQ offline. Falling back to sync processing.');
        return await processNotificationInternal(data);
    }

    return { status: 'queued' };
};

/**
 * Initializes the notification consumer worker.
 */
export const initNotificationWorker = () => {
    console.log('🤖 Notification Worker started...');
    consumeFromQueue(async (data) => {
        await processNotificationInternal(data);
    });
};
