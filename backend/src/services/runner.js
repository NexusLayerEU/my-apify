const Docker = require('dockerode');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pool } = require('../db');
const { appendLog, broadcastDone } = require('./logStream');

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });

const RUNTIME_IMAGES = {
    python3: 'myapify-runtime-python3',
    node20:  'myapify-runtime-node20',
};

async function processRun(runId) {
    await pool.query(
        "UPDATE runs SET status='RUNNING', started_at=NOW() WHERE id=$1", [runId]
    );
    await appendLog(runId, 'INFO', '--- Run started ---');

    let run;
    try {
        const { rows } = await pool.query(
            `SELECT r.*, a.name as actor_name, a.source_code, a.requirements, a.runtime
             FROM runs r JOIN actors a ON r.actor_id=a.id WHERE r.id=$1`,
            [runId]
        );
        if (!rows.length) throw new Error('Run not found');
        run = rows[0];
    } catch (err) {
        await finishRun(runId, 'FAILED', -1, err.message);
        return;
    }

    // Create output dataset
    const { rows: dsRows } = await pool.query(
        'INSERT INTO datasets (name, user_id, actor_id, run_id) VALUES ($1,$2,$3,$4) RETURNING *',
        [`${run.actor_name}-${runId.slice(0,8)}`, run.user_id, run.actor_id, runId]
    );
    const dataset = dsRows[0];
    await pool.query('UPDATE runs SET output_dataset_id=$1 WHERE id=$2', [dataset.id, runId]);

    // Write actor source to temp dir
    const workDir = path.join(process.env.ACTOR_DATA_DIR || os.tmpdir(), runId);
    fs.mkdirSync(workDir, { recursive: true });

    const mainFile = run.runtime === 'python3' ? 'main.py' : 'main.js';
    fs.writeFileSync(path.join(workDir, mainFile), run.source_code);
    if (run.requirements) {
        const reqFile = run.runtime === 'python3' ? 'requirements.txt' : 'package.json';
        fs.writeFileSync(path.join(workDir, reqFile), run.requirements);
    }

    await appendLog(runId, 'INFO', `Runtime: ${run.runtime} | Dataset: ${dataset.id}`);

    const image = RUNTIME_IMAGES[run.runtime] || 'myapify-runtime-python3';
    const env = [
        `ACTOR_INPUT=${JSON.stringify(run.input_json)}`,
        `MYAPIFY_API_URL=${process.env.API_BASE_URL || 'http://host.docker.internal:4280'}`,
        `MYAPIFY_RUN_ID=${runId}`,
        `MYAPIFY_DATASET_ID=${dataset.id}`,
        `MYAPIFY_API_KEY=${run.user_id}`,
    ];

    let container;
    try {
        container = await docker.createContainer({
            Image: image,
            Cmd: run.runtime === 'python3' ? ['python3', '/actor/main.py'] : ['node', '/actor/main.js'],
            Env: env,
            HostConfig: {
                Binds: [`${workDir}:/actor:ro`],
                Memory: 512 * 1024 * 1024,
                CpuQuota: 100000,
                NetworkMode: 'host',
                AutoRemove: false,
            },
        });

        await pool.query('UPDATE runs SET container_id=$1 WHERE id=$2', [container.id, runId]);
        await container.start();
        await appendLog(runId, 'INFO', `Container started: ${container.id.slice(0,12)}`);

        const logStream = await container.logs({
            follow: true, stdout: true, stderr: true, timestamps: false,
        });

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(async () => {
                try { await container.kill(); } catch {}
                reject(new Error('Timeout: 30 minutes exceeded'));
            }, 30 * 60 * 1000);

            docker.modem.demuxStream(logStream, {
                write: async (chunk) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        await appendLog(runId, 'INFO', line);
                    }
                },
            }, {
                write: async (chunk) => {
                    const lines = chunk.toString().split('\n').filter(Boolean);
                    for (const line of lines) {
                        await appendLog(runId, 'ERROR', line);
                    }
                },
            });

            logStream.on('end', () => { clearTimeout(timeout); resolve(); });
            logStream.on('error', (e) => { clearTimeout(timeout); reject(e); });
        });

        const data = await container.inspect();
        const exitCode = data.State.ExitCode;
        await container.remove();
        fs.rmSync(workDir, { recursive: true, force: true });

        const status = exitCode === 0 ? 'SUCCEEDED' : 'FAILED';
        await finishRun(runId, status, exitCode);

    } catch (err) {
        await appendLog(runId, 'ERROR', `Fatal: ${err.message}`);
        try { if (container) await container.remove({ force: true }); } catch {}
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch {}
        await finishRun(runId, 'FAILED', -1);
    }
}

async function finishRun(runId, status, exitCode, errMsg) {
    if (errMsg) await appendLog(runId, 'ERROR', errMsg);
    await appendLog(runId, 'INFO', `--- Run ${status} ---`);
    await pool.query(
        "UPDATE runs SET status=$1, exit_code=$2, finished_at=NOW() WHERE id=$3",
        [status, exitCode, runId]
    );
    broadcastDone(runId, status);
}

module.exports = { processRun };
