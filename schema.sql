-- Tabela de Perfis de Loja
CREATE TABLE IF NOT EXISTS store_profiles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    logoUrl TEXT,
    address TEXT,
    whatsapp TEXT,
    isActive INTEGER DEFAULT 1,
    createdAt INTEGER,
    settings TEXT
);

-- Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT,
    name TEXT NOT NULL,
    UNIQUE(store_id, name)
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL,
    category TEXT,
    imageUrl TEXT,
    isActive INTEGER DEFAULT 1,
    featuredDay INTEGER,
    isByWeight INTEGER DEFAULT 0,
    barcode TEXT,
    stock INTEGER DEFAULT 0
);

-- Tabela de Funcionários
CREATE TABLE IF NOT EXISTS waitstaff (
    id TEXT PRIMARY KEY,
    store_id TEXT,
    name TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL
);

-- Tabela de Pedidos
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store_id TEXT,
    type TEXT,
    tableNumber TEXT,
    customerName TEXT,
    customerPhone TEXT,
    items TEXT,
    status TEXT,
    total REAL,
    createdAt INTEGER,
    paymentMethod TEXT,
    deliveryAddress TEXT,
    notes TEXT,
    changeFor REAL,
    waitstaffName TEXT,
    couponApplied TEXT,
    discountAmount REAL
);
