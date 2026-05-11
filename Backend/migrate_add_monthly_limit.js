const { pool } = require('./database/config');

async function migrate() {
    try {
        console.log('Adding monthly_limit column to users table...');
        
        // Add monthly_limit column
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS monthly_limit DECIMAL(15, 2) DEFAULT 0.00;
        `);
        
        console.log('Migration successful: added monthly_limit column.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        process.exit();
    }
}

migrate();