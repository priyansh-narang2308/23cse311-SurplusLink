import request from 'supertest';
import User from '../models/User.model.js';
import Donation from '../models/Donation.model.js';
import { connect, disconnect, clearDatabase } from './setup.js';

describe('Volunteer Performance Report Tests', () => {
    let app;
    let adminToken, adminId;
    let volunteerId;

    beforeAll(async () => {
        app = (await import('../server.js')).default;
        await connect();
    });

    afterAll(async () => {
        await disconnect();
    });

    beforeEach(async () => {
        await clearDatabase();

        // 1. Setup Admin
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@test.com',
            password: 'password123',
            role: 'admin',
            isVerified: true
        });
        adminId = admin._id;

        const adminLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'admin@test.com',
            password: 'password123'
        });
        adminToken = adminLogin.headers['set-cookie'][0];

        // 2. Setup Volunteer
        const volunteer = await User.create({
            name: 'Alex Johnson',
            email: 'alex@test.com',
            password: 'password123',
            role: 'volunteer',
            isOnline: true,
            volunteerProfile: {
                tier: 'champion',
                vehicleType: 'scooter',
                currentLocation: { type: 'Point', coordinates: [100.0, 20.0] }
            }
        });
        volunteerId = volunteer._id;

        // 3. Setup Missions for Alex
        // Completed Mission (Proof Compliant)
        await Donation.create({
            title: 'Mission 1',
            description: 'Desc',
            foodType: 'Type',
            perishability: 'low',
            donor: adminId,
            coordinates: { type: 'Point', coordinates: [0.1, 0.1] },
            pickupAddress: 'A',
            quantity: '10kg',
            expiryDate: new Date(Date.now() + 3600000),
            pickupWindow: { start: new Date(), end: new Date() },
            status: 'completed',
            volunteer: volunteerId,
            pickedUpAt: new Date(Date.now() - 3600000),
            deliveredAt: new Date(Date.now() - 1800000), // 30 mins later
            pickupPhoto: 'pickup.jpg',
            deliveryPhoto: 'delivery.jpg'
        });

        // Current Active Mission
        await Donation.create({
            title: 'Mission 2',
            description: 'Desc',
            foodType: 'Type',
            perishability: 'low',
            donor: adminId,
            coordinates: { type: 'Point', coordinates: [0.1, 0.1] },
            pickupAddress: 'A',
            quantity: '10kg',
            expiryDate: new Date(Date.now() + 3600000),
            pickupWindow: { start: new Date(), end: new Date() },
            status: 'picked_up',
            volunteer: volunteerId
        });
    });

    it('should return volunteer performance data for admin', async () => {
        const res = await request(app)
            .get('/api/v1/reports/volunteer-performance')
            .set('Cookie', [adminToken]);

        expect(res.statusCode).toBe(200);
        expect(res.body).toBeInstanceOf(Array);

        const alex = res.body.find(v => v.name === 'Alex Johnson');
        expect(alex).toBeDefined();
        expect(alex.stats.totalMissions).toBe(2);
        expect(alex.stats.completed).toBe(1);
        expect(alex.stats.avgDeliveryTime).toBe('30 mins');
        expect(alex.stats.proofCompliance).toBe('100%');
        expect(alex.profile.status).toBe('On Route');
        expect(alex.profile.isOnline).toBe(true);
        expect(alex.profile.tier).toBe('Champion');
        expect(alex.history.length).toBeGreaterThan(0);
        expect(alex.history[0].missions).toBe(2);
    });

    it('should filter by individual volunteerId', async () => {
        const res = await request(app)
            .get(`/api/v1/reports/volunteer-performance?volunteerId=${volunteerId}`)
            .set('Cookie', [adminToken]);

        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].volunteerId).toBe(volunteerId.toString());
    });

    it('should forbid access for non-admin users', async () => {
        // Setup a non-admin (e.g., volunteer themselves)
        const volLogin = await request(app).post('/api/v1/auth/login').send({
            email: 'alex@test.com',
            password: 'password123'
        });
        const volToken = volLogin.headers['set-cookie'][0];

        const res = await request(app)
            .get('/api/v1/reports/volunteer-performance')
            .set('Cookie', [volToken]);

        expect(res.statusCode).toBe(401);
    });
});
