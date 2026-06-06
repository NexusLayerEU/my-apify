const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM datasets WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(rows);
});

router.get('/:id', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM datasets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Dataset not found' });
    res.json(rows[0]);
});

router.get('/:id/items', async (req, res) => {
    const limit  = Math.min(parseInt(req.query.limit)  || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;
    const fmt    = req.query.format;

    const ds = await pool.query('SELECT * FROM datasets WHERE id = $1 AND user_id = $2',
        [req.params.id, req.user.id]);
    if (!ds.rows.length) return res.status(404).json({ error: 'Dataset not found' });

    const { rows } = await pool.query(
        'SELECT data FROM dataset_items WHERE dataset_id = $1 ORDER BY id LIMIT $2 OFFSET $3',
        [req.params.id, limit, offset]
    );
    const items = rows.map(r => r.data);

    if (fmt === 'csv' && items.length) {
        const keys = Object.keys(items[0]);
        const csv  = [keys.join(','), ...items.map(i => keys.map(k => JSON.stringify(i[k] ?? '')).join(','))].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="dataset-${req.params.id}.csv"`);
        return res.send(csv);
    }
    res.json({ items, total: ds.rows[0].item_count, limit, offset });
});

// Called from within actors via SDK — no user auth, uses run token
router.post('/:id/items', async (req, res) => {
    const items = Array.isArray(req.body) ? req.body : [req.body];
    if (!items.length) return res.json({ pushed: 0 });

    const values = items.map((_, i) => `($1, $${i + 2})`).join(',');
    await pool.query(
        `INSERT INTO dataset_items (dataset_id, data) VALUES ${values}`,
        [req.params.id, ...items]
    );
    await pool.query(
        'UPDATE datasets SET item_count = item_count + $1 WHERE id = $2',
        [items.length, req.params.id]
    );
    res.json({ pushed: items.length });
});

router.delete('/:id', async (req, res) => {
    const { rowCount } = await pool.query(
        'DELETE FROM datasets WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Dataset not found' });
    res.json({ success: true });
});

module.exports = router;
