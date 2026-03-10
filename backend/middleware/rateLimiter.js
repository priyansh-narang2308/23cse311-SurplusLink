import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter to prevent DDoS and brute force.
 * 100 requests per 15 minutes.
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 2000, // Massively increased for multi-user stability
    message: {
        message: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

/**
 * stricter limiter for Auth routes
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 1000 : 10,
    message: {
        message: 'Too many authentication attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

/**
 * Limiter for Donation creation
 */
export const donationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 500 : 5,
    message: {
        message: 'Daily donation limit reached for this window, please wait.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});

export const deliveryStatusLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 100 : 5,
    message: {
        message: 'Too many status updates from this IP, please try again after a minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test'
});
