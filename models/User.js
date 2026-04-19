const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student', 'recruiter'], required: true },
  company: { type: String }, // for recruiters
  dob: { type: Date }, // date of birth for age calculation
  createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

// Auto-generate studentId for students
userSchema.pre('save', async function(next) {
  if (this.role === 'student' && !this.studentId) {
    const count = await mongoose.model('User').countDocuments({ role: 'student' });
    this.studentId = 'STU' + String(count + 1).padStart(4, '0');
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
