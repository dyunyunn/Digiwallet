const { pool } = require('./database/config');

async function migrate() {
    try {
        console.log('Menambahkan kolom deleted_at...');
        await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;');
        await pool.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;');
        await pool.query('ALTER TABLE categories ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;');
        console.log('Migration berhasil. Kolom deleted_at telah ditambahkan.');
        process.exit(0);
    } catch (error) {
        console.error('Gagal menjalankan migration:', error);
        process.exit(1);
    }
}

migrate();