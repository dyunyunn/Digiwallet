-- PPOB (Payment Point Online Bank) Database Schema
-- DigiWallet - Complete Database Design for PostgreSQL
-- =============================================

-- Drop tables if exists (for fresh setup)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop ENUMs if exists (for fresh setup)
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS product_type CASCADE;
DROP TYPE IF EXISTS transaction_status CASCADE;

-- ENUMs for PostgreSQL
CREATE TYPE user_role AS ENUM ('USER', 'ADMIN');
CREATE TYPE product_type AS ENUM ('pulsa', 'data', 'pln', 'pdam', 'internet', 'game', 'ewallet');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

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

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    parent_id INT NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) 
        REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_active ON categories(is_active);

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
    
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) 
        REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_created ON products(created_at);

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
    
    CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_transactions_product FOREIGN KEY (product_id) 
        REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_product ON transactions(product_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at);
CREATE INDEX idx_transactions_reference ON transactions(reference_number);

-- =============================================
-- SAMPLE DATA: Categories
-- =============================================
INSERT INTO categories (name, parent_id, description, is_active) VALUES
('Top Up', NULL, 'Layanan isi ulang pulsa dan paket', TRUE),
('Tagihan', NULL, 'Pembayaran tagihan bulanan', TRUE),
('Hiburan', NULL, 'Layanan hiburan dan entertainment', TRUE),
('E-Wallet', NULL, 'Top up dompet digital', TRUE);

INSERT INTO categories (name, parent_id, description, is_active) VALUES
('Pulsa', 1, 'Isi ulang pulsa semua operator', TRUE),
('Paket Data', 1, 'Paket internet semua operator', TRUE),
('Pulsa', 5, 'Isi ulang pulsa semua operator', TRUE),
('Paket Data', 5, 'Paket internet semua operator', TRUE),
('Listrik PLN', 2, 'Pembayaran dan token listrik PLN', TRUE),
('PDAM', 2, 'Pembayaran tagihan air PDAM', TRUE),
('Internet', 2, 'Pembayaran tagihan internet', TRUE),
('Game Voucher', 3, 'Voucher game online', TRUE),
('Streaming', 3, 'Layanan streaming video dan musik', TRUE),
('GoPay', 4, 'Top up saldo GoPay', TRUE),
('OVO', 4, 'Top up saldo OVO', TRUE),
('DANA', 4, 'Top up saldo DANA', TRUE),
('ShopeePay', 4, 'Top up saldo ShopeePay', TRUE);

-- =============================================
-- SAMPLE DATA: Products
-- =============================================
INSERT INTO products (name, category_id, type, price, description, is_active) VALUES
('Pulsa 10.000', 5, 'pulsa', 11000.00, 'Pulsa All Operator Rp 10.000', TRUE),
('Pulsa 25.000', 5, 'pulsa', 26000.00, 'Pulsa All Operator Rp 25.000', TRUE),
('Pulsa 50.000', 5, 'pulsa', 51000.00, 'Pulsa All Operator Rp 50.000', TRUE),
('Pulsa 100.000', 5, 'pulsa', 101000.00, 'Pulsa All Operator Rp 100.000', TRUE),
('Data 1GB 30 Hari', 6, 'data', 15000.00, 'Paket Data 1GB Masa Aktif 30 Hari', TRUE),
('Data 3GB 30 Hari', 6, 'data', 35000.00, 'Paket Data 3GB Masa Aktif 30 Hari', TRUE),
('Data 5GB 30 Hari', 6, 'data', 50000.00, 'Paket Data 5GB Masa Aktif 30 Hari', TRUE),
('Data 10GB 30 Hari', 6, 'data', 85000.00, 'Paket Data 10GB Masa Aktif 30 Hari', TRUE),
('Token PLN 20.000', 7, 'pln', 21500.00, 'Token Listrik PLN Rp 20.000', TRUE),
('Token PLN 50.000', 7, 'pln', 51500.00, 'Token Listrik PLN Rp 50.000', TRUE),
('Token PLN 100.000', 7, 'pln', 101500.00, 'Token Listrik PLN Rp 100.000', TRUE),
('Token PLN 200.000', 7, 'pln', 201500.00, 'Token Listrik PLN Rp 200.000', TRUE),
('PDAM Bayar Tagihan', 8, 'pdam', 2500.00, 'Biaya Admin Pembayaran PDAM', TRUE),
('Internet Bayar Tagihan', 9, 'internet', 2500.00, 'Biaya Admin Pembayaran Internet', TRUE),
('Mobile Legends 86 Diamonds', 10, 'game', 22000.00, 'Voucher ML 86 Diamonds', TRUE),
('Mobile Legends 172 Diamonds', 10, 'game', 44000.00, 'Voucher ML 172 Diamonds', TRUE),
('Free Fire 100 Diamonds', 10, 'game', 15000.00, 'Voucher FF 100 Diamonds', TRUE),
('GoPay 50.000', 12, 'ewallet', 51000.00, 'Top Up GoPay Rp 50.000', TRUE),
('OVO 50.000', 13, 'ewallet', 51000.00, 'Top Up OVO Rp 50.000', TRUE),
('DANA 50.000', 14, 'ewallet', 51000.00, 'Top Up DANA Rp 50.000', TRUE);

-- =============================================
-- SAMPLE DATA: Users
-- =============================================
INSERT INTO users (name, email, hash, phone_number, balance) VALUES
('John Doe', 'john@example.com', 'dummyhash', '081234567890', 500000.00),
('Jane Smith', 'jane@example.com', 'dummyhash', '081234567891', 250000.00),
('Ahmad Rizki', 'ahmad@example.com', 'dummyhash', '081234567892', 1000000.00);

-- =============================================
-- REPORTING VIEWS & QUERIES
-- =============================================
CREATE OR REPLACE VIEW v_user_transaction_summary AS
SELECT 
    u.id AS user_id,
    u.name AS user_name,
    u.email,
    u.balance AS current_balance,
    COUNT(t.id) AS total_transactions,
    SUM(CASE WHEN t.status = 'SUCCESS' THEN 1 ELSE 0 END) AS success_count,
    SUM(CASE WHEN t.status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
    SUM(CASE WHEN t.status = 'SUCCESS' THEN t.amount ELSE 0 END) AS total_spent
FROM users u
LEFT JOIN transactions t ON u.id = t.user_id
GROUP BY u.id, u.name, u.email, u.balance;

CREATE OR REPLACE VIEW v_product_revenue_summary AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    p.type AS product_type,
    c.name AS category_name,
    p.price,
    p.is_active,
    COUNT(t.id) AS total_sold,
    SUM(CASE WHEN t.status = 'SUCCESS' THEN t.amount ELSE 0 END) AS total_revenue
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN transactions t ON p.id = t.product_id
GROUP BY p.id, p.name, p.type, c.name, p.price, p.is_active;

CREATE OR REPLACE VIEW v_category_hierarchy AS
SELECT 
    c.id,
    c.name,
    c.parent_id,
    p.name AS parent_name,
    c.description,
    c.is_active,
    c.created_at
FROM categories c
LEFT JOIN categories p ON c.parent_id = p.id;