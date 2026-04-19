const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/resume_app';
const SESSION_SECRET = process.env.SESSION_SECRET || 'resume_portal_secret_key_2024';

mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.log('MongoDB error:', err.message));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/student', require('./routes/student'));
app.use('/api/recruiter', require('./routes/recruiter'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/student-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html')));
app.get('/recruiter-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'recruiter-dashboard.html')));
app.get('/health', (req, res) => res.status(200).json({ ok: true }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
