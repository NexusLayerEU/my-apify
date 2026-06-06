const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
    const { rows } = await pool.query(
        `SELECT s.*, a.name as actor_name
         FROM schedules s JOIN actors a ON s.actor_id=a.id
         WHERE s.user_id=$1 ORDER BY s.created_at DESC`,
        [req.user.id]
    );
    res.json(rows);
});

router.post('/', async (req, res) => {
    const { actor_id, cron_expr, input_json = {}, webhook_url = '' } = req.body;
    if (!actor_id || !cron_expr) return res.status(400).json({ error: 'actor_id and cron_expr required' });

    // Verify actor belongs to user
    const { rows: actor } = await pool.query(
        'SELECT id FROM actors WHERE id=$1 AND user_id=$2', [actor_id, req.user.id]
    );
    if (!actor.length) return res.status(404).json({ error: 'Actor not found' });

    const { rows } = await pool.query(
        `INSERT INTO schedules (actor_id, user_id, cron_expr, input_json, webhook_url)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [actor_id, req.user.id, cron_expr, input_json, webhook_url]
    );
    res.status(201).json(rows[0]);
});

router.put('/:id', async (req, res) => {
    const { cron_expr, input_json, webhook_url, enabled } = req.body;
    const { rows } = await pool.query(
        `UPDATE schedules SET
            cron_expr   = COALESCE($1, cron_expr),
            input_json  = COALESCE($2, input_json),
            webhook_url = COALESCE($3, webhook_url),
            enabled     = COALESCE($4, enabled)
         WHERE id=$5 AND user_id=$6 RETURNING *`,
        [cron_expr, input_json, webhook_url, enabled, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json(rows[0]);
});

router.patch('/:id/toggle', async (req, res) => {
    const { rows } = await pool.query(
        `UPDATE schedules SET enabled = NOT enabled WHERE id=$1 AND user_id=$2 RETURNING *`,
        [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
    const { rowCount } = await pool.query(
        'DELETE FROM schedules WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true });
});

module.exports = router;
