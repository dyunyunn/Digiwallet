/**
 * Product Controller
 * Handles HTTP requests untuk product endpoints
 */

const e = require('cors');
const productService = require('../services/productService');
const { 
    successResponse, 
    errorResponse, 
    paginatedResponse,
    HTTP_STATUS,
    SUCCESS_MESSAGES,
    ERROR_MESSAGES 
} = require('../utils/respons');

class ProductController {
        // handleError removed (reverting to original error handling)
    /**
     * Create new product
     * POST /api/products
     */
    async createProduct(req, res) {
        try {
            const product = await productService.createProduct(req.body);
            return successResponse(
                res, 
                product, 
                SUCCESS_MESSAGES.PRODUCT_CREATED, 
                HTTP_STATUS.CREATED
            );
        } catch (error) {
            return errorResponse(
                res,
                error && error.message ? error.message : 'Terjadi kesalahan',
                error && error.status ? error.status : HTTP_STATUS.INTERNAL_SERVER_ERROR,
                error && error.details ? error.details : null,
                error
            );
        }
    }

    /**
     * Get all products with pagination and filters
     * GET /api/products
     */
    getProducts = async (req, res) => {
        try {
            const options = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                type: req.query.type || null,
                category_id: req.query.category_id ? parseInt(req.query.category_id) : null,
                is_active: req.query.is_active !== undefined ? req.query.is_active : null,
                search: req.query.search || null,
                sortBy: req.query.sortBy || 'p.created_at',
                sortDir: req.query.sortDir || 'DESC',
                price_min: req.query.price_min || null,
                price_max: req.query.price_max || null
            };
            const result = await productService.getProducts(options);
            
                // Filter fields for USER role or unauthenticated callers (public browsing)
                if (!req.user || req.user.role === 'USER') {
                    result.data = result.data.map(product => this.filterProductFields(product));
            }
            
            return paginatedResponse(
                res, 
                result.data, 
                result.pagination, 
                SUCCESS_MESSAGES.PRODUCTS_FETCHED
            );
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
     * Get product by ID
     * GET /api/products/:id
     */
    getProductById = async (req, res) => {
        try {
            let product = await productService.getProductById(parseInt(req.params.id));
            
                // Filter fields for USER role or unauthenticated callers
                if (!req.user || req.user.role === 'USER') {
                    product = this.filterProductFields(product);
            }
            
            return successResponse(res, product, SUCCESS_MESSAGES.PRODUCT_FETCHED);
        } catch (error) {
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
     * Update product
     * PUT /api/products/:id
     */
    async updateProduct(req, res) {
        try {
            const product = await productService.updateProduct(
                parseInt(req.params.id), 
                req.body
            );
            return successResponse(res, product, SUCCESS_MESSAGES.PRODUCT_UPDATED);
        } catch (error) {
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
     * Delete product
     * DELETE /api/products/:id?hard=true
     */
    async deleteProduct(req, res) {
        try {
            const isHardDelete = req.query.hard === 'true';
            await productService.deleteProduct(parseInt(req.params.id), isHardDelete);
            return successResponse(
                res, 
                null, 
                isHardDelete ? 'Produk berhasil dihapus secara permanen (hard delete)' : 'Produk berhasil dihapus (soft delete)'
            );
        } catch (error) {
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
     * Get products by type
     * GET /api/products/type/:type
     */
    getProductsByType = async (req, res) => {
        try {
            let products = await productService.getProductsByType(req.params.type);
            
                // Filter fields for USER role or unauthenticated callers
                if (!req.user || req.user.role === 'USER') {
                    products = products.map(product => this.filterProductFields(product));
            }
            
            return successResponse(res, products, SUCCESS_MESSAGES.PRODUCTS_FETCHED);
        } catch (error) {
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
     * Toggle product status (active/inactive)
     * PATCH /api/products/:id/toggle-status
     */
    async toggleProductStatus(req, res) {
        try {
            const product = await productService.toggleProductStatus(parseInt(req.params.id));
            const message = product.is_active 
                ? 'Produk berhasil diaktifkan' 
                : 'Produk berhasil dinonaktifkan';
            return successResponse(res, product, message);
        } catch (error) {
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
     * Filter product fields for USER role
     * Show fields needed for browsing & purchasing, hide internal/admin fields
     */
    filterProductFields(product) {
        if (!product) return product;
        
        return {
            id: product.id,
            name: product.name,
            description: product.description,
            price: product.price,
            type: product.type,
            is_active: product.is_active
        };
    }
}

module.exports = new ProductController();
