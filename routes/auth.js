const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, company } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.json({ success: false, message: 'Email already registered' });

    const user = new User({ name, email, password, role, company });
    await user.save();

    res.json({ success: true, message: 'Registered successfully! Please login.' });
  } catch (err) {
    res.json({ success: false, message: 'Registration failed: ' + err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const user = await User.findOne({ email, role });
    if (!user) return res.json({ success: false, message: 'Invalid credentials or wrong role selected' });

    const match = await user.comparePassword(password);
    if (!match) return res.json({ success: false, message: 'Incorrect password' });

    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.name = user.name;

    res.json({
      success: true,
      role: user.role,
      redirect: user.role === 'student' ? '/student-dashboard' : '/recruiter-dashboard'
    });
  } catch (err) {
    res.json({ success: false, message: 'Login failed: ' + err.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current session user
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  try {
    const user = await User.findById(req.session.userId).select('-password');
    res.json({ loggedIn: true, user });
  } catch {
    res.json({ loggedIn: false });
  }
});

module.exports = router;
