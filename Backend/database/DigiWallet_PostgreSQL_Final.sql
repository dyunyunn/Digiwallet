-- PPOB (Payment Point Online Bank) Database Schema
-- DigiWallet - Complete Database Design for PostgreSQL
-- =============================================

-- 1. Drop Tables (dengan urutan yang aman)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. Drop ENUMs
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS product_type CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;

-- 3. Membuat Fungsi Trigger untuk updated_at
CREATE OR REPLACE FUNCTION update_modified_column()   
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;   
END;
$$ language 'plpgsql';

-- 4. Membuat Tipe Data ENUM
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
CREATE TYPE product_type AS ENUM ('pulsa', 'data', 'pln', 'pdam', 'internet', 'game', 'ewallet');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- =============================================
-- TABLE: users
-- =============================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    hash VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL DEFAULT '',
    phone_number VARCHAR(15) NULL,
    balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    role user_role NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);

CREATE TRIGGER update_users_modtime 
BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================
-- TABLE: sessions
-- =============================================
CREATE TABLE sessions (
    session_id CHAR(36) PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expired_at TIMESTAMP NOT NULL,
    CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expired ON sessions(expired_at);

-- =============================================
-- TABLE: categories
-- =============================================
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active);

CREATE TRIGGER update_categories_modtime 
BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================
-- TABLE: products
-- =============================================
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category_id INT NULL,
    type product_type NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created ON products(created_at);

CREATE TRIGGER update_products_modtime 
BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================
-- TABLE: transactions  
-- =============================================
CREATE TABLE transactions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    customer_number VARCHAR(50) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    status transaction_status DEFAULT 'PENDING',
    reference_number VARCHAR(50) UNIQUE NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_transactions_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_product ON transactions(product_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_reference ON transactions(reference_number);

CREATE TRIGGER update_transactions_modtime 
BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_modified_column();

-- =============================================
-- SAMPLE DATA (Opsional)
-- =============================================
INSERT INTO categories (name, parent_id, description, is_active) VALUES
('Top Up', NULL, 'Layanan isi ulang pulsa dan paket', TRUE),
('Tagihan', NULL, 'Pembayaran tagihan bulanan', TRUE),
('Hiburan', NULL, 'Layanan hiburan dan entertainment', TRUE),
('E-Wallet', NULL, 'Top up dompet digital', TRUE);

-- =============================================
-- VIEWS
-- =============================================
CREATE OR REPLACE VIEW v_user_transaction_summary AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    u.balance AS current_balance,
    COUNT(t.id) AS total_transactions,
    SUM(CASE WHEN t.status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN t.status = 'SUCCESS' THEN t.amount ELSE 0 END) AS total_spent
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.name, u.email, u.balance;
