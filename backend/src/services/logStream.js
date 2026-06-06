const { pool } = require('../db');

// Map of runId → array of SSE response objects
const sseClients = {};

function getSSEClients() {
    return sseClients;
}

function removeSSEClient(runId, res) {
    if (sseClients[runId]) {
        sseClients[runId] = sseClients[runId].filter(r => r !== res);
        if (!sseClients[runId].length) delete sseClients[runId];
    }
}

async function appendLog(runId, level, message) {
    const { rows } = await pool.query(
        'INSERT INTO run_logs (run_id, level, message) VALUES ($1,$2,$3) RETURNING *',
        [runId, level, message]
    );
    const log = rows[0];
    if (sseClients[runId]) {
        const data = `data: ${JSON.stringify(log)}\n\n`;
        sseClients[runId].forEach(res => {
            try { res.write(data); } catch {}
        });
    }
    return log;
}

function broadcastDone(runId, status) {
    if (sseClients[runId]) {
        const data = `data: ${JSON.stringify({ type: 'done', status })}\n\n`;
        sseClients[runId].forEach(res => {
            try { res.write(data); res.end(); } catch {}
        });
        delete sseClients[runId];
    }
}

module.exports = { getSSEClients, removeSSEClient, appendLog, broadcastDone };
