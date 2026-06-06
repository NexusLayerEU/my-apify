const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { enqueueRun } = require('../services/queue');

router.use(auth);

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM actors WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { name, description = '', runtime = 'python3', source_code = '', requirements = '' } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const { rows } = await pool.query(
        `INSERT INTO actors (user_id, name, slug, description, runtime, source_code, requirements)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [req.user.id, name, slug, description, runtime, source_code, requirements]
    );
    res.status(201).json(rows[0]);
});

router.get('/:id', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM actors WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Actor not found' });
    res.json(rows[0]);
});

router.put('/:id', async (req, res) => {
    const { name, description, runtime, source_code, requirements, is_public } = req.body;
    const { rows } = await pool.query(
        `UPDATE actors SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description),
            runtime     = COALESCE($3, runtime),
            source_code = COALESCE($4, source_code),
            requirements= COALESCE($5, requirements),
            is_public   = COALESCE($6, is_public),
            updated_at  = NOW()
         WHERE id = $7 AND user_id = $8 RETURNING *`,
        [name, description, runtime, source_code, requirements, is_public, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Actor not found' });
    res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
    const { rowCount } = await pool.query(
        'DELETE FROM actors WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Actor not found' });
    res.json({ success: true });
});

router.post('/:id/run', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM actors WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Actor not found' });
    const input = req.body.input || {};
    const { rows: runRows } = await pool.query(
        `INSERT INTO runs (actor_id, user_id, input_json) VALUES ($1,$2,$3) RETURNING *`,
        [rows[0].id, req.user.id, input]
    );
    const run = runRows[0];
    await enqueueRun(run.id);
    res.status(201).json(run);
});

router.get('/:id/runs', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM runs WHERE actor_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 50',
        [req.params.id, req.user.id]
    );
    res.json(rows);
});

module.exports = router;
