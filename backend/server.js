import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import connectDB from './config/db.js';
import { notFound, errorHandler } from './middleware/error.middleware.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { connectRabbitMQ } from './utils/rabbitmq.js';
import { initNotificationWorker } from './utils/notification.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import donationRoutes from './routes/donation.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import reportRoutes from './routes/report.routes.js';
import adminRoutes from './routes/admin.routes.js';


dotenv.config({ path: './.env' });

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(globalLimiter); // Apply US 9.1 Global Rate Limiting

const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://surpluslink.vercel.app",
    process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Debug Middleware for CORS/Networking
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    next();
});

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to SurplusLink API v1' });
});

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/donations', donationRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/admin', adminRoutes);


// Error Handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    try {
        await connectDB();

        // US 9.1: RabbitMQ Connection & Worker Init
        if (process.env.NODE_ENV !== 'test') {
            await connectRabbitMQ();
            initNotificationWorker();
        }

        app.listen(PORT, () => {
            console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port: ${PORT}`);
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    process.exit(1);
});

import setupCronJobs from './utils/cron.js';

if (process.env.NODE_ENV !== 'test') {
    startServer();
    // Start Cron Jobs
    setupCronJobs();
}

export default app;
