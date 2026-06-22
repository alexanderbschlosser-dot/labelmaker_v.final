'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Papa from 'papaparse';

const SIZES = [
  { id: '76x38', name: '76mm × 38mm (Rollo)', w: '76mm', h: '38mm' },
  { id: '3x2', name: '3" × 2"', w: '3in', h: '2in' },
  { id: '4x2', name: '4" × 2"', w: '4in', h: '2in' },
];

function LabelPreview({ d, size }) {
  const colorDisp = [d.colorName, d.colorCode ? `(#${d.colorCode})` : ''].filter(Boolean).join(' ');
  return (
    <div style={{
      width: size.w, height: size.h, border: '1.5px solid #222', borderRadius: 3,
      padding: '2.5mm 3mm', boxSizing: 'border-box', fontFamily: 'Arial,Helvetica,sans-serif',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      overflow: 'hidden', background: '#fff',
    }}>
      <div style={{ fontSize: '8pt', fontWeight: 900, textAlign: 'center', textTransform: 'uppercase', letterSpacing: .5, lineHeight: 1.1 }}>
        {d.productType || 'PRODUCT'}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '5pt', lineHeight: 1.2, marginTop: '.5mm' }}>
        <div><span style={{ fontWeight: 700 }}>STYLE:</span><br /><span style={{ fontSize: '5.5pt' }}>SKU: {d.sku || '—'}</span></div>
        <div style={{ textAlign: 'right', maxWidth: '50%' }}><span style={{ fontWeight: 700 }}>COLOR:</span><br /><span style={{ fontSize: '5.5pt' }}>{colorDisp.toUpperCase() || '—'}</span></div>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1mm 2mm', minHeight: '10mm', background: d.barcode ? '#fff' : '#FFE500' }}>
        {d.barcode ? (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontFamily: "'Libre Barcode 128', monospace", fontSize: '22pt', lineHeight: 1, letterSpacing: 1 }}>{d.barcode}</div>
            <div style={{ fontSize: '5pt', marginTop: '.5mm' }}>{d.barcode}</div>
          </div>
        ) : (
          <div style={{ fontWeight: 900, fontSize: '9pt' }}>TBD BARCODE</div>
        )}
      </div>
      <div style={{ fontSize: '7pt', fontWeight: 900, textAlign: 'center', lineHeight: 1.1 }}>{d.size || '—'}</div>
      <div style={{ fontSize: '6.5pt', textAlign: 'center', lineHeight: 1.1, marginTop: '.3mm' }}>{d.productName || ''}</div>
    </div>
  );
}

function printLabels(labels, size) {
  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked — please allow pop-ups and try again.'); return; }
  const html = labels.map(d => {
    const cd = [d.colorName, d.colorCode ? `(#${d.colorCode})` : ''].filter(Boolean).join(' ');
    return `<div class="l">
      <div class="t">${(d.productType || 'PRODUCT').toUpperCase()}</div>
      <div class="m"><div><b>STYLE:</b><br>SKU: ${d.sku || ''}</div><div style="text-align:right"><b>COLOR:</b><br>${cd.toUpperCase() || '—'}</div></div>
      <div class="b">${d.barcode
        ? `<div style="font-family:'Libre Barcode 128',monospace;font-size:22pt;line-height:1">${d.barcode}</div><div style="font-size:5pt;margin-top:.5mm">${d.barcode}</div>`
        : `<div style="font-weight:900;font-size:9pt;background:#FFE500;padding:1mm 4mm">TBD BARCODE</div>`}</div>
      <div class="s">${d.size || '—'}</div>
      <div class="n">${d.productName || ''}</div>
    </div>`;
  }).join('');
  w.document.write(`<!DOCTYPE html><html><head><title>Labels</title>
<link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
<style>@page{size:${size.w} ${size.h};margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif}
.l{width:${size.w};height:${size.h};padding:2.5mm 3mm;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;page-break-after:always}
.t{font-size:8pt;font-weight:900;text-align:center;text-transform:uppercase;letter-spacing:.5px;line-height:1.1}
.m{display:flex;justify-content:space-between;font-size:5pt;line-height:1.2;margin-top:.5mm}.m b{font-size:5pt}
.b{flex:1;display:flex;align-items:center;justify-content:center;margin:1mm 2mm;text-align:center;min-height:10mm}
.s{font-size:7pt;font-weight:900;text-align:center;line-height:1.1}.n{font-size:6.5pt;text-align:center;line-height:1.1;margin-top:.3mm}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 800);
}

function mapRow(r) {
  return {
    productType: r['Product Type'] || '',
    sku: r['SKU'] || '',
    barcode: r['Barcode Data'] || '',
    colorName: r['Color Name'] || '',
    colorCode: r['Color Code'] || '',
    size: r['Size'] || '',
    productName: r['Product Name'] || '',
  };
}

// ==================== SCAN MODE ====================
function ScanMode({ db, size }) {
  const [scanInput, setScanInput] = useState('');
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [lastPrinted, setLastPrinted] = useState(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  // Keep input focused
  useEffect(() => {
    const interval = setInterval(() => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.focus();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  function handleScan(e) {
    if (e.key === 'Enter' && scanInput.trim()) {
      const code = scanInput.trim();
      const match = db.find(r => (r['Barcode Data'] || '') === code || (r['SKU'] || '') === code);
      if (match) {
        const d = mapRow(match);
        setFound(d);
        setNotFound(false);
        setHistory(prev => [{ ...d, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 49)]);
        if (autoPrint) {
          printLabels([d], size);
          setLastPrinted(d.sku);
          setTimeout(() => setLastPrinted(null), 3000);
        }
      } else {
        setFound(null);
        setNotFound(true);
      }
      setScanInput('');
    }
  }

  return (
    <div>
      {/* Scan input */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Scan a barcode or type a UPC / SKU and press Enter</div>
        <input
          ref={inputRef}
          className="search-input"
          style={{ maxWidth: 400, margin: '0 auto', textAlign: 'center', fontSize: 20, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2, paddingLeft: 16 }}
          placeholder="Waiting for scan..."
          value={scanInput}
          onChange={e => setScanInput(e.target.value)}
          onKeyDown={handleScan}
          autoFocus
        />
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={autoPrint} onChange={e => setAutoPrint(e.target.checked)} style={{ width: 16, height: 16 }} />
            <span>Auto-print on scan <span style={{ color: '#888' }}>(sends to printer immediately)</span></span>
          </label>
        </div>
      </div>

      {/* Not found */}
      {notFound && (
        <div className="info-bar warn" style={{ textAlign: 'center', fontSize: 15 }}>
          Product not found — check the barcode and try again
        </div>
      )}

      {/* Last printed confirmation */}
      {lastPrinted && (
        <div className="info-bar success" style={{ textAlign: 'center' }}>
          ✅ Printed label for {lastPrinted}
        </div>
      )}

      {/* Found product */}
      {found && (
        <div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'start', flexWrap: 'wrap' }}>
          <div className="preview-box">
            <LabelPreview d={found} size={size} />
          </div>
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Product found:</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{found.productType}</div>
            <div style={{ fontSize: 13, marginBottom: 2 }}><span style={{ color: '#888' }}>SKU:</span> <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{found.sku}</span></div>
            <div style={{ fontSize: 13, marginBottom: 2 }}><span style={{ color: '#888' }}>UPC:</span> <span style={{ fontFamily: 'monospace' }}>{found.barcode}</span></div>
            <div style={{ fontSize: 13, marginBottom: 2 }}><span style={{ color: '#888' }}>Color:</span> {found.colorName} {found.colorCode && `(#${found.colorCode})`}</div>
            <div style={{ fontSize: 13, marginBottom: 2 }}><span style={{ color: '#888' }}>Size:</span> {found.size}</div>
            <div style={{ fontSize: 13, marginBottom: 12 }}><span style={{ color: '#888' }}>Name:</span> {found.productName}</div>
            {!autoPrint && (
              <button className="btn" onClick={() => printLabels([found], size)}>Print label</button>
            )}
          </div>
        </div>
      )}

      {/* Scan history */}
      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Scan history</div>
            <button onClick={() => setHistory([])} style={{ fontSize: 11, color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
          </div>
          <div className="table-wrap" style={{ maxHeight: 200 }}>
            <table className="bulk-table">
              <thead><tr><th>Time</th><th>SKU</th><th>Product</th><th>Color</th><th>Size</th><th>UPC</th></tr></thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td style={{ color: '#888' }}>{h.time}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{h.sku}</td>
                    <td>{h.productType}</td>
                    <td>{h.colorName}</td>
                    <td>{h.size}</td>
                    <td style={{ fontFamily: 'monospace' }}>{h.barcode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== BROWSE MODE ====================
function BrowseMode({ db, size }) {
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [upcFilter, setUpcFilter] = useState('all');
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const types = [...new Set(db.map(r => r['Product Type'] || ''))].filter(Boolean).sort();

  const filtered = db.filter(r => {
    if (typeFilter && (r['Product Type'] || '') !== typeFilter) return false;
    if (upcFilter === 'has' && !(r['Barcode Data'] || '')) return false;
    if (upcFilter === 'missing' && (r['Barcode Data'] || '')) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return (r['SKU'] || '').toLowerCase().includes(q)
        || (r['Product Type'] || '').toLowerCase().includes(q)
        || (r['Color Name'] || '').toLowerCase().includes(q)
        || (r['Barcode Data'] || '').toLowerCase().includes(q)
        || (r['Product Name'] || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const pageData = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const hasUpc = db.filter(r => r['Barcode Data']).length;
  const noUpc = db.length - hasUpc;

  return (
    <div>
      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, padding: '10px 14px', background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{db.length.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#888' }}>Total products</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#059669' }}>{hasUpc.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#059669' }}>Have UPC</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#dc2626' }}>{noUpc.toLocaleString()}</div>
          <div style={{ fontSize: 11, color: '#dc2626' }}>Missing UPC</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          className="search-input"
          style={{ flex: 1, minWidth: 200, padding: '8px 12px 8px 36px', fontSize: 13 }}
          placeholder="Filter by SKU, name, color, UPC..."
          value={filter}
          onChange={e => { setFilter(e.target.value); setPage(0); }}
        />
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}
        >
          <option value="">All product types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={upcFilter}
          onChange={e => { setUpcFilter(e.target.value); setPage(0); }}
          style={{ padding: '8px 10px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 12, background: '#fff' }}
        >
          <option value="all">All UPC status</option>
          <option value="has">Has UPC</option>
          <option value="missing">Missing UPC</option>
        </select>
      </div>

      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
        Showing {filtered.length.toLocaleString()} products {filter || typeFilter || upcFilter !== 'all' ? '(filtered)' : ''}
      </div>

      {/* Table */}
      <div className="table-wrap" style={{ maxHeight: 450 }}>
        <table className="bulk-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Type</th>
              <th>Color</th>
              <th>Code</th>
              <th>Size</th>
              <th>UPC</th>
              <th>Name</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, i) => (
              <tr key={i}>
                <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11 }}>{r['SKU']}</td>
                <td style={{ fontSize: 11 }}>{r['Product Type']}</td>
                <td style={{ fontSize: 11 }}>{r['Color Name']}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{r['Color Code']}</td>
                <td style={{ fontSize: 11 }}>{r['Size']}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: r['Barcode Data'] ? '#111' : '#dc2626' }}>
                  {r['Barcode Data'] || 'MISSING'}
                </td>
                <td style={{ fontSize: 11 }}>{r['Product Name']}</td>
                <td>
                  {r['Barcode Data'] && (
                    <button
                      onClick={() => printLabels([mapRow(r)], size)}
                      style={{ fontSize: 10, padding: '3px 8px', background: '#1B3A5C', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >Print</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: page > 0 ? 'pointer' : 'not-allowed', opacity: page > 0 ? 1 : .4 }}>
            ← Prev
          </button>
          <span style={{ padding: '5px 10px', fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: page < totalPages - 1 ? 'pointer' : 'not-allowed', opacity: page < totalPages - 1 ? 1 : .4 }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== SINGLE MODE ====================
function SingleMode({ db, size }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [form, setForm] = useState({ productType: '', sku: '', barcode: '', colorName: '', colorCode: '', size: '', productName: '' });
  const [qty, setQty] = useState(1);
  const searchRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function doSearch(q) {
    setSearch(q);
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }
    const ql = q.toLowerCase();
    const found = db.filter(r =>
      (r['SKU'] || '').toLowerCase().includes(ql)
      || (r['Product Type'] || '').toLowerCase().includes(ql)
      || (r['Color Name'] || '').toLowerCase().includes(ql)
      || (r['Barcode Data'] || '').toLowerCase().includes(ql)
      || (r['Product Name'] || '').toLowerCase().includes(ql)
    ).slice(0, 25);
    setResults(found);
    setShowDropdown(true);
  }

  function selectProduct(r) {
    setForm(mapRow(r));
    setSearch(r['SKU'] || '');
    setShowDropdown(false);
  }

  function updateForm(k, v) { setForm({ ...form, [k]: v }); }

  return (
    <div>
      <div className="search-wrap" ref={searchRef}>
        <span className="search-icon">🔍</span>
        <input className="search-input" placeholder="Search by SKU, product name, color, or UPC..." value={search}
          onChange={e => doSearch(e.target.value)} onFocus={() => { if (results.length > 0) setShowDropdown(true); }} />
        {showDropdown && results.length > 0 && (
          <div className="dropdown">
            {results.map((r, i) => (
              <div key={i} className="dropdown-item" onClick={() => selectProduct(r)}>
                <div>
                  <span className="sku-text">{r['SKU']}</span>
                  <span className="product-text">{r['Product Type']} — {r['Color Name']}</span>
                  {r['Product Name'] && <span className="product-text" style={{ fontStyle: 'italic' }}> ({r['Product Name']})</span>}
                </div>
                <span className={`upc-badge ${r['Barcode Data'] ? 'has' : 'missing'}`}>
                  {r['Barcode Data'] ? r['Barcode Data'] : 'No UPC'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid">
        <div>
          <div className="section-label">Label fields</div>
          <div className="fields-stack">
            <div className="field"><label>Product type</label><input placeholder="e.g. 3 IN 1 KHAKI SHORTS" value={form.productType} onChange={e => updateForm('productType', e.target.value)} /></div>
            <div className="field"><label>SKU</label><input placeholder="e.g. UB-A108-S-S" value={form.sku} onChange={e => updateForm('sku', e.target.value)} /></div>
            <div className="field-row field-row-2-1">
              <div className="field"><label>Color name</label><input placeholder="e.g. Original Khaki" value={form.colorName} onChange={e => updateForm('colorName', e.target.value)} /></div>
              <div className="field"><label>Color code</label><input placeholder="e.g. 303" value={form.colorCode} onChange={e => updateForm('colorCode', e.target.value)} /></div>
            </div>
            <div className="field upc-field"><label>Barcode / UPC <span style={{ color: '#e53e3e' }}>*</span></label><input placeholder="e.g. 840370500195" value={form.barcode} onChange={e => updateForm('barcode', e.target.value)} /></div>
            <div className="field"><label>Size</label><input placeholder='e.g. Large / Long 9"' value={form.size} onChange={e => updateForm('size', e.target.value)} /></div>
            <div className="field"><label>Product name</label><input placeholder="e.g. The Sunrise Crew" value={form.productName} onChange={e => updateForm('productName', e.target.value)} /></div>
            <div className="btn-row">
              <div className="field" style={{ width: 80 }}><label>Qty</label><input type="number" min={1} max={500} value={qty} onChange={e => setQty(Math.max(1, +e.target.value || 1))} style={{ textAlign: 'center' }} /></div>
              <button className="btn" style={{ flex: 1 }} onClick={() => printLabels(Array(qty).fill(form), size)}>Print {qty} label{qty > 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
        <div>
          <div className="section-label">Live preview</div>
          <div className="preview-box"><LabelPreview d={form} size={size} /></div>
          {!form.barcode && <div className="info-bar warn" style={{ marginTop: 10 }}>No barcode entered — label will show yellow placeholder</div>}
        </div>
      </div>
    </div>
  );
}

// ==================== BULK MODE ====================
function BulkMode({ db, size }) {
  const [bulkData, setBulkData] = useState([]);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  function handleBulkUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => { setBulkData(r.data); setBulkSelected(new Set(r.data.map((_, i) => i))); }
    });
  }

  if (bulkData.length === 0) {
    return (
      <div>
        <div className="csv-reqs">
          <h3>CSV file requirements</h3>
          <p style={{ fontSize: 13, marginBottom: 10 }}>Your CSV should have these columns:</p>
          <div style={{ fontSize: 13, marginBottom: 14 }}>
            {['Product Type', 'SKU *', 'Barcode Data *', 'Color Name', 'Color Code', 'Size', 'Product Name', 'Quantity'].map((c, i) => (
              <div key={i} style={{ padding: '2px 0 2px 8px' }}>
                <span style={{ color: '#888', width: 20, display: 'inline-block' }}>{i + 1}.</span>
                <strong>{c.replace(' *', '')}</strong>{c.includes('*') && <span style={{ color: '#e53e3e' }}> *</span>}
              </div>
            ))}
          </div>
          <pre>{`Product Type,SKU,Barcode Data,Color Name,Color Code,Size,Product Name,Quantity
The 3 in 1 Khaki Shorts,UB-A108-S-S,840370500195,Original Khaki,303,Small / Short 5",The Sunrise Crew,5`}</pre>
        </div>
        <div className="upload-zone">
          <h3>Upload CSV for bulk printing</h3>
          <p>Use the CSV template format above</p>
          <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
            Choose file<input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="bulk-actions">
        <span style={{ fontSize: 13 }}><strong>{bulkSelected.size}</strong> of {bulkData.length} selected</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-outline" onClick={() => {
            bulkSelected.size === bulkData.length ? setBulkSelected(new Set()) : setBulkSelected(new Set(bulkData.map((_, i) => i)));
          }}>{bulkSelected.size === bulkData.length ? 'Deselect all' : 'Select all'}</button>
          <button className="btn-outline" style={{ color: '#888', borderColor: '#d1d5db' }} onClick={() => { setBulkData([]); setBulkSelected(new Set()); }}>Clear</button>
          <button className="btn" onClick={() => {
            const labels = [];
            bulkData.forEach((r, i) => {
              if (!bulkSelected.has(i)) return;
              const d = mapRow(r);
              const q = Math.max(1, parseInt(r['Quantity']) || 1);
              for (let j = 0; j < q; j++) labels.push(d);
            });
            printLabels(labels, size);
          }}>Print {bulkSelected.size} labels</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="bulk-table">
          <thead><tr><th style={{ width: 30 }}>✓</th><th>SKU</th><th>Product</th><th>Color</th><th>Size</th><th>UPC</th><th>Qty</th></tr></thead>
          <tbody>
            {bulkData.map((r, i) => (
              <tr key={i} className={bulkSelected.has(i) ? 'selected' : ''}>
                <td><input type="checkbox" checked={bulkSelected.has(i)} onChange={() => { const n = new Set(bulkSelected); n.has(i) ? n.delete(i) : n.add(i); setBulkSelected(n); }} /></td>
                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r['SKU'] || '—'}</td>
                <td>{r['Product Type'] || '—'}</td>
                <td>{r['Color Name'] || '—'}</td>
                <td>{r['Size'] || '—'}</td>
                <td style={{ fontFamily: 'monospace', color: r['Barcode Data'] ? '#111' : '#dc2626' }}>{r['Barcode Data'] || 'MISSING'}</td>
                <td>{r['Quantity'] || 1}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {bulkData[0] && (
        <div style={{ marginTop: 14 }}>
          <div className="section-label">Preview (first item)</div>
          <div className="preview-box"><LabelPreview d={mapRow(bulkData[0])} size={size} /></div>
        </div>
      )}
    </div>
  );
}

// ==================== MAIN APP ====================
export default function Home() {
  const [db, setDb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('scan');
  const [sizeIdx, setSizeIdx] = useState(0);
  const size = SIZES[sizeIdx];

  useEffect(() => {
    fetch('/products.json')
      .then(r => r.json())
      .then(data => { setDb(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tabs = [
    ['scan', 'Scan & Print'],
    ['single', 'Search'],
    ['bulk', 'Bulk CSV'],
    ['browse', 'Browse All'],
  ];

  return (
    <div className="container">
      <div className="header">
        <div className="logo">BD</div>
        <div>
          <h1>Birddogs Label Generator</h1>
          <p>{loading ? 'Loading products...' : `${db.length.toLocaleString()} products loaded`}</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="tabs" style={{ marginBottom: 0, flex: '0 0 auto' }}>
          {tabs.map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="size-select" style={{ marginBottom: 0 }}>
          <label>Label size:</label>
          <select value={sizeIdx} onChange={e => setSizeIdx(+e.target.value)}>
            {SIZES.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {!loading && tab === 'scan' && <ScanMode db={db} size={size} />}
      {!loading && tab === 'single' && <SingleMode db={db} size={size} />}
      {!loading && tab === 'bulk' && <BulkMode db={db} size={size} />}
      {!loading && tab === 'browse' && <BrowseMode db={db} size={size} />}

      <div className="print-tip">
        <strong>Printing:</strong> Select your Rollo printer, set paper size to match your labels, scale 100%. Choose &quot;Save as PDF&quot; to preview first.
      </div>
    </div>
  );
}
