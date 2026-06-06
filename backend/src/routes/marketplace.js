const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

// Public — no auth to browse
router.get('/', async (req, res) => {
    const { category } = req.query;
    let q = 'SELECT * FROM templates';
    const params = [];
    if (category) { params.push(category); q += ` WHERE category=$1`; }
    q += ' ORDER BY name';
    const { rows } = await pool.query(q, params);
    res.json(rows);
});

router.get('/categories', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT DISTINCT category FROM templates ORDER BY category'
    );
    res.json(rows.map(r => r.category));
});

// Clone template into a user's actor (requires auth)
router.post('/:id/clone', auth, async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM templates WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    const tpl = rows[0];
    const slug = tpl.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { rows: actor } = await pool.query(
        `INSERT INTO actors (user_id, name, slug, description, runtime, source_code, requirements)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.id, tpl.name, slug, tpl.description, tpl.runtime, tpl.source_code, tpl.requirements]
    );
    res.status(201).json(actor[0]);
});

module.exports = router;
