const transactionService = require('../services/transactionService');
const { 
    successResponse, 
    errorResponse, 
    paginatedResponse,
    HTTP_STATUS,
    SUCCESS_MESSAGES,
    ERROR_MESSAGES 
} = require('../utils/respons');
const { transactionCreatedTotal, transactionAmountTotal } = require('../utils/metrics');

class TransactionController {
    /**
     * Delete transaction by ID
     * DELETE /api/transactions/:id
     */
    deleteTransaction = async (req, res) => {
        try {
            await transactionService.deleteTransaction(parseInt(req.params.id));
            return successResponse(res, null, 'Transaksi berhasil dihapus');
        } catch (error) {
            return errorResponse(
                res,
                error && error.message ? error.message : 'Terjadi kesalahan',
                error && error.status ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Create new transaction (purchase PPOB product)
     * POST /api/transactions
     */
    createTransaction = async (req, res) => {
        try {
            // Ensure server-side user identity is used when client doesn't provide user_id
            const payload = { ...req.body };
            if (!payload.user_id && req.user && req.user.id) {
                payload.user_id = req.user.id;
            }
            const transaction = await transactionService.createTransaction(payload);
            transactionCreatedTotal.inc({ result: 'success' });
            if (transaction && transaction.total_price) {
                transactionAmountTotal.inc(
                    { status: transaction.status || 'SUCCESS' },
                    Number(transaction.total_price)
                );
            }
            return successResponse(
                res, 
                transaction, 
                SUCCESS_MESSAGES.TRANSACTION_SUCCESS, 
                HTTP_STATUS.CREATED
            );
        } catch (error) {
            transactionCreatedTotal.inc({ result: 'failed' });
            return errorResponse(
                res,
                error && error.message ? error.message : 'Terjadi kesalahan',
                error && error.status ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error && error.details ? error.details : error,
                error
            );
        }
    }

    /**
     * Get all transactions with pagination and filters
     * GET /api/transactions
     */
    getTransactions = async (req, res) => {
        try {
            const options = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                user_id: req.query.user_id ? parseInt(req.query.user_id) : null,
                product_id: req.query.product_id ? parseInt(req.query.product_id) : null,
                status: req.query.status || null,
                start_date: req.query.start_date || null,
                end_date: req.query.end_date || null
            };
            
            const result = await transactionService.getTransactions(options);
            
            // Filter data for USER role
            if (req.user && req.user.role === 'USER') {
                result.data = this.filterTransactionListFields(result.data);
            }
            
            return paginatedResponse(
                res, 
                result.data, 
                result.pagination, 
                SUCCESS_MESSAGES.TRANSACTIONS_FETCHED
            );
        } catch (error) {
            return errorResponse(
                res, 
                error && error.message ? error.message : 'Terjadi kesalahan',
                error && error.status ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error && error.details ? error.details : error
            );
        }
    }

    /**
     * Get transaction by ID
     * GET /api/transactions/:id
     */
    getTransactionById = async (req, res) => {
        try {
            const transaction = await transactionService.getTransactionById(parseInt(req.params.id));
            return successResponse(res, transaction, SUCCESS_MESSAGES.TRANSACTION_FETCHED);
        } catch (error) {
            return errorResponse(
                res, 
                error.message, 
                error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Get transaction by reference number
     * GET /api/transactions/reference/:reference
     */
    getTransactionByReference = async (req, res) => {
        try {
            const transaction = await transactionService.getTransactionByReference(req.params.reference);
            return successResponse(res, transaction, SUCCESS_MESSAGES.TRANSACTION_FETCHED);
        } catch (error) {
            return errorResponse(
                res, 
                error.message, 
                error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Get transactions by user
     * GET /api/transactions/user/:userId
     */
    getTransactionsByUser = async (req, res) => {
        try {
            const options = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                status: req.query.status || null,
                start_date: req.query.start_date || null,
                end_date: req.query.end_date || null
            };
            
            const result = await transactionService.getTransactionsByUser(
                parseInt(req.params.userId),
                options
            );
            
            // Filter data for USER role
            if (req.user && req.user.role === 'USER') {
                result.data = this.filterTransactionListFields(result.data);
            }
            
            return paginatedResponse(
                res, 
                result.data, 
                result.pagination, 
                SUCCESS_MESSAGES.TRANSACTIONS_FETCHED
            );
        } catch (error) {
            return errorResponse(
                res, 
                error.message, 
                error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Cancel transaction (only for PENDING)
     * PATCH /api/transactions/:id/cancel
     */
    cancelTransaction = async (req, res) => {
        try {
            const transaction = await transactionService.cancelTransaction(parseInt(req.params.id));
            return successResponse(res, transaction, 'Transaksi berhasil dibatalkan dan dana dikembalikan');
        } catch (error) {
            return errorResponse(
                res, 
                error.message, 
                error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Refund transaction (only for SUCCESS)
     * PATCH /api/transactions/:id/refund
     */
    refundTransaction = async (req, res) => {
        try {
            const transaction = await transactionService.refundTransaction(parseInt(req.params.id));
            return successResponse(res, transaction, 'Transaksi berhasil direfund dan dana dikembalikan');
        } catch (error) {
            return errorResponse(
                res, 
                error.message, 
                error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Complete transaction (mark as SUCCESS) - Admin only
     * PATCH /api/transactions/:id/complete
     */
    completeTransaction = async (req, res) => {
        try {
            const transaction = await transactionService.completeTransaction(parseInt(req.params.id));
            return successResponse(res, transaction, 'Transaksi berhasil diselesaikan dan diubah menjadi SUCCESS');
        } catch (error) {
            return errorResponse(
                res, 
                error.message, 
                error.status || HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Get receipt by transaction ID
     * GET /api/transactions/:id/receipt
     */
    getReceipt = async (req, res) => {
        try {
            const receipt = await transactionService.getReceipt(parseInt(req.params.id));
            return successResponse(res, receipt, 'Receipt berhasil diambil');
        } catch (error) {
            return errorResponse(
                res,
                error && error.message ? error.message : 'Terjadi kesalahan',
                error && error.status ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error
            );
        }
    }

    /**
     * Filter transaction list to show only allowed fields
     * @param {Array} transactions - List of transactions
     * @returns {Array} Filtered transactions
     */
    filterTransactionListFields = (transactions) => {
        return transactions.map(transaction => ({
            id: transaction.id,
            product_name: transaction.product_name,
            product_type: transaction.product_type,
            product_id: transaction.product_id,
            customer_number: transaction.customer_number,
            created_at: transaction.created_at,
            purchase_date: transaction.created_at,
            amount: transaction.amount,
            status: transaction.status,
            reference_number: transaction.reference_number
        }));
    }
}

module.exports = new TransactionController();
