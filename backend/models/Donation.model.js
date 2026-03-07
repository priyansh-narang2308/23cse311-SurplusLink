import mongoose from 'mongoose';

const donationSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        foodType: {
            type: String,
            required: true,
        },
        quantity: {
            type: String,
            required: true,
        },
        expiryDate: {
            type: Date,
            required: true,
        },
        perishability: {
            type: String,
            enum: ['high', 'medium', 'low'],
            required: true,
        },
        photos: [
            {
                type: String,
            },
        ],
        pickupWindow: {
            start: {
                type: Date,
                required: true,
            },
            end: {
                type: Date,
                required: true,
            },
        },
        pickupAddress: {
            type: String,
            required: true,
        },
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point',
            },
            coordinates: {
                type: [Number],
                required: true,
            },
        },
        allergens: [
            {
                type: String,
            },
        ],
        dietaryTags: [
            {
                type: String,
            },
        ],
        donor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['active', 'assigned', 'picked_up', 'completed', 'cancelled', 'expired', 'rejected'],
            default: 'active',
        },
        verificationStatus: {
            type: String,
            enum: ['pending', 'verified', 'failed'],
            default: 'pending',
        },
        foodCategory: {
            type: String,
            enum: ['cooked', 'raw', 'packaged'],
        },
        storageReq: {
            type: String,
            enum: ['cold', 'dry', 'frozen'],
        },
        claimedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        claimedAt: {
            type: Date,
        },
        rejectionReason: {
            type: String,
        },
        feedback: {
            rating: { type: Number, min: 1, max: 5 },
            comment: { type: String },
        },
        volunteer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        deliveryStatus: {
            type: String,
            enum: ['idle', 'pending_pickup', 'heading_to_pickup', 'at_pickup', 'picked_up', 'in_transit', 'arrived_at_delivery', 'delivered'],
            default: 'idle',
        },
        pickupPhoto: {
            type: String,
        },
        deliveryPhoto: {
            type: String,
        },
        pickupNotes: {
            type: String,
        },
        deliveryNotes: {
            type: String,
        },
        pickedUpAt: {
            type: Date,
        },
        deliveredAt: {
            type: Date,
        },
        dispatchedTo: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        dispatchedAt: {
            type: Date,
        },
        estimatedArrivalAt: {
            type: Date,
        },
        syncKey: {
            type: String,
            unique: true,
            sparse: true, // Only for records created/updated offline
        },
        clientUpdatedAt: {
            type: Date,
        },
        statusHistory: [
            {
                status: String,
                deliveryStatus: String,
                timestamp: { type: Date, default: Date.now },
                updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                note: String,
            },
        ],
        azureAiDetection: {
            foodName: String,
            tags: [String],
            confidence: Number,
        },
    },
    {
        timestamps: true,
    }
);

// Index for GeoJSON queries

donationSchema.virtual('coordinatesObj').get(function () {
    if (this.coordinates && this.coordinates.coordinates) {
        return {
            lat: this.coordinates.coordinates[1],
            lng: this.coordinates.coordinates[0]
        };
    }
    return undefined;
});

donationSchema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform: function (doc, ret) {
        ret.id = ret._id;

        // Add coordinates in {lat, lng} format for frontend ease
        if (doc.coordinates && doc.coordinates.coordinates) {
            ret.coordinates = {
                lat: doc.coordinates.coordinates[1],
                lng: doc.coordinates.coordinates[0]
            };
        }

        // Handle populated donor location if needed
        if (doc.donor && doc.donor.coordinates) {
            ret.donorCoordinates = doc.donor.coordinates;
        }

        // Handle populated claimedBy (NGO) location
        if (doc.claimedBy && doc.claimedBy.coordinates) {
            ret.ngoCoordinates = doc.claimedBy.coordinates;
        }

        delete ret._id;
    },
});

// Index for GeoJSON queries
donationSchema.index({ coordinates: '2dsphere' });

donationSchema.methods.addStatusHistory = function (userId, note = '') {
    this.statusHistory.push({
        status: this.status,
        deliveryStatus: this.deliveryStatus,
        updatedBy: userId,
        note,
    });
};

const Donation = mongoose.model('Donation', donationSchema);

export default Donation;
