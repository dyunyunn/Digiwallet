// Import harus di atas
const { pool } = require('../database/config');
const { ERROR_MESSAGES } = require('../utils/respons');
const userService = require('./userService');
const productService = require('./productService');

// Tax rate constant (11%)
const TAX_RATE = 0.11;

class TransactionService {
    /**
     * Delete transaction by ID
     * @param {number} id - Transaction ID
     */
    async deleteTransaction(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Pastikan transaksi ada
            const [transactions] = await connection.query(
                'SELECT * FROM transactions WHERE id = ?',
                [id]
            );
            if (transactions.length === 0) {
                const error = new Error(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
                error.status = 404;
                throw error;
            }
            await connection.query('DELETE FROM transactions WHERE id = ?', [id]);
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    /**
     * Refund a successful transaction (manual process)
     * @param {number} id - Transaction ID
     * @returns {object} Updated transaction with refund details
     */
    async refundTransaction(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Get transaction with lock
            const [transactions] = await connection.query(
                'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
                [id]
            );

            if (transactions.length === 0) {
                const error = new Error(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
                error.status = 404;
                throw error;
            }

            const transaction = transactions[0];

            // Check if already refunded
            if (transaction.status === 'REFUNDED') {
                const error = new Error('Transaksi sudah direfund sebelumnya');
                error.status = 400;
                throw error;
            }

            // Only SUCCESS transactions can be refunded
            if (transaction.status !== 'SUCCESS') {
                const error = new Error('Hanya transaksi SUCCESS yang dapat direfund');
                error.status = 400;
                throw error;
            }

            // Refund balance to user
            await connection.query(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [transaction.amount, transaction.user_id]
            );

            // Get user's new balance
            const [users] = await connection.query(
                'SELECT balance FROM users WHERE id = ?',
                [transaction.user_id]
            );

            // Update transaction status to REFUNDED
            await connection.query(
                "UPDATE transactions SET status = 'REFUNDED', notes = 'Transaksi direfund dan dana dikembalikan' WHERE id = ?",
                [id]
            );
            
            // Update rawtext status
            try {
                await connection.query(
                    "UPDATE rawtext SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?",
                    [id]
                );
            } catch (error) {
                console.error('Error updating rawtext status:', error);
            }

            await connection.commit();

            const updatedTransaction = await this.getTransactionById(id);

            return {
                ...updatedTransaction,
                refunded_amount: parseFloat(transaction.amount).toFixed(2),
                user_new_balance: parseFloat(users[0].balance).toFixed(2)
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    /**
     * Generate receipt text format
     */
    generateReceiptText(transaction, product, user, subtotal, tax) {
        const lines = [
            '================================',
            '       DIGIWALLET RECEIPT',
            '================================',
            '',
            `User: ${user.name}`,
            `Email: ${user.email}`,
            '',
            `Product: ${product.name}`,
            `Type: ${product.type}`,
            `Customer No: ${transaction.customer_number}`,
            '',
            `Reference: ${transaction.reference_number}`,
            `Status: ${transaction.status}`,
            '',
            '--------------------------------',
            'BILL DETAIL',
            '--------------------------------',
            `Subtotal  : Rp ${subtotal.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`,
            `Tax (11%) : Rp ${tax.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`,
            '--------------------------------',
            `Total     : Rp ${transaction.amount.toLocaleString('id-ID', { minimumFractionDigits: 2 })}`,
            '--------------------------------',
            '',
            `Date: ${new Date().toLocaleString('id-ID')}`,
            '',
            'Thank you for using DigiWallet',
            '================================'
        ];
        return lines.join('\n');
    }

    /**
     * Save receipt to rawtext table
     */
    async saveReceiptToRawtext(connection, transaction, user, product, subtotal, tax) {
        const receiptText = this.generateReceiptText(transaction, product, user, subtotal, tax);
        const receiptBlob = Buffer.from(receiptText, 'utf8');
        
        await connection.query(
            `INSERT INTO rawtext 
             (transaction_id, user_id, product_id, product_name, product_type, customer_number, subtotal, tax_amount, total_amount, reference_number, status, receipt_text, receipt_blob)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (transaction_id) DO UPDATE SET
             status = EXCLUDED.status, receipt_text = EXCLUDED.receipt_text, receipt_blob = EXCLUDED.receipt_blob, updated_at = CURRENT_TIMESTAMP`,
            [
                transaction.id || 0, user.id, product.id, product.name, product.type, transaction.customer_number,
                subtotal, tax, transaction.amount, transaction.reference_number, transaction.status,
                receiptText, receiptBlob
            ]
        );
    }

    /**
     * Generate unique reference number
     * @returns {string} Reference number
     */
    generateReferenceNumber() {
        const timestamp = Date.now().toString();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `TRX${timestamp}${random}`;
    }

    /**
     * Create new transaction (purchase PPOB product)
     * Uses database transaction for data consistency
     * @param {object} transactionData - Transaction data
     * @returns {object} Created transaction
     */
    async createTransaction(transactionData) {
        const { user_id, product_id, customer_number } = transactionData;
        
        // Get database connection for transaction
        const connection = await pool.getConnection();
        
        try {
            // Begin transaction
            await connection.beginTransaction();
            
            // 1. Validate user exists
            const [users] = await connection.query(
                'SELECT id, name, balance, monthly_limit FROM users WHERE id = ? FOR UPDATE',
                [user_id]
            );
            
            if (users.length === 0) {
                const error = new Error(ERROR_MESSAGES.USER_NOT_FOUND);
                error.status = 404;
                throw error;
            }
            
            const user = users[0];
            
            // 2. Validate product exists and is active
            const [products] = await connection.query(
                'SELECT id, name, type, price, is_active FROM products WHERE id = ?',
                [product_id]
            );
            
            if (products.length === 0) {
                const error = new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
                error.status = 404;
                throw error;
            }
            
            const product = products[0];
            
            if (!product.is_active) {
                const error = new Error(ERROR_MESSAGES.PRODUCT_NOT_ACTIVE);
                error.status = 400;
                throw error;
            }
            
            // 3. Calculate price with tax
            const subtotal = parseFloat(product.price);
            const tax = subtotal * TAX_RATE; // 11% tax
            const amount = subtotal + tax; // Total amount with tax
            const currentBalance = parseFloat(user.balance);
            
            // 4. Validate user balance
            if (currentBalance < amount) {
                const error = new Error(ERROR_MESSAGES.INSUFFICIENT_BALANCE);
                error.status = 400;
                throw error;
            }

            // 4.5. Check monthly limit if set
            const userLimit = parseFloat(user.monthly_limit || 0);
            if (userLimit > 0) {
                // Determine start of current month
                const startOfMonth = new Date();
                startOfMonth.setDate(1);
                startOfMonth.setHours(0, 0, 0, 0);

                const endOfMonth = new Date();
                endOfMonth.setMonth(endOfMonth.getMonth() + 1);
                endOfMonth.setDate(0);
                endOfMonth.setHours(23, 59, 59, 999);

                // calculate current spending
                const [spendingResult] = await connection.query(
                    `SELECT SUM(amount) as current_spending 
                     FROM transactions 
                     WHERE user_id = ? 
                       AND status IN ('SUCCESS', 'PENDING')
                       AND created_at >= ?
                       AND created_at <= ?`,
                    [user_id, startOfMonth, endOfMonth]
                );

                const currentSpending = parseFloat(spendingResult[0].current_spending || 0);
                if ((currentSpending + amount) > userLimit) {
                    const error = new Error(`Transaksi dibatalkan. Total pengeluaran bulanan Anda (${currentSpending + amount}) akan melebihi limit bulanan (${userLimit}).`);
                    error.status = 400;
                    throw error;
                }
            }
            
            // 5. Generate reference number
            const referenceNumber = this.generateReferenceNumber();
            
            // 6. Deduct user balance (total with tax)
            const newBalance = currentBalance - amount;
            await connection.query(
                'UPDATE users SET balance = ? WHERE id = ?',
                [newBalance, user_id]
            );
            
            // 7. Create transaction record with PENDING status
            const [result] = await connection.query(
                `INSERT INTO transactions 
                 (user_id, product_id, customer_number, amount, status, reference_number) 
                 VALUES (?, ?, ?, ?, 'PENDING', ?) RETURNING id`,
                [user_id, product_id, customer_number, amount, referenceNumber]
            );
            
            const transactionId = result[0].id;
            
            // 8. Save receipt to rawtext table
            try {
                const receiptText = this.generateReceiptText(
                    { 
                        id: transactionId,
                        customer_number: customer_number,
                        amount: amount,
                        reference_number: referenceNumber,
                        status: 'PENDING'
                    },
                    product,
                    user,
                    subtotal,
                    tax
                );
                const receiptBlob = Buffer.from(receiptText, 'utf8');
                
                await connection.query(
                    `INSERT INTO rawtext 
                     (transaction_id, user_id, product_id, product_name, product_type, customer_number, subtotal, tax_amount, total_amount, reference_number, status, receipt_text, receipt_blob)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        transactionId, user_id, product_id, product.name, product.type, customer_number,
                        subtotal, tax, amount, referenceNumber, 'PENDING',
                        receiptText, receiptBlob
                    ]
                );
            } catch (error) {
                console.error('Error saving receipt to rawtext:', error);
                // Continue even if rawtext save fails
            }
            
            // 9. Commit transaction
            await connection.commit();
            
            // Get the created transaction
            const createdTransaction = await this.getTransactionById(transactionId);
            
            // Add tax breakdown to response
            createdTransaction.subtotal = subtotal.toFixed(2);
            createdTransaction.tax = tax.toFixed(2);
            createdTransaction.tax_rate = '11%';
            
            // 9. Schedule auto-complete after 1 minute
            setTimeout(async () => {
                try {
                    // Check if transaction is still PENDING before auto-completing
                    const [currentStatus] = await pool.query(
                        'SELECT status FROM transactions WHERE id = ?',
                        [transactionId]
                    );
                    
                    if (currentStatus.length > 0 && currentStatus[0].status === 'PENDING') {
                        // Auto-complete to SUCCESS
                        await pool.query(
                            "UPDATE transactions SET status = 'SUCCESS', notes = 'Transaksi otomatis diselesaikan' WHERE id = ?",
                            [transactionId]
                        );
                        console.log(`Transaction ${transactionId} auto-completed to SUCCESS`);
                    }
                } catch (error) {
                    console.error(`Error auto-completing transaction ${transactionId}:`, error);
                }
            }, 1 * 60 * 1000); // 1 minute
            
            // Return transaction details
            return createdTransaction;
            
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            
            // If it's a known error, re-throw it
            if (error.status) {
                throw error;
            }
            
            // For unknown errors, wrap them
            console.error('Transaction error:', error);
            const transactionError = new Error(ERROR_MESSAGES.TRANSACTION_FAILED);
            transactionError.status = 500;
            throw transactionError;
            
        } finally {
            // Release connection back to pool
            connection.release();
        }
    }

    /**
     * Get transaction by ID with user and product details
     * @param {number} id - Transaction ID
     * @returns {object} Transaction data
     */
    async getTransactionById(id) {
        const [rows] = await pool.query(
            `SELECT 
                t.id,
                t.user_id,
                t.product_id,
                t.customer_number,
                t.amount,
                t.status,
                t.reference_number,
                t.notes,
                t.created_at,
                t.updated_at,
                u.name as user_name,
                u.email as user_email,
                p.name as product_name,
                p.type as product_type
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             JOIN products p ON t.product_id = p.id
             WHERE t.id = ?`,
            [id]
        );
        
        if (rows.length === 0) {
            const error = new Error(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
            error.status = 404;
            throw error;
        }
        
        const transaction = rows[0];
        
        // Calculate tax breakdown (11%)
        const amount = parseFloat(transaction.amount);
        const subtotal = amount / (1 + TAX_RATE);
        const tax = amount - subtotal;
        
        // Remove sensitive fields
        const { id: transactionId, user_id, user_email, product_id, ...filteredTransaction } = transaction;
        
        return {
            ...filteredTransaction,
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            receipt: this.formatReceipt(transaction)
        };
    }

    /**
     * Get transaction by reference number
     * @param {string} referenceNumber - Reference number
     * @returns {object} Transaction data
     */
    async getTransactionByReference(referenceNumber) {
        const [rows] = await pool.query(
            `SELECT 
                t.id,
                t.user_id,
                t.product_id,
                t.customer_number,
                t.amount,
                t.status,
                t.reference_number,
                t.notes,
                t.created_at,
                t.updated_at,
                u.name as user_name,
                u.email as user_email,
                p.name as product_name,
                p.type as product_type
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             JOIN products p ON t.product_id = p.id
             WHERE t.reference_number = ?`,
            [referenceNumber]
        );
        
        if (rows.length === 0) {
            const error = new Error(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
            error.status = 404;
            throw error;
        }
        
        const transaction = rows[0];
        
        // Calculate tax breakdown (11%)
        const amount = parseFloat(transaction.amount);
        const subtotal = amount / (1 + TAX_RATE);
        const tax = amount - subtotal;
        
        // Remove sensitive fields
        const { id: transactionId, user_id, user_email, ...filteredTransaction } = transaction;
        
        return {
            ...filteredTransaction,
            subtotal: subtotal.toFixed(2),
            tax: tax.toFixed(2),
            receipt: this.formatReceipt(transaction)
        };
    }

    /**
     * Get all transactions with pagination and filters
     * @param {object} options - Query options
     * @returns {object} Transactions list with pagination info
     */
    async getTransactions(options = {}) {
        const { 
            page = 1, 
            limit = 5, 
            user_id = null,
            product_id = null,
            status = null,
            start_date = null,
            end_date = null
        } = options;
        
        const offset = (page - 1) * limit;
        
        // Build where clause
        const conditions = [];
        const values = [];
        
        if (user_id) {
            conditions.push('t.user_id = ?');
            values.push(user_id);
        }
        
        if (product_id) {
            conditions.push('t.product_id = ?');
            values.push(product_id);
        }
        
        if (status) {
            conditions.push('t.status = ?');
            values.push(status);
        }
        
        if (start_date) {
            conditions.push('t.created_at >= ?');
            values.push(start_date);
        }
        
        if (end_date) {
            conditions.push('t.created_at <= ?');
            values.push(end_date + ' 23:59:59');
        }
        
        const whereClause = conditions.length > 0 
            ? 'WHERE ' + conditions.join(' AND ') 
            : '';
        
        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM transactions t ${whereClause}`,
            values
        );
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);
        
        // Get transactions
        const [rows] = await pool.query(
            `SELECT 
                t.id,
                t.user_id,
                t.product_id,
                t.customer_number,
                t.amount,
                t.status,
                t.reference_number,
                t.notes,
                t.created_at,
                t.updated_at,
                u.name as user_name,
                u.email as user_email,
                p.name as product_name,
                p.type as product_type
             FROM transactions t
             JOIN users u ON t.user_id = u.id
             JOIN products p ON t.product_id = p.id
             ${whereClause}
             ORDER BY t.created_at DESC 
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
     * Get transactions by user ID
     * @param {number} userId - User ID
     * @param {object} options - Query options
     * @returns {object} Transactions list
     */
    async getTransactionsByUser(userId, options = {}) {
        return this.getTransactions({ ...options, user_id: userId });
    }

    /**
     * Cancel/Refund a pending transaction (manual process)
     * @param {number} id - Transaction ID
     * @returns {object} Updated transaction with refund details
     */
    async cancelTransaction(id) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Get transaction with lock
            const [transactions] = await connection.query(
                'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
                [id]
            );
            
            if (transactions.length === 0) {
                const error = new Error(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
                error.status = 404;
                throw error;
            }
            
            const transaction = transactions[0];
            
            // Check if already cancelled
            if (transaction.status === 'FAILED' && transaction.notes && transaction.notes.includes('Dibatalkan')) {
                const error = new Error('Transaksi sudah dibatalkan sebelumnya');
                error.status = 400;
                throw error;
            }

            // Only PENDING transactions can be cancelled
            if (transaction.status !== 'PENDING') {
                const error = new Error('Hanya transaksi PENDING yang dapat dibatalkan');
                error.status = 400;
                throw error;
            }
            
            // Refund balance to user
            await connection.query(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [transaction.amount, transaction.user_id]
            );
            
            // Get user's new balance
            const [users] = await connection.query(
                'SELECT balance FROM users WHERE id = ?',
                [transaction.user_id]
            );
            
            // Update transaction status to FAILED (refunded)
            await connection.query(
                "UPDATE transactions SET status = 'FAILED', notes = 'Dibatalkan dan dana dikembalikan' WHERE id = ?",
                [id]
            );
            
            // Update rawtext status
            try {
                await connection.query(
                    "UPDATE rawtext SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?",
                    [id]
                );
            } catch (error) {
                console.error('Error updating rawtext status:', error);
            }
            
            await connection.commit();
            
            const updatedTransaction = await this.getTransactionById(id);
            
            return {
                ...updatedTransaction,
                refunded_amount: parseFloat(transaction.amount).toFixed(2),
                user_new_balance: parseFloat(users[0].balance).toFixed(2)
            };
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Complete/Mark transaction as SUCCESS (admin only)
     * @param {number} id - Transaction ID
     * @returns {object} Updated transaction
     */
    async completeTransaction(id) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Get transaction with lock
            const [transactions] = await connection.query(
                'SELECT * FROM transactions WHERE id = ? FOR UPDATE',
                [id]
            );
            
            if (transactions.length === 0) {
                const error = new Error(ERROR_MESSAGES.TRANSACTION_NOT_FOUND);
                error.status = 404;
                throw error;
            }
            
            const transaction = transactions[0];
            
            // Check if already SUCCESS
            if (transaction.status === 'SUCCESS') {
                const error = new Error('Transaksi sudah berstatus SUCCESS');
                error.status = 400;
                throw error;
            }
            
            // Check if transaction is cancelled or failed
            if (transaction.status === 'FAILED' || transaction.status === 'REFUNDED') {
                const error = new Error('Transaksi yang sudah dibatalkan atau direfund tidak dapat diselesaikan');
                error.status = 400;
                throw error;
            }
            
            // Only PENDING transactions can be marked as SUCCESS
            if (transaction.status !== 'PENDING') {
                const error = new Error('Hanya transaksi PENDING yang dapat diselesaikan');
                error.status = 400;
                throw error;
            }
            
            // Update transaction status to SUCCESS
            await connection.query(
                "UPDATE transactions SET status = 'SUCCESS', notes = 'Transaksi diselesaikan oleh admin' WHERE id = ?",
                [id]
            );
            
            // Update rawtext status
            try {
                await connection.query(
                    "UPDATE rawtext SET status = 'SUCCESS', updated_at = CURRENT_TIMESTAMP WHERE transaction_id = ?",
                    [id]
                );
            } catch (error) {
                console.error('Error updating rawtext status:', error);
            }
            
            await connection.commit();
            
            return await this.getTransactionById(id);
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Format transaction data as receipt (struk belanja)
     * @param {object} transaction - Transaction data
     * @returns {array} Formatted receipt as array of lines
     */
    formatReceipt(transaction) {
        // Format date and time
        const date = new Date(transaction.created_at);
        const formattedDate = date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Calculate amounts
        const amount = parseFloat(transaction.amount);
        const subtotal = amount / (1 + TAX_RATE);
        const tax = amount - subtotal;

        // Format currency
        const formatRupiah = (value) => `Rp ${parseFloat(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        // Build receipt as array of lines
        const receipt = [
            'DIGIWALLET PPOB - Struk Transaksi',
            '',
            `Tanggal         : ${formattedDate}`,
            `Waktu           : ${formattedTime}`,
            `No. Referensi   : ${transaction.reference_number}`,
            `Status          : ${transaction.status}`,
            '',
            `Pelanggan       : ${transaction.user_name}`,
            '',
            `Produk          : ${transaction.product_name}`,
            `Kategori        : ${transaction.product_type}`,
            `No. Pelanggan   : ${transaction.customer_number}`,
            '',
            `Subtotal        : ${formatRupiah(subtotal)}`,
            `Pajak (11%)     : ${formatRupiah(tax)}`,
            `Total Bayar     : ${formatRupiah(amount)}`,
            '',
            'Terima kasih telah menggunakan DigiWallet'
        ];

        if (transaction.notes) {
            receipt.push(`Catatan: ${transaction.notes}`);
        }

        return receipt;
    }

    /**
     * Get receipt from rawtext table
     * @param {number} transactionId - Transaction ID
     * @returns {object} Receipt data
     */
    async getReceipt(transactionId) {
        const [rows] = await pool.query(
            `SELECT id, transaction_id, user_id, product_id, product_name, product_type, customer_number, 
                    subtotal, tax_amount, total_amount, reference_number, status, receipt_text, created_at, updated_at
             FROM rawtext WHERE transaction_id = ?`,
            [transactionId]
        );

        if (rows.length === 0) {
            const error = new Error('Receipt tidak ditemukan');
            error.status = 404;
            throw error;
        }

        return rows[0];
    }
}

module.exports = new TransactionService();
