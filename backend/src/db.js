require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    for (const file of ['001_initial.sql', '002_phase2.sql']) {
        const sql = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
        await pool.query(sql);
    }
    console.log('[DB] Migrations complete');
}

module.exports = { pool, migrate };
