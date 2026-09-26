import * as React from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import {
  Badge, Button, Card, Col, Form, InputGroup, Modal, Row, Table,
} from 'react-bootstrap';

const initialProducts = [
  { id: 1, name: 'Steel Rods', sku: 'STL-2040', category: 'Raw Materials', unit: 'kg', reorder: 50, stock: { 'Main Warehouse': 128, 'Production Floor': 24 } },
  { id: 2, name: 'Office Chair', sku: 'FUR-0102', category: 'Furniture', unit: 'units', reorder: 20, stock: { 'Main Warehouse': 18, 'Production Floor': 0 } },
  { id: 3, name: 'Aluminum Sheets', sku: 'ALU-1008', category: 'Raw Materials', unit: 'sheets', reorder: 30, stock: { 'Main Warehouse': 64, 'Production Floor': 12 } },
  { id: 4, name: 'Safety Gloves', sku: 'PPE-0051', category: 'Safety', unit: 'pairs', reorder: 25, stock: { 'Main Warehouse': 9, 'Production Floor': 0 } },
  { id: 5, name: 'Packing Boxes', sku: 'PKG-0300', category: 'Packaging', unit: 'units', reorder: 100, stock: { 'Main Warehouse': 245, 'Production Floor': 0 } },
  { id: 6, name: 'Copper Wire', sku: 'ELC-0018', category: 'Electrical', unit: 'rolls', reorder: 15, stock: { 'Main Warehouse': 0, 'Production Floor': 0 } },
];
const warehouses = ['Main Warehouse', 'Production Floor'];
const starterDocs = [
  { id: 'RCV-24018', type: 'Receipt', partner: 'Apex Metals Co.', product: 'Steel Rods', qty: 50, location: 'Main Warehouse', status: 'Waiting', date: 'Today, 10:42 AM' },
  { id: 'OUT-24009', type: 'Delivery', partner: 'Northstar Furniture', product: 'Office Chair', qty: 12, location: 'Main Warehouse', status: 'Ready', date: 'Today, 9:18 AM' },
  { id: 'INT-24006', type: 'Internal', partner: 'Main Warehouse → Production Floor', product: 'Aluminum Sheets', qty: 8, location: 'Production Floor', status: 'Scheduled', date: 'Yesterday, 4:32 PM' },
];
const number = (value) => Number(value || 0).toLocaleString();
const totalStock = (product) => Object.values(product.stock).reduce((sum, qty) => sum + qty, 0);
const readSaved = (key, fallback) => {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
};

export default function App() {
  const [products, setProducts] = React.useState(() => readSaved('stocksense-products', initialProducts));
  const [docs, setDocs] = React.useState(() => readSaved('stocksense-operations', starterDocs));
  const [page, setPage] = React.useState('Dashboard');
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('All types');
  const [statusFilter, setStatusFilter] = React.useState('All statuses');
  const [locationFilter, setLocationFilter] = React.useState('All locations');
  const [categoryFilter, setCategoryFilter] = React.useState('All categories');
  const [modal, setModal] = React.useState('');
  const [form, setForm] = React.useState({ type: 'Receipt', productId: '1', qty: '', location: warehouses[0], destination: warehouses[1], partner: '', counted: '', name: '', sku: '', category: 'Raw Materials', unit: 'units', reorder: '10', initial: '0' });
  const [toast, setToast] = React.useState('');
  const [warehouseList, setWarehouseList] = React.useState(() => readSaved('stocksense-locations', warehouses));

  React.useEffect(() => {
    try {
      window.localStorage.setItem('stocksense-products', JSON.stringify(products));
      window.localStorage.setItem('stocksense-operations', JSON.stringify(docs));
      window.localStorage.setItem('stocksense-locations', JSON.stringify(warehouseList));
    } catch {
    }
  }, [products, docs, warehouseList]);

  const showToast = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };
  const openOperation = (type) => {
    setForm((prev) => ({ ...prev, type, qty: '', counted: '', partner: '', location: warehouseList[0], destination: warehouseList[1] || warehouseList[0] }));
    setModal('operation');
  };
  const createOperation = (event) => {
    event.preventDefault();
    const product = products.find((item) => item.id === Number(form.productId));
    if (!product) { showToast('Add a product before recording an operation.'); return; }
    if (!warehouseList.includes(form.location)) { showToast('Select a valid location.'); return; }
    if (form.type === 'Internal' && (!warehouseList.includes(form.destination) || form.destination === form.location)) {
      showToast('Choose a different destination location.');
      return;
    }
    const enteredQty = Number(form.type === 'Adjustment' ? form.counted : form.qty);
    if (!Number.isFinite(enteredQty) || enteredQty < 0 || (form.type !== 'Adjustment' && enteredQty === 0)) {
      showToast(form.type === 'Adjustment' ? 'Enter a valid counted quantity.' : 'Quantity must be greater than zero.');
      return;
    }
    const qty = enteredQty;
    const updated = products.map((item) => {
      if (item.id !== product.id) return item;
      const stock = { ...item.stock };
      const source = form.location;
      if (form.type === 'Receipt') stock[source] = (stock[source] || 0) + qty;
      if (form.type === 'Delivery') {
        if ((stock[source] || 0) < qty) { showToast('Not enough stock at this location.'); return item; }
        stock[source] = (stock[source] || 0) - qty;
      }
      if (form.type === 'Internal') {
        if ((stock[source] || 0) < qty) { showToast('Not enough stock at the source location.'); return item; }
        stock[source] = (stock[source] || 0) - qty;
        stock[form.destination] = (stock[form.destination] || 0) + qty;
      }
      if (form.type === 'Adjustment') stock[source] = Math.max(0, Number(form.counted));
      return { ...item, stock };
    });
    const failed = (form.type === 'Delivery' || form.type === 'Internal') && (product.stock[form.location] || 0) < qty;
    if (failed) return;
    setProducts(updated);
    const idPrefix = form.type === 'Receipt' ? 'RCV' : form.type === 'Delivery' ? 'OUT' : form.type === 'Internal' ? 'INT' : 'ADJ';
    const document = {
      id: `${idPrefix}-${Date.now().toString().slice(-5)}`,
      type: form.type,
      partner: form.type === 'Internal' ? `${form.location} → ${form.destination}` : form.partner || (form.type === 'Adjustment' ? 'Physical count' : 'Manual entry'),
      product: product.name,
      qty: form.type === 'Adjustment' ? Math.abs(Number(form.counted) - (product.stock[form.location] || 0)) : qty,
      location: form.location,
      status: 'Done',
      date: new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    };
    setDocs((previous) => [document, ...previous]);
    setModal('');
    showToast(`${form.type} validated. Stock has been updated.`);
  };
  const createProduct = (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const sku = form.sku.trim().toUpperCase();
    if (!name || !sku) { showToast('Product name and SKU are required.'); return; }
    if (products.some((product) => product.sku.toUpperCase() === sku)) {
      showToast('That SKU is already in use.');
      return;
    }
    const initialStock = Number(form.initial);
    const reorderPoint = Number(form.reorder);
    if (!Number.isFinite(initialStock) || initialStock < 0 || !Number.isFinite(reorderPoint) || reorderPoint < 0) {
      showToast('Stock and reorder values must be zero or greater.');
      return;
    }
    const product = {
      id: Date.now(), name: form.name.trim(), sku: form.sku.trim().toUpperCase(), category: form.category,
      unit: form.unit, reorder: Number(form.reorder) || 0,
      stock: Object.fromEntries(warehouseList.map((location, index) => [location, index === 0 ? Number(form.initial) || 0 : 0])),
    };
    setProducts((previous) => [product, ...previous]);
    setModal('');
    setForm((prev) => ({ ...prev, name: '', sku: '', initial: '0' }));
    showToast('Product added to your catalog.');
  };
  const createWarehouse = (event) => {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) { showToast('Enter a location name.'); return; }
    if (warehouseList.some((location) => location.toLowerCase() === name.toLowerCase())) {
      showToast('A location with that name already exists.');
      return;
    }
    setWarehouseList((previous) => [...previous, name]);
    setModal('');
    setForm((prev) => ({ ...prev, name: '' }));
    showToast('Location added.');
  };

  const lowStockCount = products.filter((product) => totalStock(product) <= Number(product.reorder)).length;
  const pendingReceipts = docs.filter((doc) => doc.type === 'Receipt' && doc.status !== 'Done' && doc.status !== 'Canceled').length;
  const pendingDeliveries = docs.filter((doc) => doc.type === 'Delivery' && doc.status !== 'Done' && doc.status !== 'Canceled').length;
  const pendingTransfers = docs.filter((doc) => doc.type === 'Internal' && doc.status !== 'Done' && doc.status !== 'Canceled').length;
  const filteredProducts = products.filter((product) => {
    const query = search.toLowerCase();
    const matchesSearch = `${product.name} ${product.sku} ${product.category}`.toLowerCase().includes(query);
    const matchesCategory = categoryFilter === 'All categories' || product.category === categoryFilter;
    const matchesLocation = locationFilter === 'All locations' || (product.stock[locationFilter] || 0) > 0;
    return matchesSearch && matchesCategory && matchesLocation;
  });
  const filteredDocs = docs.filter((doc) =>
    (typeFilter === 'All types' || doc.type === typeFilter) &&
    (statusFilter === 'All statuses' || doc.status === statusFilter) &&
    (locationFilter === 'All locations' || doc.location === locationFilter || (doc.type === 'Internal' && doc.partner.includes(locationFilter))) &&
    `${doc.id} ${doc.product} ${doc.partner}`.toLowerCase().includes(search.toLowerCase()),
  );
  const navItems = [
    { heading: 'WORKSPACE', items: [['Dashboard', '▦'], ['Products', '▤']] },
    { heading: 'OPERATIONS', items: [['Receipts', '↓'], ['Delivery Orders', '↑'], ['Internal Transfers', '⇄'], ['Adjustments', '±'], ['Move History', '↗']] },
    { heading: 'CONFIGURATION', items: [['Warehouses', '⌂'], ['Settings', '⚙']] },
  ];
  const openProductModal = () => {
    setForm((prev) => ({ ...prev, name: '', sku: '', category: 'Raw Materials', unit: 'units', reorder: '10', initial: '0' }));
    setModal('product');
  };
  const pageType = ({ Receipts: 'Receipt', 'Delivery Orders': 'Delivery', 'Internal Transfers': 'Internal', Adjustments: 'Adjustment' })[page];

  return (
    <div className="app-shell">
      <style>{`
        :root { --ink:#172b4d; --muted:#75839a; --line:#e8edf3; --canvas:#f6f8fb; --navy:#13294b; --green:#16856a; }
        * { box-sizing:border-box; } body { margin:0; background:var(--canvas); color:var(--ink); font-family:'DM Sans',sans-serif; font-size:14px; }
        .app-shell { min-height:100vh; display:flex; } .sidebar { width:250px; flex:0 0 250px; background:var(--navy); color:#d4deec; padding:23px 15px 18px; display:flex; flex-direction:column; min-height:100vh; }
        .brand { display:flex; gap:11px; align-items:center; padding:0 10px 28px; color:#fff; font:800 19px Manrope,sans-serif; letter-spacing:-.5px; }.brand-mark { width:34px;height:34px;border-radius:10px;background:#23a483;display:grid;place-items:center;color:white;font-size:19px; }
        .workspace-switch { margin:0 3px 27px;padding:11px;background:#20395b;border:1px solid #2c4568;border-radius:10px;display:flex;align-items:center;gap:10px;color:#fff; }.workspace-avatar { width:30px;height:30px;background:#d7ede7;color:#16856a;border-radius:8px;display:grid;place-items:center;font-weight:700; }.workspace-switch small { display:block;color:#a7b8cf;font-size:11px;margin-top:2px; }
        .nav-heading { color:#8ca0bb;font-size:10px;font-weight:700;letter-spacing:1.15px;padding:0 12px;margin:0 0 9px; }.side-link { color:#c5d1e1;border-radius:8px;padding:10px 12px;margin:2px 0;display:flex;align-items:center;gap:12px;font-size:13px;font-weight:500;cursor:pointer;transition:.15s; }.side-link:hover { color:white;background:#20395b; }.side-link.active { color:white;background:#205c5d;box-shadow:inset 3px 0 #55c5a0; }.side-icon { width:17px;text-align:center;font-size:17px;line-height:1; }.sidebar-group { margin-bottom:24px; }.side-bottom { margin-top:auto;border-top:1px solid #2a4262;padding-top:15px; }.user-card { display:flex;align-items:center;gap:10px;padding:9px 8px;color:white; }.user-avatar { width:34px;height:34px;border-radius:50%;background:#eed6c6;color:#784b39;display:grid;place-items:center;font-weight:700; }.user-card small { display:block;color:#9fb0c7;font-size:11px;margin-top:2px; }
        .main { flex:1;min-width:0; }.topbar { height:70px;background:#fff;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 34px; }.crumb { color:#8491a4;font-size:13px; }.crumb strong { color:#263b59;font-weight:600; }.top-actions { display:flex;align-items:center;gap:18px;color:#78869a; }.icon-button { border:0;background:transparent;color:#78869a;font-size:19px;position:relative; }.notification-dot { position:absolute;width:6px;height:6px;border-radius:50%;background:#e56e5a;top:3px;right:2px;border:1px solid white; }.top-user { width:32px;height:32px;border-radius:50%;background:#dbe8f5;color:#385b80;display:grid;place-items:center;font-weight:700;font-size:12px; }
        .content { padding:31px 36px 40px;max-width:1520px;margin:0 auto; }.page-title-row { display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:25px;gap:16px; }.eyebrow { font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8996a9;font-weight:700;margin-bottom:7px; }.page-title { font:800 25px Manrope,sans-serif;letter-spacing:-.7px;margin:0;color:#182e4d; }.sub-title { color:#8491a4;margin-top:6px;font-size:13px; }.btn { border-radius:7px;font-weight:600;font-size:13px;padding:9px 14px; }.btn-success { background:#16856a;border-color:#16856a; }.btn-success:hover { background:#117359;border-color:#117359; }.btn-outline-secondary { border-color:#dce3eb;color:#52647d; }.btn-light { border:1px solid #e4e9ef;background:#fff;color:#40536d; }.kpi-card { border:1px solid var(--line);border-radius:11px;box-shadow:0 2px 7px rgba(24,46,77,.025);height:100%; }.kpi-card .card-body { padding:19px 20px; }.kpi-label { color:#77869b;font-weight:600;font-size:12px; }.kpi-value { font:800 25px Manrope,sans-serif;letter-spacing:-.8px;color:#1a304e;margin:10px 0 4px; }.kpi-foot { color:#96a1b0;font-size:11px; }.kpi-icon { width:36px;height:36px;border-radius:10px;display:grid;place-items:center;font-size:17px;font-weight:700; }.icon-blue { background:#edf4ff;color:#4a7ac0; }.icon-orange { background:#fff4e8;color:#d38a35; }.icon-green { background:#e8f7f1;color:#16856a; }.icon-purple { background:#f2efff;color:#7863bd; }.kpi-top { display:flex;justify-content:space-between;align-items:center; }.section-card { background:#fff;border:1px solid var(--line);border-radius:11px;box-shadow:0 2px 7px rgba(24,46,77,.025); }.section-head { padding:18px 20px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px; }.section-heading { font:700 15px Manrope,sans-serif;color:#243a58;margin:0; }.section-sub { color:#8995a7;font-size:12px;margin-top:4px; }.text-link { color:#16856a;text-decoration:none;font-weight:600;font-size:12px;cursor:pointer; }.table { margin:0;vertical-align:middle; }.table thead th { color:#8895a7;background:#fbfcfd;font-size:10px;letter-spacing:.6px;text-transform:uppercase;font-weight:700;border-bottom:1px solid var(--line);padding:12px 18px;white-space:nowrap; }.table tbody td { padding:13px 18px;border-color:#eef1f5;color:#53647a;font-size:12px; }.product-name { color:#243a58;font-weight:600;font-size:13px; }.sku { color:#929eaf;font-size:11px;margin-top:3px; }.stock-number { font-weight:700;color:#354a66; }.badge-soft { border-radius:20px;padding:5px 9px;font-size:10px;font-weight:700; }.status-done { color:#16856a;background:#e6f5ef; }.status-waiting { color:#b9791a;background:#fff4df; }.status-ready { color:#4d72b4;background:#edf3ff; }.status-scheduled { color:#8069bd;background:#f1edff; }.status-canceled { color:#a66363;background:#fbeeee; }.status-draft { color:#75839a;background:#eef1f5; }.avatar-initial { width:28px;height:28px;border-radius:8px;background:#edf3fa;display:inline-grid;place-items:center;color:#50749b;font-weight:700;margin-right:9px; }.toolbar { display:flex;align-items:center;gap:9px;flex-wrap:wrap; }.form-control,.form-select { border-color:#dfe5ec;border-radius:7px;font-size:13px;padding:9px 11px;color:#3f526c; }.form-control:focus,.form-select:focus { border-color:#77bea9;box-shadow:0 0 0 .18rem rgba(22,133,106,.1); }.search-box { width:230px; }.filter-select { width:auto;min-width:135px; }.quick-action { border:1px solid var(--line);background:#fff;border-radius:10px;padding:15px;display:flex;align-items:center;gap:12px;width:100%;text-align:left;transition:.18s; }.quick-action:hover { border-color:#a8d7c9;transform:translateY(-1px);box-shadow:0 4px 12px rgba(24,46,77,.06); }.quick-icon { width:37px;height:37px;border-radius:9px;display:grid;place-items:center;font-size:18px;font-weight:700; }.quick-action strong { display:block;color:#2a405e;font-size:12px; }.quick-action small { color:#93a0b0;font-size:11px; }.inventory-alert { border:0;border-radius:10px;background:#fff7e8;color:#876025;padding:13px 16px;font-size:12px; }.progress-track { height:5px;border-radius:10px;background:#edf0f4;width:90px;display:inline-block;margin-right:7px;vertical-align:middle; }.progress-fill { height:100%;border-radius:10px;background:#e2a648; }.empty-state { text-align:center;padding:42px 16px;color:#8995a7; }.warehouse-tile { padding:18px;border:1px solid var(--line);border-radius:10px;background:#fff; }.toast-message { position:fixed;bottom:22px;right:24px;background:#183856;color:#fff;padding:13px 18px;border-radius:9px;box-shadow:0 8px 28px #18385633;z-index:1100;font-size:13px; }
        @media(max-width:900px){.sidebar{width:215px;flex-basis:215px}.content{padding:25px 22px}.topbar{padding:0 22px}.search-box{width:190px}}
        @media(max-width:650px){.sidebar{width:58px;flex-basis:58px;padding:18px 8px}.brand{padding:0 4px 25px}.brand-name,.workspace-switch>div:last-child,.nav-heading,.side-link span:last-child,.user-card>div:last-child{display:none}.workspace-switch{padding:7px 5px;justify-content:center;margin:0 0 20px}.side-link{justify-content:center;padding:11px 5px}.side-icon{width:auto}.user-card{justify-content:center;padding:5px 0}.sidebar-group{margin-bottom:15px}.topbar{height:59px;padding:0 14px}.content{padding:23px 14px}.page-title{font-size:21px}.page-title-row{align-items:center}.top-actions{gap:10px}.search-box{width:100%}.filter-select{flex:1;min-width:120px}.table-responsive{border-radius:0 0 11px 11px}}
      `}</style>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">S</div><span className="brand-name">stocksense</span></div>
        <div className="workspace-switch"><div className="workspace-avatar">N</div><div><div style={{ fontSize: 12, fontWeight: 600 }}>Northstar Supply</div><small>Operations workspace</small></div><span style={{ marginLeft: 'auto', color: '#9fb0c7' }}>⌄</span></div>
        {navItems.map((group) => <div className="sidebar-group" key={group.heading}><div className="nav-heading">{group.heading}</div>{group.items.map(([label, icon]) => <div key={label} className={`side-link ${page === label ? 'active' : ''}`} onClick={() => { setPage(label); setSearch(''); }}><span className="side-icon">{icon}</span><span>{label}</span></div>)}</div>)}
        <div className="side-bottom"><div className="side-link" onClick={() => { setPage('My Profile'); }}><span className="side-icon">◉</span><span>My Profile</span></div><div className="user-card"><div className="user-avatar">JD</div><div><div style={{ fontSize: 12, fontWeight: 600 }}>Jordan Davis</div><small>Inventory Manager</small></div><span style={{ marginLeft: 'auto', color: '#91a5bf' }}>•••</span></div></div>
      </aside>
      <main className="main">
        <header className="topbar"><div className="crumb">Workspace <span style={{ margin: '0 9px', color: '#c0c8d2' }}>/</span> <strong>{page}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications">♧<span className="notification-dot" /></button><span style={{ height: 24, borderLeft: '1px solid #e8edf3' }} /><div className="top-user">JD</div></div></header>
        <div className="content">
          {page === 'Dashboard' && <>
            <div className="page-title-row"><div><div className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}</div><h1 className="page-title">Inventory overview</h1><div className="sub-title">Here's what's happening across your warehouses today.</div></div><Button variant="success" onClick={() => openOperation('Receipt')}>＋ &nbsp;New operation</Button></div>
            <Row className="g-3 mb-4">
              <Col sm={6} xl={3}><Card className="kpi-card"><Card.Body><div className="kpi-top"><span className="kpi-label">Total products in stock</span><span className="kpi-icon icon-blue">▤</span></div><div className="kpi-value">{number(products.reduce((sum, p) => sum + totalStock(p), 0))}</div><div className="kpi-foot">Across {warehouseList.length} active locations</div></Card.Body></Card></Col>
              <Col sm={6} xl={3}><Card className="kpi-card"><Card.Body><div className="kpi-top"><span className="kpi-label">Low / out of stock</span><span className="kpi-icon icon-orange">⌁</span></div><div className="kpi-value">{lowStockCount} <span style={{ font: '500 12px "DM Sans"', color: '#9aa5b3' }}>items</span></div><div className="kpi-foot">{products.filter((p) => totalStock(p) === 0).length} products are out of stock</div></Card.Body></Card></Col>
              <Col sm={6} xl={2}><Card className="kpi-card"><Card.Body><div className="kpi-top"><span className="kpi-label">Pending receipts</span><span className="kpi-icon icon-green">↓</span></div><div className="kpi-value">{pendingReceipts}</div><div className="kpi-foot">Awaiting validation</div></Card.Body></Card></Col>
              <Col sm={6} xl={2}><Card className="kpi-card"><Card.Body><div className="kpi-top"><span className="kpi-label">Pending deliveries</span><span className="kpi-icon icon-purple">↑</span></div><div className="kpi-value">{pendingDeliveries}</div><div className="kpi-foot">Ready to dispatch</div></Card.Body></Card></Col>
              <Col sm={6} xl={2}><Card className="kpi-card"><Card.Body><div className="kpi-top"><span className="kpi-label">Transfers scheduled</span><span className="kpi-icon icon-blue">⇄</span></div><div className="kpi-value">{pendingTransfers}</div><div className="kpi-foot">Between locations</div></Card.Body></Card></Col>
            </Row>
            {lowStockCount > 0 && <div className="inventory-alert mb-4">⚠ &nbsp;<strong>Stock attention needed</strong> &nbsp;{lowStockCount} products are at or below their reorder point. <span className="text-link" onClick={() => { setPage('Products'); setCategoryFilter('All categories'); }}>Review products →</span></div>}
            <Row className="g-3 mb-4"><Col xs={12}><div className="section-card"><div className="section-head"><div><h2 className="section-heading">Quick actions</h2><div className="section-sub">Keep your inventory moving</div></div></div><div className="px-3 pb-3"><Row className="g-2">
              {[["Receipt", '↓', 'icon-green', 'Receive incoming stock'], ['Delivery', '↑', 'icon-blue', 'Ship an order'], ['Internal', '⇄', 'icon-purple', 'Move stock internally'], ['Adjustment', '±', 'icon-orange', 'Update stock count']].map(([type, icon, color, label]) => <Col xs={12} sm={6} xl={3} key={type}><button className="quick-action" onClick={() => openOperation(type)}><span className={`quick-icon ${color}`}>{icon}</span><span><strong>{type === 'Internal' ? 'Internal transfer' : type === 'Adjustment' ? 'Stock adjustment' : type === 'Receipt' ? 'New receipt' : 'Delivery order'}</strong><small>{label}</small></span><span style={{ marginLeft: 'auto', color: '#a8b2bf' }}>›</span></button></Col>)}
            </Row></div></div></Col></Row>
            <div className="section-card"><div className="section-head"><div><h2 className="section-heading">Recent activity</h2><div className="section-sub">Latest stock movements and operations</div></div><span className="text-link" onClick={() => setPage('Move History')}>View history →</span></div><div className="table-responsive"><Table hover><thead><tr><th>Reference</th><th>Operation</th><th>Product</th><th>Quantity</th><th>Location</th><th>Status</th><th>Date</th></tr></thead><tbody>{docs.slice(0, 5).map((doc) => <tr key={doc.id}><td><strong style={{ color: '#415875' }}>{doc.id}</strong></td><td>{doc.type}</td><td><span className="product-name">{doc.product}</span></td><td>{doc.type === 'Adjustment' ? '± ' : doc.type === 'Receipt' ? '+ ' : doc.type === 'Delivery' ? '− ' : ''}{number(doc.qty)}</td><td>{doc.location}</td><td><StatusBadge status={doc.status} /></td><td>{doc.date}</td></tr>)}</tbody></Table></div></div>
          </>}

          {page === 'Products' && <>
            <div className="page-title-row"><div><div className="eyebrow">CATALOG</div><h1 className="page-title">Products</h1><div className="sub-title">Manage items, stock levels, and reorder points.</div></div><Button variant="success" onClick={openProductModal}>＋ &nbsp;Add product</Button></div>
            <div className="section-card"><div className="section-head" style={{ flexWrap: 'wrap' }}><div><h2 className="section-heading">Product catalog <span style={{ color: '#9aa6b5', font: '500 12px "DM Sans"' }}>({filteredProducts.length})</span></h2><div className="section-sub">Stock availability across all locations</div></div><div className="toolbar"><InputGroup className="search-box"><InputGroup.Text style={{ background: '#fff', borderColor: '#dfe5ec', color: '#93a0b0' }}>⌕</InputGroup.Text><Form.Control placeholder="Search products or SKU" value={search} onChange={(e) => setSearch(e.target.value)} /></InputGroup><Form.Select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option>All categories</option>{[...new Set(products.map((p) => p.category))].map((category) => <option key={category}>{category}</option>)}</Form.Select><Form.Select className="filter-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}><option>All locations</option>{warehouseList.map((location) => <option key={location}>{location}</option>)}</Form.Select></div></div>
              <div className="table-responsive"><Table hover><thead><tr><th>Product</th><th>Category</th><th>On hand</th><th>Reorder point</th><th>Stock status</th><th>Locations</th></tr></thead><tbody>{filteredProducts.map((product) => { const total = totalStock(product); const low = total <= Number(product.reorder); const qtyAtLocation = locationFilter === 'All locations' ? total : product.stock[locationFilter] || 0; return <tr key={product.id}><td><div className="product-name">{product.name}</div><div className="sku">{product.sku} · {product.unit}</div></td><td>{product.category}</td><td><span className="stock-number">{number(qtyAtLocation)}</span> <span style={{ color: '#8d99a9' }}>{product.unit}</span></td><td>{number(product.reorder)} {product.unit}</td><td>{total === 0 ? <Badge className="badge-soft status-canceled">Out of stock</Badge> : low ? <Badge className="badge-soft status-waiting">Low stock</Badge> : <Badge className="badge-soft status-done">In stock</Badge>}</td><td>{Object.entries(product.stock).filter(([, qty]) => qty > 0).map(([loc, qty]) => <div key={loc} style={{ fontSize: 11, marginBottom: 3 }}>{loc} <strong style={{ color: '#49617e' }}>{number(qty)}</strong></div>)}{total === 0 && <span style={{ color: '#98a3b1' }}>No stock</span>}</td></tr>; })}{filteredProducts.length === 0 && <tr><td colSpan="6"><div className="empty-state">No products match these filters.</div></td></tr>}</tbody></Table></div></div>
          </>}

          {pageType && <>
            <div className="page-title-row"><div><div className="eyebrow">STOCK OPERATIONS</div><h1 className="page-title">{page}</h1><div className="sub-title">{page === 'Receipts' ? 'Track and validate goods arriving from vendors.' : page === 'Delivery Orders' ? 'Pick, pack, and dispatch customer orders.' : page === 'Internal Transfers' ? 'Move stock between your warehouses and locations.' : 'Reconcile your recorded stock with a physical count.'}</div></div><Button variant="success" onClick={() => openOperation(pageType)}>＋ &nbsp;New {pageType.toLowerCase()}</Button></div>
            {page === 'Adjustments' && <div className="inventory-alert mb-3">Adjustments update your recorded quantity to match a physical count. Every change is added to the stock ledger.</div>}
            <OperationsTable docs={filteredDocs.filter((doc) => doc.type === pageType)} search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} locationFilter={locationFilter} setLocationFilter={setLocationFilter} warehouseList={warehouseList} />
          </>}

          {page === 'Move History' && <>
            <div className="page-title-row"><div><div className="eyebrow">AUDIT TRAIL</div><h1 className="page-title">Move history</h1><div className="sub-title">A complete, traceable ledger of every stock movement.</div></div><Button variant="outline-secondary" onClick={() => { setSearch(''); setTypeFilter('All types'); setStatusFilter('All statuses'); setLocationFilter('All locations'); }}>Clear filters</Button></div>
            <OperationsTable docs={filteredDocs} search={search} setSearch={setSearch} typeFilter={typeFilter} setTypeFilter={setTypeFilter} statusFilter={statusFilter} setStatusFilter={setStatusFilter} locationFilter={locationFilter} setLocationFilter={setLocationFilter} warehouseList={warehouseList} ledger />
          </>}

          {page === 'Warehouses' && <>            <div className="page-title-row"><div><div className="eyebrow">CONFIGURATION</div><h1 className="page-title">Warehouses & locations</h1><div className="sub-title">Manage the places where your inventory is stored.</div></div><Button variant="success" onClick={() => { setForm((prev) => ({ ...prev, name: '' })); setModal('warehouse'); }}>＋ &nbsp;Add location</Button></div><Row className="g-3">{warehouseList.map((location, index) => <Col sm={6} lg={4} key={location}><div className="warehouse-tile"><div style={{ display: 'flex', justifyContent: 'space-between' }}><span className="kpi-icon icon-blue">⌂</span><Badge className="badge-soft status-done">Active</Badge></div><h3 style={{ font: '700 15px Manrope', margin: '17px 0 5px' }}>{location}</h3><div style={{ color: '#8a97a8', fontSize: 12 }}>{products.filter((product) => (product.stock[location] || 0) > 0).length} products with available stock</div><div style={{ borderTop: '1px solid #edf0f4', marginTop: 16, paddingTop: 13, color: '#66778f', fontSize: 12 }}>Total units <strong style={{ float: 'right', color: '#263d5b' }}>{number(products.reduce((sum, product) => sum + (product.stock[location] || 0), 0))}</strong></div></div></Col>)}</Row></>}

          {page === 'Settings' && <><div className="page-title-row"><div><div className="eyebrow">PREFERENCES</div><h1 className="page-title">Settings</h1><div className="sub-title">Configure your StockSense workspace.</div></div></div><div className="section-card p-4" style={{ maxWidth: 700 }}><h2 className="section-heading mb-1">Reordering & alerts</h2><p className="section-sub mb-4">Set up how your team keeps inventory healthy.</p><Form><Form.Group className="mb-3"><Form.Label className="fw-semibold" style={{ fontSize: 13 }}>Default low-stock alert</Form.Label><Form.Select defaultValue="At reorder point"><option>At reorder point</option><option>Below reorder point</option><option>At 10% below reorder point</option></Form.Select><Form.Text className="text-muted">Products at or below their individual reorder level are flagged on the dashboard.</Form.Text></Form.Group><Form.Group className="mb-4"><Form.Label className="fw-semibold" style={{ fontSize: 13 }}>Default unit of measure</Form.Label><Form.Select defaultValue="Units"><option>Units</option><option>Pieces</option><option>Kilograms</option><option>Liters</option></Form.Select></Form.Group><Button type="button" variant="success" onClick={() => showToast('Settings saved.')}>Save settings</Button></Form></div></>}

          {page === 'My Profile' && <><div className="page-title-row"><div><div className="eyebrow">YOUR ACCOUNT</div><h1 className="page-title">My profile</h1><div className="sub-title">Manage your personal details and account preferences.</div></div></div><div className="section-card p-4" style={{ maxWidth: 700 }}><div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 25 }}><div className="user-avatar" style={{ width: 54, height: 54, fontSize: 16 }}>JD</div><div><div className="section-heading">Jordan Davis</div><div className="section-sub">Inventory Manager</div></div><Button variant="outline-secondary" className="ms-auto" onClick={() => showToast('Profile editing is ready for your workspace admin.')}>Edit profile</Button></div><Row className="g-3"><Col sm={6}><Form.Label className="text-muted">Email address</Form.Label><div className="fw-semibold">jordan.davis@northstar.co</div></Col><Col sm={6}><Form.Label className="text-muted">Workspace</Form.Label><div className="fw-semibold">Northstar Supply</div></Col></Row></div></>}
        </div>
      </main>

      <Modal show={modal === 'operation'} onHide={() => setModal('')} centered>
        <Form onSubmit={createOperation}><Modal.Header closeButton><Modal.Title style={{ font: '700 17px Manrope' }}>New {form.type === 'Internal' ? 'internal transfer' : form.type.toLowerCase()}</Modal.Title></Modal.Header><Modal.Body>
          <Form.Group className="mb-3"><Form.Label>Product</Form.Label><Form.Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</Form.Select></Form.Group>
          {form.type !== 'Adjustment' ? <Form.Group className="mb-3"><Form.Label>Quantity</Form.Label><InputGroup><Form.Control type="number" min="1" required value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="Enter quantity" /><InputGroup.Text>{products.find((p) => p.id === Number(form.productId))?.unit || 'units'}</InputGroup.Text></InputGroup></Form.Group> : <Form.Group className="mb-3"><Form.Label>Counted quantity</Form.Label><InputGroup><Form.Control type="number" min="0" required value={form.counted} onChange={(e) => setForm({ ...form, counted: e.target.value })} placeholder="Enter physical count" /><InputGroup.Text>{products.find((p) => p.id === Number(form.productId))?.unit || 'units'}</InputGroup.Text></InputGroup></Form.Group>}
          <Form.Group className="mb-3"><Form.Label>{form.type === 'Internal' ? 'From location' : 'Warehouse / location'}</Form.Label><Form.Select value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}>{warehouseList.map((location) => <option key={location}>{location}</option>)}</Form.Select></Form.Group>
          {form.type === 'Internal' && <Form.Group className="mb-3"><Form.Label>To location</Form.Label><Form.Select value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>{warehouseList.map((location) => <option key={location}>{location}</option>)}</Form.Select></Form.Group>}
          {(form.type === 'Receipt' || form.type === 'Delivery') && <Form.Group className="mb-1"><Form.Label>{form.type === 'Receipt' ? 'Supplier' : 'Customer / order reference'}</Form.Label><Form.Control value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })} placeholder={form.type === 'Receipt' ? 'e.g. Apex Metals Co.' : 'e.g. SO-1056'} /></Form.Group>}
          <div className="text-muted mt-3" style={{ fontSize: 11 }}>Validating this operation updates inventory immediately and records the movement in your ledger.</div>
        </Modal.Body><Modal.Footer><Button variant="light" onClick={() => setModal('')}>Cancel</Button><Button variant="success" type="submit">Validate operation</Button></Modal.Footer></Form>
      </Modal>
      <Modal show={modal === 'product'} onHide={() => setModal('')} centered><Form onSubmit={createProduct}><Modal.Header closeButton><Modal.Title style={{ font: '700 17px Manrope' }}>Add a product</Modal.Title></Modal.Header><Modal.Body><Row className="g-3"><Col xs={12}><Form.Label>Product name</Form.Label><Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Stainless Steel Bolts" /></Col><Col sm={6}><Form.Label>SKU / code</Form.Label><Form.Control required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. STL-2041" /></Col><Col sm={6}><Form.Label>Category</Form.Label><Form.Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{['Raw Materials', 'Furniture', 'Safety', 'Packaging', 'Electrical', 'Finished Goods', 'Other'].map((category) => <option key={category}>{category}</option>)}</Form.Select></Col><Col sm={6}><Form.Label>Unit of measure</Form.Label><Form.Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{['units', 'kg', 'sheets', 'pairs', 'rolls', 'liters', 'boxes'].map((unit) => <option key={unit}>{unit}</option>)}</Form.Select></Col><Col sm={6}><Form.Label>Reorder point</Form.Label><Form.Control type="number" min="0" value={form.reorder} onChange={(e) => setForm({ ...form, reorder: e.target.value })} /></Col><Col xs={12}><Form.Label>Initial stock ({warehouseList[0]})</Form.Label><Form.Control type="number" min="0" value={form.initial} onChange={(e) => setForm({ ...form, initial: e.target.value })} /></Col></Row></Modal.Body><Modal.Footer><Button variant="light" onClick={() => setModal('')}>Cancel</Button><Button variant="success" type="submit">Add product</Button></Modal.Footer></Form></Modal>
      <Modal show={modal === 'warehouse'} onHide={() => setModal('')} centered><Form onSubmit={createWarehouse}><Modal.Header closeButton><Modal.Title style={{ font: '700 17px Manrope' }}>Add a location</Modal.Title></Modal.Header><Modal.Body><Form.Group><Form.Label>Warehouse or location name</Form.Label><Form.Control required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. East Coast Distribution" /><Form.Text className="text-muted">New products and stock movements can use this location.</Form.Text></Form.Group></Modal.Body><Modal.Footer><Button variant="light" onClick={() => setModal('')}>Cancel</Button><Button variant="success" type="submit">Add location</Button></Modal.Footer></Form></Modal>
      {toast && <div className="toast-message">✓ &nbsp;{toast}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const className = status === 'Done' ? 'status-done' : status === 'Waiting' ? 'status-waiting' : status === 'Ready' ? 'status-ready' : status === 'Scheduled' ? 'status-scheduled' : status === 'Canceled' ? 'status-canceled' : 'status-draft';
  return <Badge className={`badge-soft ${className}`}>{status}</Badge>;
}

function OperationsTable({ docs, search, setSearch, typeFilter, setTypeFilter, statusFilter, setStatusFilter, locationFilter, setLocationFilter, warehouseList, ledger = false }) {
  return <div className="section-card"><div className="section-head" style={{ flexWrap: 'wrap' }}><div><h2 className="section-heading">{ledger ? 'Stock ledger' : 'Operation documents'} <span style={{ color: '#9aa6b5', font: '500 12px "DM Sans"' }}>({docs.length})</span></h2><div className="section-sub">{ledger ? 'Every change to stock, with a full audit trail.' : 'Review and track operation status.'}</div></div><div className="toolbar"><InputGroup className="search-box"><InputGroup.Text style={{ background: '#fff', borderColor: '#dfe5ec', color: '#93a0b0' }}>⌕</InputGroup.Text><Form.Control placeholder="Search reference or product" value={search} onChange={(e) => setSearch(e.target.value)} /></InputGroup>{ledger && <Form.Select className="filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option>All types</option>{['Receipt', 'Delivery', 'Internal', 'Adjustment'].map((type) => <option key={type}>{type}</option>)}</Form.Select>}<Form.Select className="filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All statuses</option>{['Draft', 'Waiting', 'Ready', 'Scheduled', 'Done', 'Canceled'].map((status) => <option key={status}>{status}</option>)}</Form.Select><Form.Select className="filter-select" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}><option>All locations</option>{warehouseList.map((location) => <option key={location}>{location}</option>)}</Form.Select></div></div><div className="table-responsive"><Table hover><thead><tr><th>Reference</th><th>Type</th><th>Product</th><th>Quantity</th><th>{ledger ? 'Partner / movement' : 'Source / destination'}</th><th>Status</th><th>Date</th></tr></thead><tbody>{docs.map((doc) => <tr key={doc.id}><td><strong style={{ color: '#415875' }}>{doc.id}</strong></td><td>{doc.type}</td><td><span className="product-name">{doc.product}</span></td><td><span style={{ color: doc.type === 'Receipt' ? '#16856a' : doc.type === 'Delivery' ? '#c77866' : '#53647a', fontWeight: 600 }}>{doc.type === 'Receipt' ? '+' : doc.type === 'Delivery' ? '−' : doc.type === 'Adjustment' ? '±' : ''}{number(doc.qty)}</span></td><td>{doc.partner}</td><td><StatusBadge status={doc.status} /></td><td>{doc.date}</td></tr>)}{docs.length === 0 && <tr><td colSpan="7"><div className="empty-state">No operations found. Adjust your filters or create a new operation.</div></td></tr>}</tbody></Table></div></div>;
}
