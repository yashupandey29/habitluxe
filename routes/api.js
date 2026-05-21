const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const User = require('../models/User');
require('dotenv').config();

// Middleware: Verify Token
const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token provided' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.userId);
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Email Transporter
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ===== AUTH ROUTES =====

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        const user = new User({ email, password, name });
        await user.save();

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            token,
            user: { id: user._id, email: user.email, name: user.name, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
        res.json({
            token,
            user: { id: user._id, email: user.email, name: user.name, role: user.role }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Profile
router.get('/profile', auth, async (req, res) => {
    res.json({
        user: {
            id: req.user._id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            streak: req.user.streak
        }
    });
});

// ===== HABIT ROUTES =====

// Get Today's Habits
router.get('/habits', auth, async (req, res) => {
    try {
        res.json(req.user.habits);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add Habit
router.post('/habits', auth, async (req, res) => {
    try {
        const { name, reminderTime } = req.body;

        const newHabit = {
            name,
            reminderTime,
            completed: false,
            createdAt: new Date()
        };

        req.user.habits.push(newHabit);

        await req.user.save();

        res.status(201).json({
            message: 'Habit added successfully',
            habits: req.user.habits
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Toggle Habit
router.put('/habits/:id/toggle', auth, async (req, res) => {
    try {
        const habit = req.user.habits.id(req.params.id);
        if (!habit) return res.status(404).json({ message: 'Habit not found' });

        habit.completed = !habit.completed;
        if (habit.completed) {
            habit.completedAt = new Date();
        }
        await req.user.save();
        res.json(habit);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Habit
router.delete('/habits/:id', auth, async (req, res) => {
    try {
        req.user.habits.pull({ _id: req.params.id });
        await req.user.save();
        res.json({ message: 'Habit deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== SLEEP ROUTES =====

// Save Sleep
router.post('/sleep', auth, async (req, res) => {
    try {
        const { sleepTime, wakeTime } = req.body;
        req.user.sleepData.push({ sleepTime, wakeTime });
        await req.user.save();
        res.json({ message: 'Sleep data saved' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Sleep Stats
router.get('/sleep', auth, async (req, res) => {
    const recent = req.user.sleepData.slice(-7);
    res.json(recent);
});

// ===== ADMIN ROUTES =====

// Get All Users (Admin only)
router.get('/admin/users', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const users = await User.find().select('-password');
    res.json(users);
});

// Get All Habits (Admin only)
router.get('/admin/habits', auth, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied' });
    }

    const users = await User.find().select('name email habits');
    res.json(users);
});

// ===== REMINDER EMAIL =====
async function sendReminderEmail(habits, userEmail) {
    try {
        const list = habits.map(h => `• ${h.name}`).join('\n');
        await transporter.sendMail({
            from: process.env.EMAIL_FROM,
            to: process.env.NOTIFICATION_EMAIL || userEmail,
            subject: '⏰ Habit Reminder - Pending Tasks',
            text: `You have pending habits:\n\n${list}\n\nDon't forget to complete them!`
        });
    } catch (error) {
        console.log('Email error:', error.message);
    }
}

module.exports = router;