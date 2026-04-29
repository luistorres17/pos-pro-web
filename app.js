import { POSDatabase } from './db.js';

const db = new POSDatabase();

// State
let cart = [];
let currentProducts = [];
let currentCustomer = null;
let isAdminAuth = false;
let appSettings = { storeName: 'POS Pro', theme: 'dark', enableCustomers: true, pointsMultiplier: 0.1, pointsValue: 1.0, adminPin: '', licenseKey: '' };

// Elements
const tabs = document.querySelectorAll('.nav-links li');
const tabContents = document.querySelectorAll('.tab-content');
const btnAddProduct = document.getElementById('btn-add-product');
const modal = document.getElementById('product-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const productForm = document.getElementById('product-form');
const inventoryTableBody = document.querySelector('#inventory-table tbody');
const historyTableBody = document.querySelector('#history-table tbody');
const posProductsGrid = document.getElementById('pos-products');
const cartItemsList = document.getElementById('cart-items');
const cartTotalEl = document.getElementById('cart-total');
const btnCheckout = document.getElementById('btn-checkout');
const barcodeInput = document.getElementById('barcode-input');

// Customers Elements
const customersTableBody = document.querySelector('#customers-table tbody');
const btnAddCustomer = document.getElementById('btn-add-customer');
const customerModal = document.getElementById('customer-modal');
const customerForm = document.getElementById('customer-form');
const btnCancelCustomerModal = document.getElementById('btn-cancel-customer-modal');
const currentCustomerBanner = document.getElementById('current-customer-banner');
const ccName = document.getElementById('cc-name');
const ccPoints = document.querySelector('.cc-points');
const ccPointsVal = document.getElementById('cc-points-val');
const btnRemoveCustomer = document.getElementById('btn-remove-customer');
const navClientes = document.getElementById('nav-clientes');
const settingEnableCustomers = document.getElementById('setting-enable-customers');
const settingPointsMultiplier = document.getElementById('setting-points-multiplier');
const settingPointsValue = document.getElementById('setting-points-value');
const settingAdminPin = document.getElementById('setting-admin-pin');
const settingLicenseKey = document.getElementById('setting-license-key');
const licenseStatus = document.getElementById('license-status');
const adContainer = document.getElementById('ad-container');

// Returns Elements
const returnSaleIdInput = document.getElementById('return-sale-id');
const btnSearchSale = document.getElementById('btn-search-sale');
const returnDetails = document.getElementById('return-details');
const retSaleIdDisplay = document.getElementById('ret-sale-id-display');
const returnItemsList = document.getElementById('return-items-list');
const btnProcessReturn = document.getElementById('btn-process-return');

// Network Status
const networkStatus = document.getElementById('network-status');
const networkText = document.getElementById('network-text');

function updateNetworkStatus() {
    if (navigator.onLine) {
        networkStatus.className = 'status-indicator online';
        networkText.innerText = 'En línea';
    } else {
        networkStatus.className = 'status-indicator offline';
        networkText.innerText = 'Sin Conexión';
    }
}
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

function loadSettings() {
    const saved = localStorage.getItem('pos_settings');
    if (saved) {
        try {
            appSettings = { ...appSettings, ...JSON.parse(saved) };
        } catch(e) {}
    }
    document.getElementById('setting-store-name').value = appSettings.storeName;
    document.getElementById('setting-theme').value = appSettings.theme;
    if (settingEnableCustomers) {
        settingEnableCustomers.checked = appSettings.enableCustomers !== false;
        appSettings.enableCustomers = settingEnableCustomers.checked;
    }
    if (settingPointsMultiplier) {
        settingPointsMultiplier.value = appSettings.pointsMultiplier !== undefined ? appSettings.pointsMultiplier : 0.1;
        appSettings.pointsMultiplier = parseFloat(settingPointsMultiplier.value);
    }
    if (settingPointsValue) {
        settingPointsValue.value = appSettings.pointsValue !== undefined ? appSettings.pointsValue : 1.0;
        appSettings.pointsValue = parseFloat(settingPointsValue.value);
    }
    if (settingAdminPin) {
        settingAdminPin.value = appSettings.adminPin || '';
    }
    if (settingLicenseKey) {
        settingLicenseKey.value = appSettings.licenseKey || '';
        if (licenseStatus) {
            licenseStatus.innerText = isPremium() ? "Estado: Versión Premium (Sin Anuncios)" : "Estado: Versión Gratuita (Con Anuncios)";
            licenseStatus.style.color = isPremium() ? "var(--success)" : "var(--text-muted)";
        }
    }
    applyTheme();
    applyFeatures();
}

function isPremium() {
    if (!appSettings.licenseKey || appSettings.licenseKey.length !== 19) return false;
    
    // Validar formato AAAA-BBBB-CCCC-DDDD
    const parts = appSettings.licenseKey.split('-');
    if (parts.length !== 4) return false;
    
    const fullKey = parts.join('');
    if (fullKey.length !== 16) return false;
    
    const keyBase = fullKey.slice(0, 12);
    const expectedChecksum = fullKey.slice(12, 16);
    
    let sum = 0;
    for(let i = 0; i < keyBase.length; i++) {
        sum += keyBase.charCodeAt(i);
    }
    
    let checksumStr = (sum * 88).toString(16).toUpperCase();
    checksumStr = checksumStr.padStart(4, '0').slice(-4);
    
    return checksumStr === expectedChecksum;
}

function applyFeatures() {
    if (!navClientes) return;
    if (appSettings.enableCustomers) {
        navClientes.style.display = 'block';
        currentCustomerBanner.classList.remove('hidden');
    } else {
        navClientes.style.display = 'none';
        currentCustomerBanner.classList.add('hidden');
        clearCurrentCustomer();
    }
    
    // Ads / Premium Logic
    if (adContainer) {
        if (isPremium()) {
            adContainer.classList.add('hidden');
        } else {
            adContainer.classList.remove('hidden');
            // Cargar Google AdSense solo si no es premium y no se ha cargado ya
            if (!window.adsByGoogleLoaded) {
                const script = document.createElement('script');
                script.async = true;
                script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4453683368941401";
                script.crossOrigin = "anonymous";
                document.head.appendChild(script);
                window.adsByGoogleLoaded = true;
            }
        }
    }
}

function clearCurrentCustomer() {
    currentCustomer = null;
    ccName.innerText = 'Público en General';
    ccPoints.classList.add('hidden');
    btnRemoveCustomer.classList.add('hidden');
}

window.setCurrentCustomer = function(customer) {
    currentCustomer = customer;
    ccName.innerText = customer.name;
    ccPoints.classList.remove('hidden');
    ccPointsVal.innerText = customer.points.toFixed(2);
    btnRemoveCustomer.classList.remove('hidden');
}

if (btnRemoveCustomer) {
    btnRemoveCustomer.addEventListener('click', clearCurrentCustomer);
}

function applyTheme() {
    if (appSettings.theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

// Initialize
async function initApp() {
    loadSettings();
    updateNetworkStatus();
    await db.init();
    loadInventory();
    loadPOSProducts();
}

// Navigation
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        
        // Security check
        if (target !== 'ventas' && appSettings.adminPin && appSettings.adminPin.trim() !== '' && !isAdminAuth) {
            const pin = prompt('Sección Protegida.\nIngrese el PIN de Administrador:');
            if (pin === appSettings.adminPin) {
                isAdminAuth = true;
            } else {
                if (pin !== null) alert('PIN Incorrecto. Acceso denegado.');
                return; // Block navigation
            }
        }
        
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        tabContents.forEach(tc => tc.classList.remove('active'));
        document.getElementById(target).classList.add('active');

        if(target === 'inventario') loadInventory();
        if(target === 'ventas') loadPOSProducts();
        if(target === 'historial') loadHistory();
        if(target === 'clientes') loadCustomers();
    });
});

// --- INVENTORY MODULE ---

function loadInventory() {
    const products = db.exec("SELECT * FROM products ORDER BY id DESC");
    inventoryTableBody.innerHTML = '';
    
    products.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.barcode || '-'}</td>
            <td>${p.name}</td>
            <td>$${(p.cost || 0).toFixed(2)}</td>
            <td>$${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editProduct(${p.id})">Editar</button>
            </td>
        `;
        inventoryTableBody.appendChild(tr);
    });
}

btnAddProduct.addEventListener('click', () => {
    document.getElementById('modal-title').innerText = 'Agregar Producto';
    productForm.reset();
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-barcode').value = '';
    modal.classList.remove('hidden');
});

btnCancelModal.addEventListener('click', () => {
    modal.classList.add('hidden');
});

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const barcode = document.getElementById('prod-barcode').value;
    const name = document.getElementById('prod-name').value;
    const cost = parseFloat(document.getElementById('prod-cost').value);
    const price = parseFloat(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    if (id) {
        await db.run("UPDATE products SET barcode = ?, name = ?, cost = ?, price = ?, stock = ? WHERE id = ?", [barcode, name, cost, price, stock, id]);
    } else {
        await db.run("INSERT INTO products (barcode, name, cost, price, stock) VALUES (?, ?, ?, ?, ?)", [barcode, name, cost, price, stock]);
    }
    
    modal.classList.add('hidden');
    loadInventory();
});

window.editProduct = function(id) {
    const results = db.exec("SELECT * FROM products WHERE id = ?", [id]);
    if(results.length > 0) {
        const p = results[0];
        document.getElementById('modal-title').innerText = 'Editar Producto';
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-barcode').value = p.barcode || '';
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-cost').value = p.cost || 0;
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-stock').value = p.stock;
        modal.classList.remove('hidden');
    }
}

// --- CUSTOMERS MODULE ---

function loadCustomers() {
    if (!customersTableBody) return;
    const customers = db.exec("SELECT * FROM customers ORDER BY id DESC");
    customersTableBody.innerHTML = '';
    
    customers.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.barcode}</td>
            <td>${c.name}</td>
            <td>${c.points.toFixed(2)}</td>
            <td>
                <button class="btn-secondary btn-sm" onclick="editCustomer(${c.id})">Editar</button>
            </td>
        `;
        customersTableBody.appendChild(tr);
    });
}

if (btnAddCustomer) {
    btnAddCustomer.addEventListener('click', () => {
        document.getElementById('customer-modal-title').innerText = 'Agregar Cliente';
        customerForm.reset();
        document.getElementById('cust-id').value = '';
        document.getElementById('cust-points').value = '0';
        customerModal.classList.remove('hidden');
    });
}

if (btnCancelCustomerModal) {
    btnCancelCustomerModal.addEventListener('click', () => {
        customerModal.classList.add('hidden');
    });
}

if (customerForm) {
    customerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('cust-id').value;
        const barcode = document.getElementById('cust-barcode').value.trim();
        const name = document.getElementById('cust-name').value.trim();
        const points = parseFloat(document.getElementById('cust-points').value) || 0;

        try {
            if (id) {
                await db.run("UPDATE customers SET barcode = ?, name = ?, points = ? WHERE id = ?", [barcode, name, points, id]);
            } else {
                await db.run("INSERT INTO customers (barcode, name, points) VALUES (?, ?, ?)", [barcode, name, points]);
            }
            customerModal.classList.add('hidden');
            loadCustomers();
        } catch (err) {
            alert('Error al guardar cliente. Revisa si el código o teléfono ya está en uso.');
            console.error(err);
        }
    });
}

window.editCustomer = function(id) {
    const results = db.exec("SELECT * FROM customers WHERE id = ?", [id]);
    if(results.length > 0) {
        const c = results[0];
        document.getElementById('customer-modal-title').innerText = 'Editar Cliente';
        document.getElementById('cust-id').value = c.id;
        document.getElementById('cust-barcode').value = c.barcode || '';
        document.getElementById('cust-name').value = c.name;
        document.getElementById('cust-points').value = c.points || 0;
        customerModal.classList.remove('hidden');
    }
}

// --- SALES MODULE ---

// Barcode Scanner Event
barcodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const code = barcodeInput.value.trim();
        if (code) {
            // First check if it's a customer (if module is enabled)
            if (appSettings.enableCustomers) {
                const customers = db.exec("SELECT * FROM customers WHERE barcode = ?", [code]);
                if (customers.length > 0) {
                    setCurrentCustomer(customers[0]);
                    barcodeInput.value = '';
                    return;
                }
            }

            // Then check products
            const results = db.exec("SELECT * FROM products WHERE barcode = ? AND stock > 0", [code]);
            if (results.length > 0) {
                addToCart(results[0]);
                barcodeInput.value = '';
            } else {
                alert('Producto/Cliente no encontrado o sin stock');
                barcodeInput.select();
            }
        }
    }
});

function loadPOSProducts() {
    currentProducts = db.exec("SELECT * FROM products WHERE stock > 0");
    posProductsGrid.innerHTML = '';
    
    currentProducts.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <h3>${p.name}</h3>
            <div class="price">$${p.price.toFixed(2)}</div>
            <div class="stock">Stock: ${p.stock}</div>
        `;
        card.addEventListener('click', () => addToCart(p));
        posProductsGrid.appendChild(card);
    });
}

function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
        if (existing.quantity < product.stock) {
            existing.quantity++;
        } else {
            alert('No hay suficiente stock');
            return;
        }
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

window.removeFromCart = function(id) {
    cart = cart.filter(item => item.id !== id);
    updateCartUI();
}

function updateCartUI() {
    cartItemsList.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        total += item.price * item.quantity;
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>$${item.price.toFixed(2)} x ${item.quantity}</p>
            </div>
            <div class="cart-item-actions">
                <button onclick="removeFromCart(${item.id})">❌</button>
            </div>
        `;
        cartItemsList.appendChild(li);
    });
    
    cartTotalEl.innerText = `$${total.toFixed(2)}`;
}

btnCheckout.addEventListener('click', async () => {
    if (cart.length === 0) return alert('El carrito está vacío');
    
    let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const date = new Date().toISOString();
    
    const paymentMethodEl = document.getElementById('payment-method');
    let paymentMethod = paymentMethodEl ? paymentMethodEl.value : 'efectivo';
    
    let customerId = null;
    let pointsEarned = 0;
    let pointsUsed = 0;
    let discountMoney = 0;
    let originalTotal = total;
    
    if (currentCustomer && appSettings.enableCustomers) {
        customerId = currentCustomer.id;
        
        // Check if customer wants to use points
        if (currentCustomer.points > 0) {
            const pointsValueMoney = currentCustomer.points * appSettings.pointsValue;
            const pointsNeeded = total / appSettings.pointsValue;
            const availablePointsToUse = Math.min(currentCustomer.points, pointsNeeded);
            const availableDiscount = availablePointsToUse * appSettings.pointsValue;
            
            if (confirm(`Tienes ${currentCustomer.points.toFixed(2)} puntos (equivalentes a $${pointsValueMoney.toFixed(2)}).\n¿Aceptas usar ${availablePointsToUse.toFixed(2)} puntos ($${availableDiscount.toFixed(2)} de descuento) en esta compra o prefieres seguir juntando?`)) {
                pointsUsed = availablePointsToUse;
                discountMoney = availableDiscount;
                total = total - discountMoney;
                paymentMethod = total === 0 ? 'puntos' : paymentMethod;
            }
        }
        
        // Earn points only on the remaining money paid
        if (total > 0) {
            pointsEarned = Math.floor(total * appSettings.pointsMultiplier);
        }
    }
    
    try {
        const saleId = await db.insertSale(total, date, customerId, pointsEarned, paymentMethod, pointsUsed);
        
        for (const item of cart) {
            await db.run("INSERT INTO sale_items (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)", 
                        [saleId, item.id, item.quantity, item.price]);
            await db.run("UPDATE products SET stock = stock - ? WHERE id = ?", [item.quantity, item.id]);
        }

        if (customerId) {
            const pointDiff = pointsEarned - pointsUsed;
            if (pointDiff !== 0) {
                await db.run("UPDATE customers SET points = points + ? WHERE id = ?", [pointDiff, customerId]);
                currentCustomer.points += pointDiff;
            }
        }
        
        const printCheckbox = document.getElementById('print-ticket');
        if (printCheckbox && printCheckbox.checked) {
            printReceipt(saleId, date, cart, originalTotal, 'completed', currentCustomer, pointsEarned, paymentMethod, pointsUsed, discountMoney, total);
        }
        
        alert(`Venta Completada con éxito. ID: ${saleId}${pointsEarned > 0 ? `\nPuntos Generados: ${pointsEarned}` : ''}${pointsUsed > 0 ? `\nPuntos Usados: ${pointsUsed.toFixed(2)} ($${discountMoney.toFixed(2)})` : ''}`);
        cart = [];
        updateCartUI();
        loadPOSProducts();
        if (currentCustomer) {
            clearCurrentCustomer();
        }
    } catch (e) {
        console.error(e);
        alert('Error al procesar la venta');
    }
});

function printReceipt(saleId, date, items, total, status = 'completed', customer = null, pointsEarned = 0, paymentMethod = 'efectivo', pointsUsed = 0, discountMoney = 0, finalTotal = null) {
    if (finalTotal === null) finalTotal = total;
    let itemsHtml = '';
    items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${item.quantity}x</td>
                <td>${item.name}</td>
                <td style="text-align: right">$${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    // Generate Barcode SVG
    try {
        window.JsBarcode("#barcode-temp", saleId.toString(), {
            format: "CODE128",
            displayValue: true,
            height: 40,
            width: 2,
            margin: 0,
            fontSize: 14
        });
    } catch(e) { console.error("Barcode generation failed", e); }
    const barcodeSvg = document.getElementById('barcode-temp').outerHTML;

    let customerHtml = '';
    if (customer && appSettings.enableCustomers) {
        customerHtml = `
            <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;">
                <strong>Cliente:</strong> ${customer.name}<br>
                ${pointsEarned > 0 ? `<strong>Puntos Ganados:</strong> ${pointsEarned}<br>` : ''}
                <strong>Saldo de Puntos:</strong> ${customer.points.toFixed(2)}
            </div>
        `;
    }

    const ticketHTML = `
        <html>
        <head>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 12px;
                    color: #000;
                    width: 100%;
                    max-width: 80mm;
                }
                .ticket-header {
                    text-align: center;
                    margin-bottom: 10px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 5px;
                }
                .ticket-header h2 {
                    font-size: 16px;
                    margin: 0 0 5px 0;
                }
                .returned-mark {
                    text-align: center;
                    font-size: 14px;
                    font-weight: bold;
                    color: #000;
                    border: 2px dashed #000;
                    padding: 5px;
                    margin-bottom: 10px;
                }
                .ticket-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 10px;
                }
                .ticket-table th, .ticket-table td {
                    text-align: left;
                    padding: 2px 0;
                    font-size: 12px;
                }
                .ticket-table th {
                    border-bottom: 1px dashed #000;
                }
                .ticket-total {
                    text-align: right;
                    font-weight: bold;
                    border-top: 1px dashed #000;
                    padding-top: 5px;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                .ticket-footer {
                    text-align: center;
                    font-size: 10px;
                    border-top: 1px dashed #000;
                    padding-top: 5px;
                }
            </style>
        </head>
        <body>
            <div class="ticket-header">
                <h2>${appSettings.storeName}</h2>
                ${status === 'returned' ? '<div class="returned-mark">VENTA DEVUELTA / ANULADA</div>' : ''}
                <div style="text-align: center; margin: 10px 0;">
                    ${barcodeSvg}
                </div>
                <div>Fecha: ${new Date(date).toLocaleString()}</div>
            </div>
            <table class="ticket-table">
                <thead>
                    <tr>
                        <th>Cant</th>
                        <th>Producto</th>
                        <th style="text-align: right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            <div class="ticket-total">
                SUBTOTAL: $${total.toFixed(2)}
                ${pointsUsed > 0 ? `<br>DESCUENTO PUNTOS: -$${discountMoney.toFixed(2)}` : ''}
                <br>TOTAL: $${finalTotal.toFixed(2)}
            </div>
            <div style="margin-top: 5px; text-align: right;">
                Pago: ${paymentMethod.toUpperCase()}
            </div>
            ${customerHtml}
            <div class="ticket-footer">
                ¡Gracias por su compra!
            </div>
        </body>
        </html>
    `;

    // Create a hidden iframe for printing
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write(ticketHTML);
    doc.close();

    // Wait for the iframe content to load before printing
    printFrame.onload = function() {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        // Remove the iframe after a short delay
        setTimeout(() => {
            document.body.removeChild(printFrame);
        }, 1000);
    };
}

// --- HISTORY MODULE ---

function loadHistory() {
    const sales = db.exec("SELECT * FROM sales ORDER BY id DESC");
    historyTableBody.innerHTML = '';
    
    sales.forEach(s => {
        const statusBadge = s.status === 'returned' ? '<span class="badge badge-danger">Devuelto</span>' : '<span class="badge badge-success">Completado</span>';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${s.id} ${statusBadge}</td>
            <td>${new Date(s.date).toLocaleString()}</td>
            <td>$${s.total.toFixed(2)}</td>
            <td>
                <button class="btn-primary btn-sm" onclick="reprintTicket(${s.id})" style="padding: 0.5rem; font-size: 0.8rem;">🖨️ Reimprimir</button>
            </td>
        `;
        historyTableBody.appendChild(tr);
    });
}

window.reprintTicket = function(saleId) {
    const saleRes = db.exec("SELECT * FROM sales WHERE id = ?", [saleId]);
    if(saleRes.length === 0) return alert('Venta no encontrada');
    const sale = saleRes[0];
    
    const items = db.exec(`
        SELECT si.quantity, si.price, IFNULL(p.name, 'Producto Eliminado') as name
        FROM sale_items si
        LEFT JOIN products p ON si.product_id = p.id
        WHERE si.sale_id = ?
    `, [saleId]);
    
    printReceipt(sale.id, sale.date, items, sale.total, sale.status);
};

// --- RETURNS MODULE ---

btnSearchSale.addEventListener('click', () => {
    const saleId = returnSaleIdInput.value;
    if(!saleId) return;
    
    const saleInfo = db.exec("SELECT status FROM sales WHERE id = ?", [saleId]);
    if(saleInfo.length > 0 && saleInfo[0].status === 'returned') {
        alert('Esta venta ya fue devuelta previamente.');
        returnDetails.classList.add('hidden');
        return;
    }
    
    const items = db.exec(`
        SELECT si.id, IFNULL(p.name, 'Producto Eliminado') as name, si.quantity, si.price, si.product_id
        FROM sale_items si 
        LEFT JOIN products p ON si.product_id = p.id 
        WHERE si.sale_id = ?
    `, [saleId]);
    
    if(items.length === 0) {
        alert('Venta no encontrada o sin artículos');
        returnDetails.classList.add('hidden');
        return;
    }
    
    retSaleIdDisplay.innerText = saleId;
    returnItemsList.innerHTML = '';
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <p>Cant: ${item.quantity} | Total: $${(item.price * item.quantity).toFixed(2)}</p>
            </div>
        `;
        returnItemsList.appendChild(li);
    });
    
    returnDetails.classList.remove('hidden');
});

btnProcessReturn.addEventListener('click', async () => {
    const saleId = returnSaleIdInput.value;
    if(confirm(`¿Estás seguro de devolver toda la venta #${saleId}? Esto devolverá el stock.`)) {
        try {
            const items = db.exec("SELECT product_id, quantity FROM sale_items WHERE sale_id = ?", [saleId]);
            
            for(const item of items) {
                await db.run("UPDATE products SET stock = stock + ? WHERE id = ?", [item.quantity, item.product_id]);
            }
            
            await db.run("UPDATE sales SET status = 'returned' WHERE id = ?", [saleId]);
            
            alert('Devolución procesada. Stock actualizado.');
            returnDetails.classList.add('hidden');
            returnSaleIdInput.value = '';
        } catch(e) {
            console.error(e);
            alert('Error al procesar devolución');
        }
    }
});

// --- SETTINGS MODULE ---

document.getElementById('btn-save-settings').addEventListener('click', () => {
    appSettings.storeName = document.getElementById('setting-store-name').value || 'POS Pro';
    appSettings.theme = document.getElementById('setting-theme').value;
    if (settingEnableCustomers) {
        appSettings.enableCustomers = settingEnableCustomers.checked;
    }
    if (settingPointsMultiplier) {
        appSettings.pointsMultiplier = parseFloat(settingPointsMultiplier.value) || 0;
    }
    if (settingPointsValue) {
        appSettings.pointsValue = parseFloat(settingPointsValue.value) || 0;
    }
    if (settingAdminPin) {
        appSettings.adminPin = settingAdminPin.value;
    }
    if (settingLicenseKey) {
        appSettings.licenseKey = settingLicenseKey.value.trim().toUpperCase();
    }
    localStorage.setItem('pos_settings', JSON.stringify(appSettings));
    applyTheme();
    applyFeatures();
    
    if (licenseStatus) {
        licenseStatus.innerText = isPremium() ? "Estado: Versión Premium (Sin Anuncios)" : "Estado: Versión Gratuita (Con Anuncios)";
        licenseStatus.style.color = isPremium() ? "var(--success)" : "var(--text-muted)";
    }
    
    alert('Configuración guardada exitosamente');
});

document.getElementById('btn-backup-db').addEventListener('click', () => {
    try {
        const data = db.db.export();
        const blob = new Blob([data], { type: 'application/x-sqlite3' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `pos_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
        a.click();
    } catch(e) {
        alert('Error al respaldar la base de datos');
        console.error(e);
    }
});

document.getElementById('btn-check-updates').addEventListener('click', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
                reg.update().then(() => {
                    alert('Se ha comprobado la última versión. Si hay una actualización disponible, aparecerá un aviso en breve.');
                });
            } else {
                alert('El sistema de actualizaciones no está activo en este navegador.');
            }
        });
    } else {
        alert('Tu navegador no soporta actualizaciones en segundo plano.');
    }
});

// --- IMPORT / EXPORT CONFIG ---
document.getElementById('btn-export-config').addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appSettings, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `pos_config_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
});

const btnImportConfig = document.getElementById('btn-import-config');
const inputImportConfig = document.getElementById('input-import-config');

if (btnImportConfig) {
    btnImportConfig.addEventListener('click', () => inputImportConfig.click());
    
    inputImportConfig.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedSettings = JSON.parse(event.target.result);
                if (importedSettings && typeof importedSettings === 'object') {
                    appSettings = { ...appSettings, ...importedSettings };
                    localStorage.setItem('pos_settings', JSON.stringify(appSettings));
                    alert('Configuración importada exitosamente. La página se recargará.');
                    window.location.reload();
                }
            } catch (err) {
                alert('Error al leer el archivo de configuración. Asegúrate de que sea un JSON válido.');
            }
        };
        reader.readAsText(file);
    });
}

// --- IMPORT DB ---
const btnImportDb = document.getElementById('btn-import-db');
const inputImportDb = document.getElementById('input-import-db');

if (btnImportDb) {
    btnImportDb.addEventListener('click', () => inputImportDb.click());
    
    inputImportDb.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (confirm('ADVERTENCIA: Esto sobrescribirá completamente tu inventario, ventas y clientes actuales con los datos del archivo subido. ¿Estás seguro de continuar?')) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const uInt8Array = new Uint8Array(event.target.result);
                    await db.importFromBuffer(uInt8Array);
                    alert('Base de Datos restaurada con éxito. La página se recargará.');
                    window.location.reload();
                } catch (err) {
                    alert('Error al restaurar la base de datos: ' + err.message);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        e.target.value = ''; // reset
    });
}

// Run App
window.onload = initApp;
