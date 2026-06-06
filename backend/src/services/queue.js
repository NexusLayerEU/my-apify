const { Queue, Worker } = require('bullmq');

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 4250,
};

const runQueue = new Queue('actor-runs', { connection });

async function enqueueRun(runId) {
    await runQueue.add('run', { runId }, { attempts: 1 });
}

function startWorker(processRun) {
    const worker = new Worker('actor-runs', async job => {
        await processRun(job.data.runId);
    }, { connection, concurrency: 3 });

    worker.on('failed', (job, err) => {
        console.error(`[Queue] Job ${job?.id} failed:`, err.message);
    });

    return worker;
}

module.exports = { enqueueRun, startWorker };
