/**
 * Product Service
 * Business logic untuk operasi produk PPOB
 */

const { pool } = require('../database/config');
const { ERROR_MESSAGES } = require('../utils/respons');
const { toTitleCase } = require('../utils/capitalize');

class ProductService {
    /**
     * Create new product
     * @param {object} productData - Product data
     * @returns {object} Created product
     */
    async createProduct(productData) {
        const { name, category_id, type, price, description, is_active = true } = productData;
        // Pastikan kapitalisasi nama produk
        const fixedName = toTitleCase(name);
        // Cek duplikasi produk berdasarkan nama (dan kategori jika diperlukan)
        let duplicateQuery = 'SELECT id FROM products WHERE name = ? AND deleted_at IS NULL';
        let duplicateParams = [fixedName];
        if (category_id) {
            duplicateQuery += ' AND category_id = ?';
            duplicateParams.push(category_id);
        }
        const [dupes] = await pool.query(duplicateQuery, duplicateParams);
        if (dupes.length > 0) {
            const error = new Error('Produk dengan nama yang sama sudah ada.');
            error.status = 409;
            throw error;
        }
        // Validate category exists if provided
        if (category_id) {
            const [category] = await pool.query(
                'SELECT id FROM categories WHERE id = ?',
                [category_id]
            );
            if (category.length === 0) {
                const error = new Error('Category tidak ditemukan');
                error.status = 404;
                throw error;
            }
        }
        const [result] = await pool.query(
            `INSERT INTO products (name, category_id, type, price, description, is_active) 
             VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
            [fixedName, category_id || null, type, price, description || null, is_active]
        );
        return this.getProductById(result[0].id);
    }

    /**
     * Get all products with pagination and filters
     * @param {object} options - Query options
     * @returns {object} Products list with pagination info
     */
    async getProducts(options = {}) {
        const { 
            page = 1, 
            limit = 10, 
            type = null, 
            category_id = null,
            is_active = null,
            search = null,
            sortBy = 'p.created_at',
            sortDir = 'DESC',
            price_min = null,
            price_max = null
        } = options;
        const offset = (page - 1) * limit;
        // Build where clause
        const conditions = ['p.deleted_at IS NULL'];
        const values = [];
        if (type) {
            conditions.push('p.type = ?');
            values.push(type);
        }
        if (category_id) {
            conditions.push('p.category_id = ?');
            values.push(category_id);
        }
        if (is_active !== null) {
            conditions.push('p.is_active = ?');
            values.push(is_active === 'true' || is_active === true ? 1 : 0);
        }
        if (search) {
            conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
            values.push(`%${search}%`, `%${search}%`);
        }
        if (price_min !== null) {
            conditions.push('p.price >= ?');
            values.push(price_min);
        }
        if (price_max !== null) {
            conditions.push('p.price <= ?');
            values.push(price_max);
        }
        const whereClause = conditions.length > 0 
            ? 'WHERE ' + conditions.join(' AND ') 
            : '';
        // Get total count
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM products p ${whereClause}`,
            values
        );
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);
        // Get products with category info
        const [rows] = await pool.query(
            `SELECT p.id, p.name, p.category_id, c.name as category_name, p.type, p.price, p.description, p.is_active, p.created_at, p.updated_at 
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
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
     * Get product by ID
     * @param {number} id - Product ID
     * @returns {object|null} Product data
     */
    async getProductById(id) {
        const [rows] = await pool.query(
            `SELECT p.id, p.name, p.category_id, c.name as category_name, p.type, p.price, p.description, p.is_active, p.created_at, p.updated_at 
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ? AND p.deleted_at IS NULL`,
            [id]
        );
        
        if (rows.length === 0) {
            const error = new Error(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
            error.status = 404;
            throw error;
        }
        
        return rows[0];
    }

    /**
     * Get active product by ID (for transactions)
     * @param {number} id - Product ID
     * @returns {object} Active product data
     */
    async getActiveProductById(id) {
        const product = await this.getProductById(id);
        
        if (!product.is_active) {
            const error = new Error(ERROR_MESSAGES.PRODUCT_NOT_ACTIVE);
            error.status = 400;
            throw error;
        }
        
        return product;
    }

    /**
     * Update product
     * @param {number} id 
     * @param {object} productData - 
     * @returns {object} 
     */
    async updateProduct(id, productData) {
        // Check if product exists
        await this.getProductById(id);
        
        const { name, category_id, type, price, description, is_active } = productData;
        
        // Validate category exists if provided
        if (category_id) {
            const [category] = await pool.query(
                'SELECT id FROM categories WHERE id = ?',
                [category_id]
            );
            if (category.length === 0) {
                const error = new Error('Category tidak ditemukan');
                error.status = 404;
                throw error;
            }
        }
        
  
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(toTitleCase(name));
        }
        if (category_id !== undefined) {
            updates.push('category_id = ?');
            values.push(category_id || null);
        }
        if (type !== undefined) {
            updates.push('type = ?');
            values.push(type);
        }
        if (price !== undefined) {
            updates.push('price = ?');
            values.push(price);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        if (is_active !== undefined) {
            updates.push('is_active = ?');
            values.push(is_active);
        }
        
        if (updates.length > 0) {
            values.push(id);
            await pool.query(
                `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
        
        return this.getProductById(id);
    }

    /**
     * Delete product (Soft / Hard Delete)
     * @param {number} id - Product ID
     * @param {boolean} isHardDelete - Hard delete flag
     * @returns {boolean} Success status
     */
    async deleteProduct(id, isHardDelete = false) {
        // Check if product exists
        await this.getProductById(id);
        
        // Check if product has transactions
        const [transactions] = await pool.query(
            'SELECT id FROM transactions WHERE product_id = ? LIMIT 1',
            [id]
        );
        
        if (transactions.length > 0) {
            if (isHardDelete) {
                const error = new Error('Produk tidak dapat di-hard-delete karena sudah memiliki transaksi');
                error.status = 400;
                throw error;
            } else {
                // Soft delete
                await pool.query('UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                return true;
            }
        }
        
        if (isHardDelete) {
            await pool.query('DELETE FROM products WHERE id = ?', [id]);
        } else {
            await pool.query('UPDATE products SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
        }
        
        return true;
    }

    /**
     * Get products by type
     * @param {string} type - Product type
     * @returns {array} Products list
     */
    async getProductsByType(type) {
        const [rows] = await pool.query(
            `SELECT id, name, type, price, description, is_active, created_at, updated_at 
             FROM products 
             WHERE type = ? AND is_active = TRUE AND deleted_at IS NULL
             ORDER BY price ASC`,
            [type]
        );
        
        return rows;
    }

    /**
     * Toggle product status
     * @param {number} id - Product ID
     * @returns {object} Updated product
     */
    async toggleProductStatus(id) {
        const product = await this.getProductById(id);
        
        await pool.query(
            'UPDATE products SET is_active = ? WHERE id = ?',
            [!product.is_active, id]
        );
        
        return this.getProductById(id);
    }
}

module.exports = new ProductService();
