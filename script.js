// ========== Data Management ========== //

const DEFAULT_ITEMS = [
    { name: "Coke", cartonSize: 24, stock: 100, weeklySales: 80, leadTime: 3, lowStockThreshold: null },
    { name: "Detergent", cartonSize: 12, stock: 36, weeklySales: 24, leadTime: 4, lowStockThreshold: null },
    { name: "Biscuits", cartonSize: 36, stock: 72, weeklySales: 60, leadTime: 2, lowStockThreshold: null },
    { name: "Soap", cartonSize: 24, stock: 48, weeklySales: 30, leadTime: 5, lowStockThreshold: null },
    { name: "Rice", cartonSize: 12, stock: 60, weeklySales: 40, leadTime: 6, lowStockThreshold: null },
    { name: "Pasta", cartonSize: 24, stock: 30, weeklySales: 18, leadTime: 3, lowStockThreshold: null },
    { name: "Sardines", cartonSize: 12, stock: 24, weeklySales: 20, leadTime: 2, lowStockThreshold: null },
    { name: "Milk", cartonSize: 24, stock: 70, weeklySales: 55, leadTime: 3, lowStockThreshold: null },
    { name: "Sugar", cartonSize: 12, stock: 45, weeklySales: 35, leadTime: 4, lowStockThreshold: null },
    { name: "Cooking Oil", cartonSize: 12, stock: 20, weeklySales: 18, leadTime: 7, lowStockThreshold: null },
    { name: "Bread", cartonSize: 36, stock: 54, weeklySales: 48, leadTime: 1, lowStockThreshold: null },
    { name: "Eggs", cartonSize: 12, stock: 60, weeklySales: 50, leadTime: 2, lowStockThreshold: null },
    { name: "Noodles", cartonSize: 24, stock: 40, weeklySales: 30, leadTime: 3, lowStockThreshold: null },
    { name: "Salt", cartonSize: 12, stock: 36, weeklySales: 22, leadTime: 5, lowStockThreshold: null },
    { name: "Beans", cartonSize: 24, stock: 30, weeklySales: 20, leadTime: 6, lowStockThreshold: null }
];

const LS_KEY = "supermarket_items";
const LS_THRESHOLD_KEY = "global_low_stock_threshold";

function loadItems() {
    const data = localStorage.getItem(LS_KEY);
    return data ? JSON.parse(data) : DEFAULT_ITEMS.slice();
}

function saveItems(items) {
    localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function loadGlobalLowStockThreshold() {
    return Number(localStorage.getItem(LS_THRESHOLD_KEY)) || 10;
}
function saveGlobalLowStockThreshold(val) {
    localStorage.setItem(LS_THRESHOLD_KEY, val);
}

// ========== App Logic ========== //

let items = loadItems();
let globalLowStockThreshold = loadGlobalLowStockThreshold();

const flowMultipliers = { average: 1.0, busy: 1.1, slow: 0.9 };

function getGrowth() {
    return Number(document.getElementById('growth').value);
}
function getFlow() {
    return document.getElementById('flow').value;
}
function getFlowMultiplier() {
    return flowMultipliers[getFlow()] || 1.0;
}

function getLowStockThreshold(item) {
    return item.lowStockThreshold != null && item.lowStockThreshold !== ""
        ? Number(item.lowStockThreshold) : globalLowStockThreshold;
}

function getOrderByDate(leadTime, buffer = 2) {
    // Order by = today + leadTime - buffer
    const days = Math.max(leadTime - buffer, 0);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().substring(0, 10);
}

function calculateResults() {
    const growth = getGrowth();
    const multiplier = getFlowMultiplier();
    return items.map((item, idx) => {
        const projectedSales = Math.round(item.weeklySales * (1 + growth / 100) * multiplier);
        const needed = projectedSales - item.stock;
        const cartonsToBuy = needed > 0 ? Math.ceil(needed / item.cartonSize) : 0;
        const orderByDate = getOrderByDate(Number(item.leadTime));
        const threshold = getLowStockThreshold(item);
        const lowStock = Number(item.stock) < threshold;
        return {
            ...item,
            projectedSales,
            cartonsToBuy,
            orderByDate,
            threshold,
            lowStock,
            idx
        };
    });
}

function getFastMovers() {
    // Top 3 by last week sales
    return [...items].sort((a, b) => b.weeklySales - a.weeklySales).slice(0, 3);
}

// ========== Rendering ========== //

function renderTable() {
    const tbody = document.getElementById('results');
    tbody.innerHTML = "";
    const results = calculateResults();
    let lowStockRows = [];

    results.forEach((row, i) => {
        const tr = document.createElement('tr');
        if (row.cartonsToBuy > 0) tr.classList.add('urgent');
        if (row.lowStock) {
            tr.classList.add('low-stock');
            lowStockRows.push(row);
        }
        if (getFastMovers().find(item => item.name === row.name)) tr.classList.add('fast-mover');

        tr.innerHTML = `
            <td><input type="text" value="${row.name}" data-idx="${i}" data-field="name"></td>
            <td><input type="number" min="1" value="${row.cartonSize}" data-idx="${i}" data-field="cartonSize"></td>
            <td><input type="number" min="0" value="${row.stock}" data-idx="${i}" data-field="stock"></td>
            <td><input type="number" min="0" value="${row.weeklySales}" data-idx="${i}" data-field="weeklySales"></td>
            <td><input type="number" min="1" value="${row.leadTime}" data-idx="${i}" data-field="leadTime"></td>
            <td><input type="number" min="0" placeholder="${globalLowStockThreshold}" value="${row.lowStockThreshold != null ? row.lowStockThreshold : ""}" data-idx="${i}" data-field="lowStockThreshold"></td>
            <td>${row.projectedSales}</td>
            <td>${row.orderByDate}</td>
            <td>${row.cartonsToBuy > 0 ? `<strong>${row.cartonsToBuy}</strong>` : 0}</td>
            <td class="actions">
                <button class="delete-btn" data-idx="${i}" title="Delete Item">&#128465;</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add event listeners for editing
    tbody.querySelectorAll('input[type="number"], input[type="text"]').forEach(input => {
        input.addEventListener('change', onTableInputEdit);
    });
    // Delete
    tbody.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', onDeleteItem);
    });

    // Low stock alerts summary
    const alertDiv = document.getElementById('low-stock-alert');
    if (lowStockRows.length) {
        alertDiv.style.display = "block";
        alertDiv.innerHTML = `⚠️ <strong>Low Stock Alert:</strong> ${lowStockRows.map(r=>r.name).join(", ")}`;
    } else {
        alertDiv.style.display = "none";
    }
}

function renderFastMovers() {
    const ul = document.getElementById('fast-movers');
    ul.innerHTML = "";
    getFastMovers().forEach(item => {
        const li = document.createElement('li');
        li.textContent = `${item.name} (sold ${item.weeklySales} last week)`;
        ul.appendChild(li);
    });
}

function rerenderAll() {
    renderTable();
    renderFastMovers();
}

// ========== Table Edit & Item Management ========== //

function onTableInputEdit(e) {
    const idx = Number(e.target.dataset.idx);
    const field = e.target.dataset.field;
    let value = e.target.value;
    if (["cartonSize", "stock", "weeklySales", "leadTime", "lowStockThreshold"].includes(field)) {
        value = value === "" ? null : Number(value);
    }
    items[idx][field] = value;
    saveItems(items);
    rerenderAll();
}

function onDeleteItem(e) {
    const idx = Number(e.target.dataset.idx);
    if (confirm(`Delete item "${items[idx].name}"?`)) {
        items.splice(idx, 1);
        saveItems(items);
        rerenderAll();
    }
}

// ========== Add Item ========== //

document.getElementById('add-item-form').addEventListener('submit', function(e){
    e.preventDefault();
    const name = document.getElementById('add-name').value.trim();
    const cartonSize = Number(document.getElementById('add-cartonSize').value);
    const stock = Number(document.getElementById('add-stock').value);
    const weeklySales = Number(document.getElementById('add-weeklySales').value);
    const leadTime = Number(document.getElementById('add-leadTime').value);
    const lowStockThreshold = document.getElementById('add-lowStockThreshold').value !== "" ? Number(document.getElementById('add-lowStockThreshold').value) : null;

    if (!name || cartonSize < 1 || stock < 0 || weeklySales < 0 || leadTime < 1) {
        alert("Please fill all fields correctly.");
        return;
    }
    items.push({ name, cartonSize, stock, weeklySales, leadTime, lowStockThreshold });
    saveItems(items);
    this.reset();
    switchPage("home");
    rerenderAll();
});

// ========== Settings ========== //

document.getElementById('global-low-stock-threshold').value = globalLowStockThreshold;
document.getElementById('global-low-stock-threshold').addEventListener('change', function(e){
    globalLowStockThreshold = Number(e.target.value) || 10;
    saveGlobalLowStockThreshold(globalLowStockThreshold);
    rerenderAll();
});
document.getElementById('reset-data').addEventListener('click', function(){
    if (confirm("Are you sure you want to reset all data? This cannot be undone.")) {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(LS_THRESHOLD_KEY);
        items = DEFAULT_ITEMS.slice();
        globalLowStockThreshold = 10;
        document.getElementById('global-low-stock-threshold').value = 10;
        rerenderAll();
        alert("Data reset.");
    }
});

// ========== Controls & Navigation ========== //

document.getElementById('growth').addEventListener('change', rerenderAll);
document.getElementById('flow').addEventListener('change', rerenderAll);

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.style.display = "none");
    document.getElementById(page + '-page').style.display = "block";
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelectorAll('.nav-link[data-page="'+page+'"]').forEach(link => link.classList.add('active'));
    if (page === "home") rerenderAll();
}
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e){
        e.preventDefault();
        switchPage(this.dataset.page);
    });
});

// Mobile nav toggle
document.querySelector('.nav-toggle').addEventListener('click', function(){
    document.querySelector('.nav-links').classList.toggle('show');
});

// ========== PDF Export (Customized) ========== //

document.getElementById('export-pdf').addEventListener('click', function(){
    const results = calculateResults();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Only items with cartonsToBuy > 0
    const filtered = results.filter(row => row.cartonsToBuy > 0);

    // Header
    doc.setFontSize(16);
    doc.text("Download Order", 14, 18);

    // Timestamp
    const now = new Date();
    const dateStr = now.toLocaleDateString();
    const timeStr = now.toLocaleTimeString();
    doc.setFontSize(10);
    doc.text(`Date: ${dateStr}    Time: ${timeStr}`, 14, 26);

    if (filtered.length === 0) {
        doc.setFontSize(12);
        doc.text("No items to order (no suggested cartons).", 14, 40);
        doc.save("order.pdf");
        return;
    }

    // Table header
    doc.setFontSize(12);
    const startY = 32;
    doc.text("S/N", 14, startY);
    doc.text("Item", 30, startY);
    doc.text("Cartons to Order", 120, startY);

    // Table rows
    let y = startY + 8;
    filtered.forEach((row, idx) => {
        doc.text(String(idx + 1), 14, y);
        doc.text(row.name, 30, y);
        doc.text(String(row.cartonsToBuy), 135, y, {align: "right"});
        y += 8;
        if (y > 270) {
            doc.addPage();
            y = 18;
        }
    });

    // Footer with timestamp
    doc.setFontSize(10);
    doc.text(`Generated by Procurement Assistant on ${dateStr} at ${timeStr}`, 14, y + 12);

    doc.save("order.pdf");
});

// ========== Initial Render ========== //

rerenderAll();
switchPage("home");