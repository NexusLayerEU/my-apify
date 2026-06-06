require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    const sql = fs.readFileSync(
        path.join(__dirname, '../migrations/001_initial.sql'), 'utf8'
    );
    await pool.query(sql);
    console.log('[DB] Migration complete');
}

module.exports = { pool, migrate };
