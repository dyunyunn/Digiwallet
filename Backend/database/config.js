const { Pool } = require('pg');
require('dotenv').config();

// Create a wrapper pool to maintain compatibility with mysql2 syntax
// It converts `?` to `$1, $2` and returns `[rows, fields]` array instead of an object
class PgCompatiblePool extends Pool {
    async query(text, params) {
        if (typeof text === 'string') {
            let index = 1;
            text = text.replace(/\?/g, () => `$${index++}`);
        }
        const result = await super.query(text, params);
        // mysql2 returns [rows, fields]
        return [result.rows, result.fields];
    }
    
    async execute(text, params) {
        return this.query(text, params);
    }
}

const pool = new PgCompatiblePool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    port: process.env.DB_PORT || 5432,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'DigiWallet',
    max: 10,
    idleTimeoutMillis: 30000
});

const testConnection = async () => {
    try {
        const client = await pool.connect();
        console.log('Database connection established successfully.');
        client.release();
    } catch (error) {
        console.error('Error connecting to the database:', error);
        return false;    
    }
}

module.exports = { pool, testConnection };