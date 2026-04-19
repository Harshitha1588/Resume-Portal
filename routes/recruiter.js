const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Resume = require('../models/Resume');
const Project = require('../models/Project');

// Auth middleware
const isRecruiter = (req, res, next) => {
  if (!req.session.userId || req.session.role !== 'recruiter')
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

// Search student by Student ID
router.get('/search/:studentId', isRecruiter, async (req, res) => {
  try {
    const student = await User.findOne({
      studentId: req.params.studentId.toUpperCase(),
      role: 'student'
    }).select('-password');

    if (!student) return res.json({ success: false, message: 'No student found with this ID' });

    const resume = await Resume.findOne({ userId: student._id });
    const projects = await Project.find({ userId: student._id }).sort({ createdAt: -1 });

    res.json({ success: true, student, resume, projects });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Search students by skill (basic)
router.get('/search-by-skill', isRecruiter, async (req, res) => {
  try {
    const { skill } = req.query;
    if (!skill) return res.json({ success: false, message: 'Provide a skill to search' });

    const resumes = await Resume.find({
      skills: { $regex: skill, $options: 'i' }
    }).populate('userId', 'name email studentId dob');

    const results = resumes.map(r => ({
      student: r.userId,
      skills: r.skills,
      degree: r.degree,
      college: r.college
    }));

    res.json({ success: true, results });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Advanced search: skill + age group filter
router.get('/search-advanced', isRecruiter, async (req, res) => {
  try {
    const { skill, minAge, maxAge, degree, graduationYear } = req.query;

    // Build resume filter
    const resumeFilter = {};
    if (skill) resumeFilter.skills = { $regex: skill, $options: 'i' };
    if (degree) resumeFilter.degree = { $regex: degree, $options: 'i' };
    if (graduationYear) resumeFilter.graduationYear = graduationYear;

    // Get all matching resumes with user info
    const resumes = await Resume.find(resumeFilter).populate('userId', 'name email studentId dob');

    // Filter by age if provided
    let results = resumes
      .filter(r => r.userId) // skip if user deleted
      .map(r => {
        const user = r.userId;
        let age = null;
        if (user.dob) {
          const today = new Date();
          const birth = new Date(user.dob);
          age = today.getFullYear() - birth.getFullYear();
          const m = today.getMonth() - birth.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        }
        return {
          student: { _id: user._id, name: user.name, email: user.email, studentId: user.studentId, dob: user.dob },
          age,
          skills: r.skills,
          degree: r.degree,
          branch: r.branch,
          college: r.college,
          graduationYear: r.graduationYear,
          cgpa: r.cgpa
        };
      });

    // Apply age filters
    if (minAge) results = results.filter(r => r.age !== null && r.age >= parseInt(minAge));
    if (maxAge) results = results.filter(r => r.age !== null && r.age <= parseInt(maxAge));

    res.json({ success: true, count: results.length, results });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Get recruiter info
router.get('/me', isRecruiter, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
