import mongoose from "mongoose"
import dotenv from "dotenv"
import bcrypt from "bcryptjs"

// Load env vars
dotenv.config();

// Explicitly connect to the correct database
const DB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/surpluslink';

// Define the User schema directly here to prevent relative import path issues
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['donor', 'ngo', 'volunteer', 'admin'], default: 'donor' },
    organization: { type: String },
    status: { type: String, enum: ['pending', 'active', 'rejected'], default: 'pending' },
    isEmailVerified: { type: Boolean, default: false }
});

const User = mongoose.model('User', userSchema);

const seedTestAccounts = async () => {
    try {
        console.log(`Connecting to MongoDB at: ${DB_URI}`);
        await mongoose.connect(DB_URI);
        console.log('✅ Connected to Database...');

        await User.deleteMany({ email: { $in: ['donor@test.com', 'ngo@test.com'] } });
        console.log('🧹 Cleared old test accounts...');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);

        await User.insertMany([
            {
                name: 'Test Donor',
                email: 'donor@test.com',
                password: hashedPassword,
                role: 'donor',
                organization: 'E2E Testing Bakery',
                status: 'active', // IMPORTANT: Bypasses admin approval!
                isEmailVerified: true
            },
            {
                name: 'Test NGO',
                email: 'ngo@test.com',
                password: hashedPassword,
                role: 'ngo',
                organization: 'E2E Shelter',
                status: 'active', // IMPORTANT: Bypasses admin approval!
                isEmailVerified: true
            }
        ]);

        console.log('🌱 Successfully seeded E2E Test Accounts:');
        console.log('   - donor@test.com / password123');
        console.log('   - ngo@test.com / password123');
        process.exit();
    } catch (error) {
        console.error('❌ Error Seeding Data:', error);
        process.exit(1);
    }
};

seedTestAccounts();
