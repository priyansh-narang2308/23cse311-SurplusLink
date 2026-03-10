import mongoose from 'mongoose';

/**
 * @model ImpactRule
 * @description Stores conversion factors and sustainability rules for impact calculations.
 *              Allows administrators to tune the "Impact Engine" (US 7.1, 7.2).
 */
const impactRuleSchema = new mongoose.Schema(
    {
        ruleName: {
            type: String,
            required: true,
            unique: true,
            enum: ['meal_conversion', 'co2_conversion', 'credit_multiplier']
        },
        factor: {
            type: Number,
            required: true,
            default: 1.0
        },
        unit: {
            type: String,
            required: true
        },
        description: {
            type: String
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    {
        timestamps: true,
    }
);

const ImpactRule = mongoose.model('ImpactRule', impactRuleSchema);

export default ImpactRule;
