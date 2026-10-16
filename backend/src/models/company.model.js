import mongoose from "mongoose";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlPattern = /^https?:\/\/.+/i;

const companySchema = new mongoose.Schema({
    // `name` is the public directory field. `companyName` and the HR fields
    // remain for the existing company registration/login API.
    name: { type: String, required: true, trim: true },
    companyName: { type: String, trim: true },
    description: { type: String, trim: true },
    website: { type: String, trim: true, validate: { validator: (value) => !value || urlPattern.test(value), message: "Website must be a valid URL" } },
    location: { type: String, required: true, trim: true },
    industry: { type: String, required: true, trim: true },
    hrEmail: { type: String, trim: true, lowercase: true, unique: true, sparse: true, validate: { validator: (value) => !value || emailPattern.test(value), message: "HR email must be valid" } },
    hrName: { type: String, trim: true },
    hrPassword: { type: String },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    hrPhoneNumber: { type: String, trim: true },
    hrContact: { type: String, trim: true },
    logo: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // Missing values on legacy documents are treated as verified by login handlers.
    isEmailVerified: { type: Boolean, default: false, index: true },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

companySchema.pre("validate", function () {
    // Keep old company registration records valid while exposing the new name field.
    if (!this.name && this.companyName) this.name = this.companyName;
    if (!this.companyName && this.name) this.companyName = this.name;
    if (!this.industry && this.companyName) this.industry = "Other";
});
companySchema.index({ name: "text", description: "text", industry: "text", location: "text" });

export const Company = mongoose.models.Company || mongoose.model("Company", companySchema);
export default Company;
