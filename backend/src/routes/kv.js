const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// List stores
router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM kv_stores WHERE user_id=$1 ORDER BY created_at DESC', [req.user.id]
    );
    res.json(rows);
});

// Create store
router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    try {
        const { rows } = await pool.query(
            'INSERT INTO kv_stores (name, user_id) VALUES ($1,$2) RETURNING *',
            [name, req.user.id]
        );
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Store name already exists' });
        throw err;
    }
});

// Delete store
router.delete('/:storeId', async (req, res) => {
    const { rowCount } = await pool.query(
        'DELETE FROM kv_stores WHERE id=$1 AND user_id=$2', [req.params.storeId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Store not found' });
    res.json({ success: true });
});

// List keys in store
router.get('/:storeId/keys', async (req, res) => {
    const store = await pool.query(
        'SELECT id FROM kv_stores WHERE id=$1 AND user_id=$2', [req.params.storeId, req.user.id]
    );
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    const { rows } = await pool.query(
        'SELECT key, content_type, updated_at FROM kv_records WHERE store_id=$1 ORDER BY key',
        [req.params.storeId]
    );
    res.json(rows);
});

// Get value
router.get('/:storeId/:key', async (req, res) => {
    const store = await pool.query(
        'SELECT id FROM kv_stores WHERE id=$1 AND user_id=$2', [req.params.storeId, req.user.id]
    );
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    const { rows } = await pool.query(
        'SELECT * FROM kv_records WHERE store_id=$1 AND key=$2',
        [req.params.storeId, req.params.key]
    );
    if (!rows.length) return res.status(404).json({ error: 'Key not found' });
    res.setHeader('Content-Type', rows[0].content_type);
    res.send(rows[0].value);
});

// Set value
router.put('/:storeId/:key', async (req, res) => {
    const store = await pool.query(
        'SELECT id FROM kv_stores WHERE id=$1 AND user_id=$2', [req.params.storeId, req.user.id]
    );
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    const contentType = req.headers['content-type'] || 'application/json';
    const value = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const { rows } = await pool.query(
        `INSERT INTO kv_records (store_id, key, value, content_type)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (store_id, key)
         DO UPDATE SET value=$3, content_type=$4, updated_at=NOW()
         RETURNING *`,
        [req.params.storeId, req.params.key, value, contentType]
    );
    res.json(rows[0]);
});

// Delete key
router.delete('/:storeId/:key', async (req, res) => {
    const store = await pool.query(
        'SELECT id FROM kv_stores WHERE id=$1 AND user_id=$2', [req.params.storeId, req.user.id]
    );
    if (!store.rows.length) return res.status(404).json({ error: 'Store not found' });
    await pool.query('DELETE FROM kv_records WHERE store_id=$1 AND key=$2',
        [req.params.storeId, req.params.key]
    );
    res.json({ success: true });
});

module.exports = router;
