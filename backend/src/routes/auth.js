const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, api_key, plan, created_at',
            [email.toLowerCase(), hash]
        );
        const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
        throw err;
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email?.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: rows[0].id }, process.env.JWT_SECRET, { expiresIn: '30d' });
    const { password_hash, ...user } = rows[0];
    res.json({ token, user });
});

router.get('/me', auth, (req, res) => {
    const { password_hash, ...user } = req.user;
    res.json(user);
});

router.post('/rotate-key', auth, async (req, res) => {
    const newKey = uuidv4();
    await pool.query('UPDATE users SET api_key = $1 WHERE id = $2', [newKey, req.user.id]);
    res.json({ api_key: newKey });
});

module.exports = router;
