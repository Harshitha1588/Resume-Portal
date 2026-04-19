const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Personal Details
  phone: String,
  address: String,
  linkedin: String,
  github: String,
  portfolio: String,
  // Academic Details
  degree: String,
  branch: String,
  college: String,
  graduationYear: String,
  cgpa: String,
  // Skills
  skills: [String],
  // Experience
  experience: [{
    company: String,
    role: String,
    duration: String,
    description: String
  }],
  // Certifications
  certifications: [{ name: String, issuer: String, year: String }],
  // Resume PDF
  resumeFile: String,
  resumeFileName: String,
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Resume', resumeSchema);
