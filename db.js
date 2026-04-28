// db.js
// Handles SQLite WASM with IndexedDB persistence

const DB_NAME = 'pos_database';

export class POSDatabase {
    constructor() {
        this.db = null;
        this.SQL = null;
        this.statusEl = document.getElementById('db-status');
    }

    async init() {
        try {
            this.statusEl.textContent = "Iniciando BD...";
            // Load sql.js
            this.SQL = await window.initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });

            // Load existing db from IndexedDB
            const savedData = await this.loadFromIndexedDB();
            if (savedData) {
                this.db = new this.SQL.Database(savedData);
                this.runMigrations();
                this.statusEl.textContent = "BD Cargada";
            } else {
                this.db = new this.SQL.Database();
                this.createTables();
                await this.saveToIndexedDB();
                this.statusEl.textContent = "BD Creada";
            }
        } catch (error) {
            console.error("DB Init Error:", error);
            this.statusEl.textContent = "Error en BD";
        }
    }

    createTables() {
        this.db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT,
                name TEXT NOT NULL,
                cost REAL DEFAULT 0,
                price REAL NOT NULL,
                stock INTEGER NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total REAL NOT NULL,
                date TEXT NOT NULL,
                status TEXT DEFAULT 'completed'
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                product_id INTEGER,
                quantity INTEGER,
                price REAL,
                FOREIGN KEY(sale_id) REFERENCES sales(id),
                FOREIGN KEY(product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                points REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }

    runMigrations() {
        try {
            // Ensure customers table exists (migration from v1)
            this.db.run(`
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    barcode TEXT UNIQUE NOT NULL,
                    name TEXT NOT NULL,
                    points REAL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                );
            `);
            this.saveToIndexedDB();
            
            // Check if barcode and cost columns exist
            const columns = this.exec("PRAGMA table_info(products)");
            const hasBarcode = columns.some(col => col.name === 'barcode');
            const hasCost = columns.some(col => col.name === 'cost');
            
            if (!hasBarcode) {
                this.db.run("ALTER TABLE products ADD COLUMN barcode TEXT");
                this.saveToIndexedDB();
            }
            if (!hasCost) {
                this.db.run("ALTER TABLE products ADD COLUMN cost REAL DEFAULT 0");
                this.saveToIndexedDB();
            }

            // Migrations for sales (Customers module)
            const salesColumns = this.exec("PRAGMA table_info(sales)");
            const hasCustomerId = salesColumns.some(col => col.name === 'customer_id');
            const hasPointsEarned = salesColumns.some(col => col.name === 'points_earned');
            const hasPaymentMethod = salesColumns.some(col => col.name === 'payment_method');
            const hasPointsUsed = salesColumns.some(col => col.name === 'points_used');

            if (!hasCustomerId) {
                this.db.run("ALTER TABLE sales ADD COLUMN customer_id INTEGER");
                this.saveToIndexedDB();
            }
            if (!hasPointsEarned) {
                this.db.run("ALTER TABLE sales ADD COLUMN points_earned REAL DEFAULT 0");
                this.saveToIndexedDB();
            }
            if (!hasPaymentMethod) {
                this.db.run("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT 'efectivo'");
                this.saveToIndexedDB();
            }
            if (!hasPointsUsed) {
                this.db.run("ALTER TABLE sales ADD COLUMN points_used REAL DEFAULT 0");
                this.saveToIndexedDB();
            }
        } catch (e) {
            console.error("Migration error:", e);
        }
    }

    async saveToIndexedDB() {
        const data = this.db.export();
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("POS_DB_Storage_v2", 1);
            
            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains("sqlite_files")) {
                    idb.createObjectStore("sqlite_files");
                }
            };

            request.onsuccess = (e) => {
                const idb = e.target.result;
                const tx = idb.transaction("sqlite_files", "readwrite");
                const store = tx.objectStore("sqlite_files");
                store.put(data, DB_NAME);
                tx.oncomplete = () => {
                    idb.close();
                    resolve();
                };
            };
            request.onerror = (e) => reject(e);
        });
    }

    // Safe insert that guarantees the ID
    async insertSale(total, date, customerId = null, pointsEarned = 0, paymentMethod = 'efectivo', pointsUsed = 0) {
        this.db.run(
            "INSERT INTO sales (total, date, status, customer_id, points_earned, payment_method, points_used) VALUES (?, ?, 'completed', ?, ?, ?, ?)", 
            [total, date, customerId, pointsEarned, paymentMethod, pointsUsed]
        );
        const stmt = this.db.prepare("SELECT last_insert_rowid() as id");
        stmt.step();
        const result = stmt.getAsObject();
        stmt.free();
        await this.saveToIndexedDB();
        return result.id;
    }

    async loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("POS_DB_Storage_v2", 1);
            
            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains("sqlite_files")) {
                    idb.createObjectStore("sqlite_files");
                }
            };

            request.onsuccess = (e) => {
                const idb = e.target.result;
                const tx = idb.transaction("sqlite_files", "readonly");
                const store = tx.objectStore("sqlite_files");
                const getReq = store.get(DB_NAME);
                
                getReq.onsuccess = () => {
                    idb.close();
                    resolve(getReq.result);
                };
                getReq.onerror = () => {
                    idb.close();
                    resolve(null);
                };
            };
            request.onerror = () => resolve(null); // Return null on error so we create a new one
        });
    }

    // Helper methods for queries
    async run(query, params = []) {
        this.db.run(query, params);
        await this.saveToIndexedDB();
    }

    exec(query, params = []) {
        const stmt = this.db.prepare(query);
        stmt.bind(params);
        const results = [];
        while(stmt.step()) {
            results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
    }

    async importFromBuffer(uInt8Array) {
        try {
            if (this.db) {
                this.db.close();
            }
            this.db = new this.SQL.Database(uInt8Array);
            await this.saveToIndexedDB();
            this.runMigrations(); // Ensure schema is up to date
            return true;
        } catch (error) {
            console.error("Import DB Error:", error);
            throw new Error("El archivo no es una base de datos válida o está corrupto.");
        }
    }
}
