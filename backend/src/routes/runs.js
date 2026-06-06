const router = require('express').Router();
const { pool } = require('../db');
const auth = require('../middleware/auth');
const { getSSEClients, removeSSEClient } = require('../services/logStream');

router.use(auth);

router.get('/', async (req, res) => {
    const { status, actor_id } = req.query;
    let q = 'SELECT r.*, a.name as actor_name FROM runs r JOIN actors a ON r.actor_id=a.id WHERE r.user_id=$1';
    const params = [req.user.id];
    if (status)   { params.push(status);   q += ` AND r.status=$${params.length}`; }
    if (actor_id) { params.push(actor_id); q += ` AND r.actor_id=$${params.length}`; }
    q += ' ORDER BY r.created_at DESC LIMIT 100';
    const { rows } = await pool.query(q, params);
    res.json(rows);
});

router.get('/:id', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT r.*, a.name as actor_name FROM runs r JOIN actors a ON r.actor_id=a.id WHERE r.id=$1 AND r.user_id=$2',
        [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    res.json(rows[0]);
});

// SSE log stream
router.get('/:id/log', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT id FROM runs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    const runId = req.params.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send historical logs
    const { rows: logs } = await pool.query(
        'SELECT * FROM run_logs WHERE run_id=$1 ORDER BY id', [runId]
    );
    for (const log of logs) {
        res.write(`data: ${JSON.stringify(log)}\n\n`);
    }

    // Check if run already finished
    const { rows: run } = await pool.query('SELECT status FROM runs WHERE id=$1', [runId]);
    if (['SUCCEEDED','FAILED','ABORTED'].includes(run[0]?.status)) {
        res.write(`data: ${JSON.stringify({ type: 'done', status: run[0].status })}\n\n`);
        return res.end();
    }

    // Subscribe to live logs
    const clients = getSSEClients();
    if (!clients[runId]) clients[runId] = [];
    clients[runId].push(res);

    req.on('close', () => removeSSEClient(runId, res));
});

router.post('/:id/abort', async (req, res) => {
    const { rows } = await pool.query(
        'SELECT * FROM runs WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Run not found' });
    if (rows[0].status !== 'RUNNING') return res.status(400).json({ error: 'Run not running' });

    const Docker = require('dockerode');
    const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
    if (rows[0].container_id) {
        try {
            const container = docker.getContainer(rows[0].container_id);
            await container.kill();
        } catch {}
    }
    await pool.query("UPDATE runs SET status='ABORTED', finished_at=NOW() WHERE id=$1", [req.params.id]);
    res.json({ success: true });
});

module.exports = router;
