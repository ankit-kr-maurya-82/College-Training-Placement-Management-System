import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
    companyName: {
        type: String,
        required: true,
    },
    hrName: {
        type: String,
        required: true,
    },
    hrEmail: {
        type: String,
        required: true,
        unique: true,
    },
    hrPassword: {
        type: String,
        required: true,
    },
    hrPhoneNumber: {
        type: String,
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
    website: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true, 
    },
}, {timestamps: true});

export const Company = mongoose.model('Company', companySchema);