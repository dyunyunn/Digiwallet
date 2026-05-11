// Admin only: set user role (moved after router initialization)
/**
 * User Routes
 * API endpoints untuk operasi user
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { 
    createUserValidation, 
    updateUserValidation, 
    getUserValidation,
    listUsersValidation 
} = require('../utils/validator');
const { authMiddleware } = require('../middleware/auth');

/**
 * @route   POST /api/users
 * @desc    Create new user (Registration)
 * @access  Public (only when not logged in)
 */
router.post('/', (req, res, next) => {
    // Check if user is already logged in
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ message: 'Tidak dapat membuat user: Anda sudah login' });
    }
    next();
}, createUserValidation, userController.createUser);

/**
 * @route   GET /api/users
 * @desc    Get all users with pagination
 * @access  Public
 */
// Only admin can get all users
router.get('/', authMiddleware, (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Hanya admin yang dapat mengakses' });
    }
    next();
}, listUsersValidation, userController.getUsers);

/**
 * @route   GET /api/users/me
 * @desc    Get current logged-in user's profile
 * @access  Authenticated users
 */
router.get('/me', authMiddleware, (req, res, next) => {
    next();
}, userController.getMyProfile);

/**
 * @route   PUT /api/users/me
 * @desc    Update current logged-in user's profile
 * @access  Authenticated users
 */
router.put('/me', authMiddleware, (req, res, next) => {
    // Inject user ID to params for validation and controller
    req.params.id = req.user.id;
    next();
}, updateUserValidation, userController.updateUser);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Public
 */
// User can get own data, admin can get any
router.get('/:id', authMiddleware, getUserValidation, (req, res, next) => {
    if (req.user.role !== 'ADMIN' && req.user.id !== parseInt(req.params.id)) {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Hanya dapat mengakses data sendiri' });
    }
    next();
}, userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Public
 */
// User can update own data, admin can update any except password/email
router.put('/:id', authMiddleware, updateUserValidation, (req, res, next) => {
    const isSelf = req.user.id === parseInt(req.params.id);
    if (req.user.role !== 'ADMIN' && !isSelf) {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Hanya dapat mengubah data sendiri' });
    }
    // Admin can only update their own username, email, and password
    if (req.user.role === 'ADMIN' && !isSelf && (req.body.password || req.body.email || req.body.name)) {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Admin hanya dapat mengubah username, email, dan password milik sendiri' });
    }
    next();
}, userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user
 * @access  Public
 */
// Only admin can delete users
router.delete('/:id', authMiddleware, (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Hanya admin yang dapat menghapus user' });
    }
    next();
}, getUserValidation, userController.deleteUser);

/**
 * @route   POST /api/users/me/topup
 * @desc    Top up current user's balance
 * @access  Authenticated user
 */
router.post('/me/topup', authMiddleware, (req, res, next) => {
    // Any authenticated USER can top up their own account
    next();
}, userController.topUpMe);

/**
 * @route   POST /api/users/:id/topup
 * @desc    Add balance to user (Top Up)
 * @access  USER (own) or ADMIN (any)
 */
router.post('/:id/topup', authMiddleware, (req, res, next) => {
    const isSelf = req.user.id === parseInt(req.params.id);
    if (req.user.role !== 'ADMIN' && !isSelf) {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Hanya dapat top up saldo sendiri' });
    }
    next();
}, getUserValidation, userController.topUpBalance);

// Admin only: set user role
router.patch('/:id/role', authMiddleware, (req, res, next) => {
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Tidak memiliki wewenang: Hanya admin yang dapat mengubah role user' });
    }
    next();
}, userController.setUserRole);

module.exports = router;
