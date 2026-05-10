/**
 * Scheduler Service
 * Menangani background jobs periodik, termasuk auto-complete transaksi PENDING.
 */

const { pool } = require('../database/config');

const AUTO_COMPLETE_MINUTES = 1; // setelah berapa menit PENDING → SUCCESS

/**
 * Selesaikan semua transaksi PENDING yang sudah melewati AUTO_COMPLETE_MINUTES.
 * Dipanggil saat startup dan setiap menit oleh interval.
 */
async function autoCompleteOldPendingTransactions() {
    try {
        const [result] = await pool.query(
            `UPDATE transactions
             SET status = 'SUCCESS',
                 notes  = 'Transaksi otomatis diselesaikan (scheduler)'
             WHERE status = 'PENDING'
               AND updated_at <= NOW() - (? * INTERVAL '1 MINUTE')`,
            [AUTO_COMPLETE_MINUTES]
        );

        if (result.affectedRows > 0) {
            console.log(`[Scheduler] Auto-completed ${result.affectedRows} PENDING transaction(s) to SUCCESS.`);
        }
    } catch (error) {
        console.error('[Scheduler] Error auto-completing transactions:', error.message);
    }
}

/**
 * Mulai scheduler: jalankan langsung saat dipanggil, lalu ulangi setiap menit.
 */
function startScheduler() {
    console.log(`[Scheduler] Started — auto-complete PENDING after ${AUTO_COMPLETE_MINUTES} minute(s).`);

    // Jalankan segera saat server start (tangkap PENDING lama)
    autoCompleteOldPendingTransactions();

    // Ulangi setiap 60 detik
    setInterval(autoCompleteOldPendingTransactions, 60 * 1000);
}

module.exports = { startScheduler };
