/**
 * User Service
 * Business logic untuk operasi user
 */

const { pool } = require('../database/config');
const { ERROR_MESSAGES } = require('../utils/respons');
const { toTitleCase } = require('../utils/capitalize');

class UserService {

        /**
         * Get user by email (for login)
         * @param {string} email
         * @returns {object|null}
         */
        async getUserByEmail(email) {
            const [rows] = await pool.query(
                'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
                [email]
            );
            return rows.length > 0 ? rows[0] : null;
        }
    /**
     * Create new user
     * @param {object} userData - User data
     * @returns {object} Created user
     */
    async createUser(userData) {
        const { name, email, password, phone_number, role } = userData;
        if (!password) {
            const error = new Error('Password wajib diisi');
            error.status = 400;
            throw error;
        }
        const fixedName = toTitleCase(name);
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL',
            [email]
        );
        if (existing.length > 0) {
            const error = new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
            error.status = 409;
            throw error;
        }
        // Hash password
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        let fixedPhone = phone_number;
        if (phone_number && typeof phone_number === 'string') {
            fixedPhone = phone_number.replace(/^0/, '+62');
        }
        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, phone_number, balance, role) VALUES (?, ?, ?, ?, 0, ?) RETURNING id',
            [fixedName, email, hashedPassword, fixedPhone || null, role || 'USER']
        );
        
        return this.getUserById(result[0].id);
    }

    /**
     * Get all users with pagination
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {object} Users list with pagination info
     */
    async getUsers(page = 1, limit = 10, search = '', sortBy = 'created_at', sortDir = 'DESC', filters = {}) {
        const offset = (page - 1) * limit;
        let where = ['deleted_at IS NULL'];
        let values = [];
        if (search) {
            where.push('name LIKE ?');
            values.push(`%${search}%`);
        }
        if (filters.email) {
            where.push('email LIKE ?');
            values.push(`%${filters.email}%`);
        }
        if (filters.phone_number) {
            where.push('phone_number LIKE ?');
            values.push(`%${filters.phone_number}%`);
        }
        if (filters.balance_min !== undefined) {
            where.push('balance >= ?');
            values.push(filters.balance_min);
        }
        if (filters.balance_max !== undefined) {
            where.push('balance <= ?');
            values.push(filters.balance_max);
        }
        const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
        // Get total count
        const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM users ${whereClause}`, values);
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);
        // Get users
        const [rows] = await pool.query(
            `SELECT id, name, email, phone_number, balance, role, created_at, updated_at 
             FROM users 
             ${whereClause}
             ORDER BY ${sortBy} ${sortDir} 
             LIMIT ? OFFSET ?`,
            [...values, limit, offset]
        );
        return {
            data: rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                limit
            }
        };
    }

    /**
     * Get user by ID
     * @param {number} id - User ID
     * @returns {object|null} User data
     */
    async getUserById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, email, phone_number, balance, role, created_at, updated_at, monthly_limit 
             FROM users WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        if (rows.length === 0) {
            const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            error.status = 404;
            throw error;
        }
        return rows[0];
    }

    /**
     * Update user
     * @param {number} id - User ID
     * @param {object} userData - User data to update
     * @returns {object} Updated user
     */
    async updateUser(id, userData) {
        await this.getUserById(id);
        const { name, email, password, phone_number, balance, role, monthly_limit } = userData;
        if (email) {
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND deleted_at IS NULL AND id != ?',
                [email, id]
            );
            if (existing.length > 0) {
                const error = new Error(ERROR_MESSAGES.USER_ALREADY_EXISTS);
                error.status = 409;
                throw error;
            }
        }
        const updates = [];
        const values = [];
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (password !== undefined) {
            const bcrypt = require('bcryptjs');
            const hashedPassword = await bcrypt.hash(password, 10);
            updates.push('password = ?');
            values.push(hashedPassword);
            
        }
        if (phone_number !== undefined) {
            updates.push('phone_number = ?');
            values.push(phone_number);
        }
        if (balance !== undefined) {
            updates.push('balance = ?');
            values.push(balance);
        }
        if (role !== undefined) {
            updates.push('role = ?');
            values.push(role);
        }
        if (monthly_limit !== undefined) {
            updates.push('monthly_limit = ?');
            values.push(monthly_limit);
        }
        if (updates.length > 0) {
            values.push(id);
            await pool.query(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
        return this.getUserById(id);
    }

    /**
     * Delete user (Soft / Hard Delete)
     * @param {number} id - User ID
     * @param {boolean} isHardDelete - If true, permanently delete from DB
     * @returns {boolean} Success status
     */
    async deleteUser(id, isHardDelete = false) {
        // Check if user exists
        await this.getUserById(id);
        
        // Check if user has transactions
        const [transactions] = await pool.query(
            'SELECT id FROM transactions WHERE user_id = ? LIMIT 1',
            [id]
        );
        
        if (transactions.length > 0) {
            if (isHardDelete) {
                const error = new Error('User tidak dapat di-hard-delete karena sudah memiliki transaksi');
                error.status = 400;
                throw error;
            } else {
                // Soft delete
                await pool.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                return true;
            }
        }
        
        if (isHardDelete) {
            await pool.query('DELETE FROM users WHERE id = ?', [id]);
        } else {
            await pool.query('UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        }
        
        return true;
    }

    /**
     * Update user balance (for internal use)
     * @param {object} connection - Database connection (for transaction)
     * @param {number} userId - User ID
     * @param {number} amount - Amount to deduct (positive number)
     * @returns {object} Updated user
     */
    async deductBalance(connection, userId, amount) {
        // Lock the row for update (prevent race condition)
        const [users] = await connection.query(
            'SELECT id, balance FROM users WHERE id = ? AND deleted_at IS NULL FOR UPDATE',
            [userId]
        );
        
        if (users.length === 0) {
            const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
            error.status = 404;
            throw error;
        }
        
        const user = users[0];
        const currentBalance = parseFloat(user.balance);
        
        if (currentBalance < amount) {
            const error = new Error(ERROR_MESSAGES.INSUFFICIENT_BALANCE);
            error.status = 400;
            throw error;
        }
        
        const newBalance = currentBalance - amount;
        
        await connection.query(
            'UPDATE users SET balance = ? WHERE id = ?',
            [newBalance, userId]
        );
        
        return { ...user, balance: newBalance };
    }

    /**
     * Add balance to user (for top up)
     * @param {number} userId - User ID
     * @param {number} amount - Amount to add
     * @returns {object} Updated user with top up details
     */
    async addBalance(userId, amount) {
        const user = await this.getUserById(userId);
        const previousBalance = parseFloat(user.balance);
        
        await pool.query(
            'UPDATE users SET balance = balance + ? WHERE id = ?',
            [amount, userId]
        );
        
        const updatedUser = await this.getUserById(userId);
        
        return {
            ...updatedUser,
            previous_balance: previousBalance.toFixed(2),
            top_up_amount: parseFloat(amount).toFixed(2)
        };
    }
}

module.exports = new UserService();   
