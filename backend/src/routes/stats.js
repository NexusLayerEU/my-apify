const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    const uid = req.user.id;
    const [actors, runs, datasets, todayRuns] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM actors WHERE user_id=$1', [uid]),
        pool.query('SELECT COUNT(*) FROM runs WHERE user_id=$1', [uid]),
        pool.query('SELECT COUNT(*) FROM datasets WHERE user_id=$1', [uid]),
        pool.query("SELECT COUNT(*) FROM runs WHERE user_id=$1 AND created_at > NOW()-INTERVAL '24h'", [uid]),
    ]);
    const statusCounts = await pool.query(
        'SELECT status, COUNT(*) FROM runs WHERE user_id=$1 GROUP BY status', [uid]
    );
    const byStatus = Object.fromEntries(statusCounts.rows.map(r => [r.status, parseInt(r.count)]));
    res.json({
        actors:    parseInt(actors.rows[0].count),
        runs:      parseInt(runs.rows[0].count),
        datasets:  parseInt(datasets.rows[0].count),
        todayRuns: parseInt(todayRuns.rows[0].count),
        byStatus,
    });
});

module.exports = router;
