// auth.js
// Middleware for authentication and role-based access control
const { pool } = require('../database/config');

// Dummy: extract token from header and get session & user
async function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Tidak memiliki wewenang: Token tidak ditemukan' });
    }
    const token = authHeader.replace('Bearer ', '');
    // Find session by token and check expiry, and ensure user is not soft-deleted
    const [sessions] = await pool.query(
        'SELECT s.*, u.role FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND u.deleted_at IS NULL',
        [token]
    );
    if (sessions.length === 0) {
        return res.status(401).json({ message: 'Tidak memiliki wewenang: Sesi tidak valid' });
    }
    const session = sessions[0];
    const now = new Date();
    const expiredAt = new Date(session.expired_at);
    if (expiredAt < now) {
        // If expired more than 7 days, block user
        const diffMs = now - expiredAt;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (diffDays > 7) {
            // Optionally, set user as blocked in DB here
            return res.status(403).json({ message: 'Tidak memiliki wewenang: Sesi telah kadaluarsa dan user diblokir (lebih dari 7 hari)' });
        }
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Sesi telah kadaluarsa' });
    }
    req.user = { id: session.user_id, role: session.role };
    req.session = session;
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ message: 'Tidak memiliki wewenang: Akses ditolak' });
        }
        next();
    };
}

module.exports = { authMiddleware, requireRole };