const jwt = require('jsonwebtoken');
const { pool } = require('../db');

module.exports = async function auth(req, res, next) {
    const header = req.headers.authorization || '';
    const apiKey = req.headers['x-api-key'];

    try {
        if (apiKey) {
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE api_key = $1', [apiKey]
            );
            if (!rows.length) return res.status(401).json({ error: 'Invalid API key' });
            req.user = rows[0];
            return next();
        }
        if (header.startsWith('Bearer ')) {
            const token = header.slice(7);
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            const { rows } = await pool.query(
                'SELECT * FROM users WHERE id = $1', [payload.userId]
            );
            if (!rows.length) return res.status(401).json({ error: 'User not found' });
            req.user = rows[0];
            return next();
        }
        res.status(401).json({ error: 'Unauthorized' });
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};
