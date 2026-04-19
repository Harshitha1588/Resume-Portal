const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Project = require('../models/Project');

// Auth middleware
const isStudent = (req, res, next) => {
  if (!req.session.userId || req.session.role !== 'student')
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  next();
};

// Multer setup for resume PDF
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/resumes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `resume_${req.session.userId}_${Date.now()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Get student dashboard data
router.get('/dashboard', isStudent, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password');
    const resume = await Resume.findOne({ userId: req.session.userId });
    const projects = await Project.find({ userId: req.session.userId }).sort({ createdAt: -1 });
    res.json({ success: true, user, resume, projects });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Save/Update resume details
router.post('/resume', isStudent, async (req, res) => {
  try {
    const { phone, dob, address, linkedin, github, portfolio,
            degree, branch, college, graduationYear, cgpa,
            skills, experience, certifications } = req.body;

    // Save DOB to User model
    if (dob) {
      await User.findByIdAndUpdate(req.session.userId, { dob: new Date(dob) });
    }

    let resume = await Resume.findOne({ userId: req.session.userId });
    const data = {
      phone, address, linkedin, github, portfolio,
      degree, branch, college, graduationYear, cgpa,
      skills: Array.isArray(skills) ? skills : (skills ? skills.split(',').map(s => s.trim()) : []),
      experience: experience || [],
      certifications: certifications || [],
      updatedAt: new Date()
    };

    if (resume) {
      Object.assign(resume, data);
      await resume.save();
    } else {
      resume = await Resume.create({ userId: req.session.userId, ...data });
    }

    // Return updated user with dob
    const user = await User.findById(req.session.userId).select('-password');
    res.json({ success: true, message: 'Resume details saved!', resume, user });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Upload resume PDF
router.post('/resume/upload', isStudent, upload.single('resumeFile'), async (req, res) => {
  try {
    if (!req.file) return res.json({ success: false, message: 'No file uploaded' });

    let resume = await Resume.findOne({ userId: req.session.userId });
    if (resume) {
      resume.resumeFile = req.file.filename;
      resume.resumeFileName = req.file.originalname;
      await resume.save();
    } else {
      resume = await Resume.create({
        userId: req.session.userId,
        resumeFile: req.file.filename,
        resumeFileName: req.file.originalname
      });
    }

    res.json({ success: true, message: 'Resume uploaded!', filename: req.file.filename, originalName: req.file.originalname });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Parse resume PDF locally using pdf-parse (no API needed)
router.post('/resume/parse', isStudent, async (req, res) => {
  try {
    const resume = await Resume.findOne({ userId: req.session.userId });
    if (!resume || !resume.resumeFile) {
      return res.json({ success: false, message: 'No resume PDF uploaded yet. Please upload your resume first.' });
    }

    const pdfPath = path.join(__dirname, '../uploads/resumes', resume.resumeFile);
    if (!fs.existsSync(pdfPath)) {
      return res.json({ success: false, message: 'Resume file not found on server.' });
    }

    const pdfParse = require('pdf-parse');
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(pdfBuffer);
    const text = pdfData.text || '';

    const find = (patterns) => {
      for (const pat of patterns) {
        const m = text.match(pat);
        if (m && m[1] && m[1].trim()) return m[1].trim();
      }
      return '';
    };

    // Phone
    const phone = find([
      /(?:phone|mobile|contact|ph|cell)[^\d]*([\+\d][\d\s\-().]{8,14}\d)/i,
      /((?:\+91[\s\-]?)?[6-9]\d{9})/,
      /(\+?[\d][\d\s\-().]{9,14}\d)/
    ]);

    // LinkedIn
    const linkedinMatch = text.match(/linkedin\.com\/in\/([\w\-]+)/i);
    const linkedin = linkedinMatch ? 'linkedin.com/in/' + linkedinMatch[1] : (text.match(/linkedin\.com[^\s]*/i) || [])[0] || '';

    // GitHub
    const githubMatch = text.match(/github\.com\/([\w\-]+)/i);
    const github = githubMatch ? 'github.com/' + githubMatch[1] : (text.match(/github\.com[^\s]*/i) || [])[0] || '';

    // Portfolio
    const portfolio = find([
      /(?:portfolio|website)[^\n:]*[:\s]+(https?:\/\/[^\s]+)/i,
      /(https?:\/\/(?!linkedin|github)[^\s]{5,})/i
    ]);

    // Degree
    const degreeMatch = text.match(/\b(B\.?Tech|B\.?E\.?|M\.?Tech|MBA|B\.?Sc|M\.?Sc|Ph\.?D|B\.?Com|MCA|BCA)\b/i);
    const degree = degreeMatch ? degreeMatch[1] : '';

    // Branch
    const branch = find([
      /(?:branch|specialization|department)[^\n:]*[:\s]+([A-Za-z\s&]+?)(?:\n|,|;|\(|$)/i,
      /(?:B\.?Tech|B\.?E|M\.?Tech)[^\n]*(?:in|in\s+)[:\s]*([A-Za-z\s&]+?)(?:\n|,|\(|$)/i
    ]) || (text.match(/\b(Computer Science|Information Technology|Electronics|Electrical|Mechanical|Civil|Data Science|Artificial Intelligence|CSE|ECE|EEE|IT)\b/i) || [])[0] || '';

    // College
    const collegeMatch = text.match(/([A-Z][A-Za-z\s]+(?:University|Institute of Technology|College|School|Academy|IIT|NIT|BITS)[A-Za-z\s,]*)/);
    const college = collegeMatch ? collegeMatch[1].replace(/\s+/g, ' ').trim().substring(0, 100) : '';

    // Graduation Year
    const yearMatch = text.match(/(?:graduation|graduating|pass(?:ing|ed)|batch|class of)[^\d]*(\d{4})/i)
      || text.match(/(\d{4})\s*[-–]\s*(?:present|current)/i)
      || text.match(/\b(20\d{2})\b(?!.*\b(19|18)\d{2}\b)/);
    const graduationYear = yearMatch ? yearMatch[1] : '';

    // CGPA
    const cgpa = find([
      /(?:cgpa|gpa|cpi)[^\d]*([\d.]+)/i,
      /([\d.]+)\s*\/\s*10/,
      /(?:percentage)[^\d]*([\d.]+)/i
    ]);

    // Skills
    let skills = [];
    const skillsSection = text.match(/(?:skills?|technical skills?|technologies|tools)[^\n]*\n([\s\S]{0,800})(?=\n(?:[A-Z][A-Z\s]{3,}:|\n))/i);
    if (skillsSection) {
      skills = skillsSection[1].split(/[,|\n•\-\/\\]+/)
        .map(s => s.trim())
        .filter(s => s.length > 1 && s.length < 40 && /[a-zA-Z]/.test(s));
    }
    if (skills.length === 0) {
      const techKeywords = ['Python','Java','JavaScript','TypeScript','C++','C#','Ruby','PHP','Swift',
        'Kotlin','Go','HTML','CSS','React','Angular','Vue','Node.js','Express','Django','Flask',
        'Spring','MongoDB','MySQL','PostgreSQL','SQLite','Redis','Docker','Kubernetes','AWS',
        'Azure','GCP','Git','Linux','REST','GraphQL','TensorFlow','PyTorch','Pandas','NumPy',
        'R','MATLAB','Figma','Tableau','Power BI','Excel','Scikit-learn'];
      skills = techKeywords.filter(k => new RegExp('\\b' + k.replace('.', '\\.').replace('+', '\\+') + '\\b', 'i').test(text));
    }

    // Experience
    let experience = [];
    const expSection = text.match(/(?:experience|internship|employment|work)[^\n]*\n([\s\S]{0,1500})(?=\n(?:education|skills?|projects?|certif)|$)/i);
    if (expSection) {
      const blocks = expSection[1].split(/\n(?=[A-Z][a-z])/);
      for (const block of blocks.slice(0, 5)) {
        const bLines = block.split('\n').map(l => l.trim()).filter(Boolean);
        if (bLines.length < 1) continue;
        const durMatch = block.match(/(\w+\s+\d{4})\s*[-–to]+\s*(\w+\s+\d{4}|present|current)/i);
        const company = bLines[0].replace(/[•\-–|]/, '').trim();
        const role = bLines[1] && bLines[1].length < 80 && !bLines[1].match(/^\d/) ? bLines[1] : '';
        if (company.length > 2 && company.length < 100)
          experience.push({ company, role, duration: durMatch ? durMatch[0] : '', description: bLines.slice(2).join(' ').substring(0, 200) });
      }
    }

    // Certifications
    let certifications = [];
    const certSection = text.match(/(?:certif|certification|courses?)[^\n]*\n([\s\S]{0,600})(?=\n[A-Z]{2,}|\n(?:experience|education|skills?|project)|$)/i);
    if (certSection) {
      const certLines = certSection[1].split('\n').map(l => l.trim()).filter(l => l.length > 3 && l.length < 150);
      for (const line of certLines.slice(0, 10)) {
        const yearM = line.match(/(\d{4})/);
        const issuerM = line.match(/(?:by|from|–|-)\s*([A-Za-z][\w\s]+?)(?:\s*\d{4}|$)/i);
        const name = line.replace(/\s*\d{4}\s*/, '').replace(/(?:by|from)\s+[A-Za-z\s]+/i, '').trim();
        if (name.length > 3)
          certifications.push({ name: name.substring(0, 100), issuer: issuerM ? issuerM[1].trim() : '', year: yearM ? yearM[1] : '' });
      }
    }

    res.json({ success: true, data: { phone, linkedin, github, portfolio, address: '', degree, branch, college, graduationYear, cgpa, skills, experience, certifications } });
  } catch (err) {
    res.json({ success: false, message: 'PDF parsing failed: ' + err.message });
  }
});

// Add project
router.post('/project', isStudent, async (req, res) => {
  try {
    const { title, description, techStack, githubLink, liveLink } = req.body;
    const project = await Project.create({
      userId: req.session.userId,
      title,
      description,
      techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(',').map(s => s.trim()) : []),
      githubLink,
      liveLink
    });
    res.json({ success: true, message: 'Project added!', project });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Update project
router.put('/project/:id', isStudent, async (req, res) => {
  try {
    const { title, description, techStack, githubLink, liveLink } = req.body;
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      {
        title, description, githubLink, liveLink,
        techStack: Array.isArray(techStack) ? techStack : (techStack ? techStack.split(',').map(s => s.trim()) : [])
      },
      { new: true }
    );
    if (!project) return res.json({ success: false, message: 'Project not found' });
    res.json({ success: true, message: 'Project updated!', project });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Delete project
router.delete('/project/:id', isStudent, async (req, res) => {
  try {
    await Project.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.json({ success: true, message: 'Project deleted!' });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
