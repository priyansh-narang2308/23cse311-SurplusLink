import mongoose from 'mongoose';

const SystemConfigSchema = new mongoose.Schema({
    emergencyMode: {
        enabled: {
            type: Boolean,
            default: false
        },
        activatedAt: Date,
        activatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: String,
        affectedZones: [String], // Array of regions or coordinates
        priorityRadius: {
            type: Number,
            default: 10 // km
        }
    },
    broadcastMessage: {
        text: String,
        active: {
            type: Boolean,
            default: false
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }
}, { timestamps: true });

const SystemConfig = mongoose.model('SystemConfig', SystemConfigSchema);

export default SystemConfig;
