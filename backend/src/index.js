require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { migrate } = require('./db');
const { startWorker } = require('./services/queue');
const { processRun }  = require('./services/runner');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/actors',   require('./routes/actors'));
app.use('/api/runs',     require('./routes/runs'));
app.use('/api/datasets', require('./routes/datasets'));
app.use('/api/stats',    require('./routes/stats'));

// Serve frontend in production
const distPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(distPath));
app.get('/{*path}', (req, res) => {
    const fs = require('fs');
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({ message: 'MyApify API running. Build the frontend to serve the dashboard.' });
    }
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 4280;

async function start() {
    try {
        await migrate();
    } catch (err) {
        console.warn('[DB] Migration skipped (DB not available):', err.message);
    }
    try {
        startWorker(processRun);
        console.log('[Queue] Worker started');
    } catch (err) {
        console.warn('[Queue] Worker skipped (Redis not available):', err.message);
    }
    app.listen(PORT, () => console.log(`MyApify API running on port ${PORT}`));
}

start().catch(err => { console.error(err); process.exit(1); });
