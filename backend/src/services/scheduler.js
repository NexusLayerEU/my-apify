const cron = require('node-cron');
const { pool } = require('../db');
const { enqueueRun } = require('./queue');

const jobs = new Map();

async function loadAndScheduleAll() {
    const { rows } = await pool.query(
        'SELECT s.*, a.user_id FROM schedules s JOIN actors a ON s.actor_id=a.id WHERE s.enabled=true'
    );
    for (const schedule of rows) {
        registerJob(schedule);
    }
    console.log(`[Scheduler] Loaded ${rows.length} active schedules`);
}

function registerJob(schedule) {
    // Stop existing job for this schedule if any
    if (jobs.has(schedule.id)) {
        jobs.get(schedule.id).stop();
        jobs.delete(schedule.id);
    }

    if (!schedule.enabled) return;

    if (!cron.validate(schedule.cron_expr)) {
        console.warn(`[Scheduler] Invalid cron for schedule ${schedule.id}: ${schedule.cron_expr}`);
        return;
    }

    const task = cron.schedule(schedule.cron_expr, async () => {
        console.log(`[Scheduler] Firing schedule ${schedule.id} (actor ${schedule.actor_id})`);
        try {
            const { rows } = await pool.query(
                `INSERT INTO runs (actor_id, user_id, input_json) VALUES ($1,$2,$3) RETURNING *`,
                [schedule.actor_id, schedule.user_id, schedule.input_json]
            );
            const run = rows[0];
            await enqueueRun(run.id);
            await pool.query(
                'UPDATE schedules SET last_run=NOW() WHERE id=$1', [schedule.id]
            );
        } catch (err) {
            console.error(`[Scheduler] Error firing schedule ${schedule.id}:`, err.message);
        }
    });

    jobs.set(schedule.id, task);
}

function unregisterJob(scheduleId) {
    if (jobs.has(scheduleId)) {
        jobs.get(scheduleId).stop();
        jobs.delete(scheduleId);
    }
}

module.exports = { loadAndScheduleAll, registerJob, unregisterJob };
