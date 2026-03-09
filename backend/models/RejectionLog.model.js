import mongoose from 'mongoose';

const rejectionLogSchema = new mongoose.Schema(
    {
        donationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Donation',
            required: true,
        },
        ngoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        rejectionReason: {
            type: String,
            required: true,
        },
        isSafetyIssue: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const RejectionLog = mongoose.model('RejectionLog', rejectionLogSchema);
export default RejectionLog;
