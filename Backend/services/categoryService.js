/**
 * Category Service
 * Business logic untuk operasi kategori produk
 */

const { pool } = require('../database/config');
const { ERROR_MESSAGES } = require('../utils/respons');
const { toTitleCase } = require('../utils/capitalize');

class CategoryService {
    /**
     * Create new category
     * @param {object} categoryData - Category data
     * @returns {object} Created category
     */
    async createCategory(categoryData) {
        const { name, parent_id, description, is_active = true } = categoryData;
        // Pastikan kapitalisasi nama kategori
        const fixedName = toTitleCase(name);
        // Cek duplikasi kategori dengan nama dan parent_id yang sama
        let duplicateQuery = 'SELECT id FROM categories WHERE name = ?';
        let duplicateParams = [fixedName];
        if (parent_id) {
            duplicateQuery += ' AND parent_id = ?';
            duplicateParams.push(parent_id);
        } else {
            duplicateQuery += ' AND parent_id IS NULL';
        }
        const [dupes] = await pool.query(duplicateQuery, duplicateParams);
        if (dupes.length > 0) {
            const error = new Error('Kategori sudah ada.');
            error.status = 409;
            throw error;
        }
        // Validate parent exists if provided
        if (parent_id) {
            const [parent] = await pool.query(
                'SELECT id FROM categories WHERE id = ?',
                [parent_id]
            );
            if (parent.length === 0) {
                const error = new Error('Parent category tidak ditemukan');
                error.status = 404;
                throw error;
            }
        }
        const [result] = await pool.query(
            `INSERT INTO categories (name, parent_id, description, is_active) 
             VALUES (?, ?, ?, ?) RETURNING id`,
            [fixedName, parent_id || null, description || null, is_active]
        );
        return this.getCategoryById(result[0].id);
    }
    async updateCategory(id, categoryData) {
        const { name, parent_id, description, is_active } = categoryData;
        const updates = [];
        const values = [];
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(toTitleCase(name));
        }
        if (parent_id !== undefined) {
            updates.push('parent_id = ?');
            values.push(parent_id);
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
                `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
        return this.getCategoryById(id);
    }

    /**
     * Get all categories with optional filters
     * @param {object} options - Query options
     * @returns {array} Categories list
     */
    async getCategories(options = {}) {
        const { parent_id = null, is_active = null, flat = false, search = '', sortBy = 'c.name', sortDir = 'ASC', description = null } = options;
        let query = `
            SELECT 
                c.id, 
                c.name, 
                c.parent_id, 
                p.name AS parent_name,
                c.description, 
                c.is_active, 
                c.created_at, 
                c.updated_at
            FROM categories c
            LEFT JOIN categories p ON c.parent_id = p.id
            WHERE 1=1
        `;
        const values = [];
        if (parent_id !== null) {
            if (parent_id === 'null' || parent_id === 0) {
                query += ' AND c.parent_id IS NULL';
            } else {
                query += ' AND c.parent_id = ?';
                values.push(parent_id);
            }
        }
        if (is_active !== null) {
            query += ' AND c.is_active = ?';
            values.push(is_active === 'true' || is_active === true ? 1 : 0);
        }
        if (search) {
            query += ' AND c.name LIKE ?';
            values.push(`%${search}%`);
        }
        if (description) {
            query += ' AND c.description LIKE ?';
            values.push(`%${description}%`);
        }
        query += ` ORDER BY ${sortBy} ${sortDir}`;
        const [rows] = await pool.query(query, values);
        if (flat) {
            return rows;
        }
        return this.buildCategoryTree(rows);
    }

    /**
     * Build hierarchical category tree
     * @param {array} categories - Flat categories list
     * @returns {array} Hierarchical categories
     */
    buildCategoryTree(categories) {
        const categoryMap = new Map();
        const roots = [];
        
        // First pass: create map of all categories
        categories.forEach(cat => {
            categoryMap.set(cat.id, { ...cat, children: [] });
        });
        
        // Second pass: build tree structure
        categories.forEach(cat => {
            const category = categoryMap.get(cat.id);
            if (cat.parent_id === null) {
                roots.push(category);
            } else {
                const parent = categoryMap.get(cat.parent_id);
                if (parent) {
                    parent.children.push(category);
                }
            }
        });
        
        return roots;
    }

    /**
     * Get category by ID
     * @param {number} id - Category ID
     * @returns {object} Category data
     */
    async getCategoryById(id) {
        const [rows] = await pool.query(
            `SELECT 
                c.id, 
                c.name, 
                c.parent_id, 
                p.name AS parent_name,
                c.description, 
                c.is_active, 
                c.created_at, 
                c.updated_at
             FROM categories c
             LEFT JOIN categories p ON c.parent_id = p.id
             WHERE c.id = ?`,
            [id]
        );
        
        if (rows.length === 0) {
            const error = new Error('Category tidak ditemukan');
            error.status = 404;
            throw error;
        }
        
        return rows[0];
    }

    /**
     * Get category with its products
     * @param {number} id - Category ID
     * @returns {object} Category with products
     */
    async getCategoryWithProducts(id) {
        const category = await this.getCategoryById(id);
        
        const [products] = await pool.query(
            `SELECT id, name, type, price, description, is_active 
             FROM products 
             WHERE category_id = ? AND is_active = TRUE
             ORDER BY price ASC`,
            [id]
        );
        
        return {
            ...category,
            products,
            total_products: products.length
        };
    }

    /**
     * Get subcategories of a category
     * @param {number} parentId - Parent category ID
     * @returns {array} Subcategories
     */
    async getSubcategories(parentId) {
        const [rows] = await pool.query(
            `SELECT id, name, parent_id, description, is_active, created_at 
             FROM categories 
             WHERE parent_id = ?
             ORDER BY name`,
            [parentId]
        );
        
        return rows;
    }

    /**
     * Update category
     * @param {number} id - Category ID
     * @param {object} categoryData - Category data to update
     * @returns {object} Updated category
     */
    async updateCategory(id, categoryData) {
        // Check if category exists
        await this.getCategoryById(id);
        
        const { name, parent_id, description, is_active } = categoryData;
        
        // Prevent setting parent to self
        if (parent_id && parseInt(parent_id) === parseInt(id)) {
            const error = new Error('Category tidak bisa menjadi parent dari dirinya sendiri');
            error.status = 400;
            throw error;
        }
        
        // Validate parent exists if provided
        if (parent_id) {
            const [parent] = await pool.query(
                'SELECT id FROM categories WHERE id = ?',
                [parent_id]
            );
            if (parent.length === 0) {
                const error = new Error('Parent category tidak ditemukan');
                error.status = 404;
                throw error;
            }
            
            // Check for circular reference
            const isCircular = await this.checkCircularReference(id, parent_id);
            if (isCircular) {
                const error = new Error('Circular reference terdeteksi');
                error.status = 400;
                throw error;
            }
        }
        
        // Build dynamic update query
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (parent_id !== undefined) {
            updates.push('parent_id = ?');
            values.push(parent_id || null);
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
                `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
        }
        
        return this.getCategoryById(id);
    }

    /**
     * Check for circular reference in category hierarchy
     * @param {number} categoryId - Category being updated
     * @param {number} newParentId - New parent ID
     * @returns {boolean} True if circular reference detected
     */
    async checkCircularReference(categoryId, newParentId) {
        let currentId = newParentId;
        const visited = new Set();
        
        while (currentId) {
            if (visited.has(currentId) || currentId === categoryId) {
                return true;
            }
            visited.add(currentId);
            
            const [rows] = await pool.query(
                'SELECT parent_id FROM categories WHERE id = ?',
                [currentId]
            );
            
            currentId = rows.length > 0 ? rows[0].parent_id : null;
        }
        
        return false;
    }

    /**
     * Delete category
     * @param {number} id - Category ID
     * @returns {boolean} Success status
     */
    async deleteCategory(id) {
        // Check if category exists
        await this.getCategoryById(id);
        
        // Check if category has products
        const [products] = await pool.query(
            'SELECT id FROM products WHERE category_id = ? LIMIT 1',
            [id]
        );
        
        if (products.length > 0) {
            const error = new Error('Category tidak dapat dihapus karena masih memiliki produk');
            error.status = 400;
            throw error;
        }
        
        // Check if category has children
        const [children] = await pool.query(
            'SELECT id FROM categories WHERE parent_id = ? LIMIT 1',
            [id]
        );
        
        if (children.length > 0) {
            const error = new Error('Category tidak dapat dihapus karena masih memiliki sub-category');
            error.status = 400;
            throw error;
        }
        
        await pool.query('DELETE FROM categories WHERE id = ?', [id]);
        return true;
    }

    /**
     * Toggle category status
     * @param {number} id - Category ID
     * @returns {object} Updated category
     */
    async toggleCategoryStatus(id) {
        const category = await this.getCategoryById(id);
        
        await pool.query(
            'UPDATE categories SET is_active = ? WHERE id = ?',
            [!category.is_active, id]
        );
        
        return this.getCategoryById(id);
    }

    /**
     * Get category path (breadcrumb)
     * @param {number} id - Category ID
     * @returns {array} Category path from root to current
     */
    async getCategoryPath(id) {
        const path = [];
        let currentId = id;
        
        while (currentId) {
            const [rows] = await pool.query(
                'SELECT id, name, parent_id FROM categories WHERE id = ?',
                [currentId]
            );
            
            if (rows.length === 0) break;
            
            path.unshift({
                id: rows[0].id,
                name: rows[0].name
            });
            
            currentId = rows[0].parent_id;
        }
        
        return path;
    }
}

module.exports = new CategoryService();
