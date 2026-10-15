import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/user.model.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loginManager(req, res) {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || !email.trim() || !emailPattern.test(email.trim())) {
        return res.status(400).json({ message: 'A valid email is required' });
    }
    if (typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({ message: 'Password is required' });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: 'Authentication is not configured' });
    }

    try {
        const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
        if (!user || !['ADMIN', 'TPO'].includes(String(user.role).toUpperCase())) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign(
            { userId: user._id.toString(), email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' },
        );
        return res.status(200).json({
            message: 'Signed in successfully',
            user: { _id: user._id, name: user.name, email: user.email, role: user.role },
            token,
        });
    } catch (error) {
        console.error('Error logging in manager:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}

export async function createTpoAccount(req, res) {
    const { name, email, password } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'Name is required' });
    if (typeof email !== 'string' || !email.trim() || !emailPattern.test(email.trim())) return res.status(400).json({ message: 'A valid email is required' });
    if (typeof password !== 'string' || password.trim().length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) return res.status(409).json({ message: 'An account with this email already exists' });
        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: await bcrypt.hash(password, 10),
            role: 'TPO',
        });
        return res.status(201).json({
            message: 'TPO account created successfully',
            user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists' });
        if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Invalid account data' });
        console.error('Error creating TPO account:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}
