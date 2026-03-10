import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter - effectively disabled for unrestricted testing
 */
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000, // Effectively unlimited
    message: {
        message: 'Too many requests from this IP'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true // Skip limiting
});

/**
 * stricter limiter for Auth routes - effectively disabled
 */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10000, // Effectively unlimited
    message: {
        message: 'Too many authentication attempts'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true // Skip limiting
});

/**
 * Limiter for Donation creation - effectively disabled
 */
export const donationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10000, // Effectively unlimited
    message: {
        message: 'Daily donation limit reached'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true // Skip limiting
});

export const deliveryStatusLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10000, // Effectively unlimited
    message: {
        message: 'Too many status updates'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => true // Skip limiting
});
