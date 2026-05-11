/**
 * Validator Utility Module
 * Validasi input untuk semua endpoint
 */

const { body, param, query, validationResult } = require('express-validator');
const { validationErrorResponse, HTTP_STATUS, ERROR_MESSAGES } = require('./respons');

// =============================================
// VALIDATION MIDDLEWARE
// =============================================

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
        }));
        return validationErrorResponse(res, formattedErrors);
    }
    next();
};

// =============================================
// USER VALIDATION RULES
// =============================================

const createUserValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nama wajib diisi')
        .isLength({ min: 2, max: 100 }).withMessage('Nama harus 2-100 karakter'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email wajib diisi')
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('phone_number')
        .optional({ nullable: true })
        .trim()
        .matches(/^\+?[0-9\-\s]{8,20}$/).withMessage('Nomor telepon harus 8-20 digit (boleh dengan + atau -)'),
    body('balance')
        .optional()
        .isFloat({ min: 0 }).withMessage('Saldo tidak boleh negatif'),
    handleValidationErrors
];

const updateUserValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID user tidak valid'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Nama harus 2-100 karakter'),
    body('email')
        .optional()
        .trim()
        .isEmail().withMessage('Format email tidak valid')
        .normalizeEmail(),
    body('phone_number')
        .optional({ nullable: true })
        .trim()
        .matches(/^\+?[0-9\-\s]{8,20}$/).withMessage('Nomor telepon harus 8-20 digit (boleh dengan + atau -)'),
    body('balance')
        .optional()
        .isFloat({ min: 0 }).withMessage('Saldo tidak boleh negatif'),
    body('monthly_limit')
        .optional()
        .isFloat({ min: 0 }).withMessage('Limit bulanan tidak boleh negatif'),
    handleValidationErrors
];

const getUserValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID user tidak valid'),
    handleValidationErrors
];

const listUsersValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page harus angka positif'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit harus 1-100'),
    handleValidationErrors
];

// =============================================
// PRODUCT VALIDATION RULES
// =============================================

const productTypes = ['pulsa', 'data', 'pln', 'pdam', 'internet', 'game', 'ewallet'];

const createProductValidation = [
    body('name')
        .trim()
        .notEmpty().withMessage('Nama produk wajib diisi')
        .isLength({ min: 2, max: 100 }).withMessage('Nama produk harus 2-100 karakter'),
    body('category_id')
        .optional({ nullable: true })
        .isInt({ min: 1 }).withMessage('Category ID tidak valid'),
    body('type')
        .trim()
        .notEmpty().withMessage('Tipe produk wajib diisi')
        .isIn(productTypes).withMessage(`Tipe produk harus salah satu dari: ${productTypes.join(', ')}`),
    body('price')
        .notEmpty().withMessage('Harga wajib diisi')
        .isFloat({ min: 0 }).withMessage('Harga tidak boleh negatif'),
    body('description')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 1000 }).withMessage('Deskripsi maksimal 1000 karakter'),
    body('is_active')
        .optional()
        .isBoolean().withMessage('Status aktif harus boolean'),
    handleValidationErrors
];

const updateProductValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID produk tidak valid'),
    body('name')
        .optional()
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('Nama produk harus 2-100 karakter'),
    body('category_id')
        .optional({ nullable: true })
        .custom((value) => {
            if (value === null || value === '' || value === 0) return true;
            return Number.isInteger(parseInt(value)) && parseInt(value) > 0;
        }).withMessage('Category ID tidak valid'),
    body('type')
        .optional()
        .trim()
        .isIn(productTypes).withMessage(`Tipe produk harus salah satu dari: ${productTypes.join(', ')}`),
    body('price')
        .optional()
        .isFloat({ min: 0 }).withMessage('Harga tidak boleh negatif'),
    body('description')
        .optional({ nullable: true })
        .trim()
        .isLength({ max: 1000 }).withMessage('Deskripsi maksimal 1000 karakter'),
    body('is_active')
        .optional()
        .isBoolean().withMessage('Status aktif harus boolean'),
    handleValidationErrors
];

const getProductValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID produk tidak valid'),
    handleValidationErrors
];

const listProductsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page harus angka positif'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit harus 1-100'),
    query('type')
        .optional()
        .isIn(productTypes).withMessage(`Tipe produk harus salah satu dari: ${productTypes.join(', ')}`),
    query('category_id')
        .optional()
        .isInt({ min: 1 }).withMessage('Category ID tidak valid'),
    query('is_active')
        .optional()
        .isBoolean().withMessage('Status aktif harus boolean'),
    handleValidationErrors
];

// =============================================
// TRANSACTION VALIDATION RULES
// =============================================

const createTransactionValidation = [
    body('user_id')
        .optional()
        .isInt({ min: 1 }).withMessage('User ID tidak valid'),
    body('product_id')
        .notEmpty().withMessage('Product ID wajib diisi')
        .isInt({ min: 1 }).withMessage('Product ID tidak valid'),
    body('customer_number')
        .trim()
        .notEmpty().withMessage('Nomor pelanggan wajib diisi')
        .isLength({ min: 5, max: 50 }).withMessage('Nomor pelanggan harus 5-50 karakter'),
    handleValidationErrors
];

const getTransactionValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID transaksi tidak valid'),
    handleValidationErrors
];

const listTransactionsValidation = [
    query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page harus angka positif'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit harus 1-100'),
    query('user_id')
        .optional()
        .isInt({ min: 1 }).withMessage('User ID tidak valid'),
    query('product_id')
        .optional()
        .isInt({ min: 1 }).withMessage('Product ID tidak valid'),
    query('status')
        .optional()
        .isIn(['PENDING', 'SUCCESS', 'FAILED']).withMessage('Status harus PENDING, SUCCESS, atau FAILED'),
    query('start_date')
        .optional()
        .isISO8601().withMessage('Format tanggal mulai tidak valid (YYYY-MM-DD)'),
    query('end_date')
        .optional()
        .isISO8601().withMessage('Format tanggal akhir tidak valid (YYYY-MM-DD)'),
    handleValidationErrors
];

// =============================================
// REPORT VALIDATION RULES
// =============================================

const reportDateRangeValidation = [
    query('start_date')
        .optional()
        .isISO8601().withMessage('Format tanggal mulai tidak valid (YYYY-MM-DD)'),
    query('end_date')
        .optional()
        .isISO8601().withMessage('Format tanggal akhir tidak valid (YYYY-MM-DD)'),
    handleValidationErrors
];

module.exports = {
    handleValidationErrors,
    // User validations
    createUserValidation,
    updateUserValidation,
    getUserValidation,
    listUsersValidation,
    // Product validations
    createProductValidation,
    updateProductValidation,
    getProductValidation,
    listProductsValidation,
    // Transaction validations
    createTransactionValidation,
    getTransactionValidation,
    listTransactionsValidation,
    // Report validations
    reportDateRangeValidation
};