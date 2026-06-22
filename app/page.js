'use client';

import { useState, useEffect, useRef } from 'react';
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

export default function Home() {
  const [db, setDb] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('single');
  const [sizeIdx, setSizeIdx] = useState(0);

  // Single mode
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [form, setForm] = useState({ productType: '', sku: '', barcode: '', colorName: '', colorCode: '', size: '', productName: '' });
  const [qty, setQty] = useState(1);
  const searchRef = useRef(null);

  // Bulk mode
  const [bulkData, setBulkData] = useState([]);
  const [bulkSelected, setBulkSelected] = useState(new Set());

  const size = SIZES[sizeIdx];

  // Load product database on mount
  useEffect(() => {
    fetch('/products.json')
      .then(r => r.json())
      .then(data => { setDb(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function doSearch(q) {
    setSearch(q);
    if (q.length < 2) { setResults([]); setShowDropdown(false); return; }
    const ql = q.toLowerCase();
    const found = db.filter(r => {
      return (r['SKU'] || '').toLowerCase().includes(ql)
        || (r['Product Type'] || '').toLowerCase().includes(ql)
        || (r['Color Name'] || '').toLowerCase().includes(ql)
        || (r['Barcode Data'] || '').toLowerCase().includes(ql)
        || (r['Product Name'] || '').toLowerCase().includes(ql);
    }).slice(0, 25);
    setResults(found);
    setShowDropdown(true);
  }

  function selectProduct(r) {
    setForm({
      productType: r['Product Type'] || '',
      sku: r['SKU'] || '',
      barcode: r['Barcode Data'] || '',
      colorName: r['Color Name'] || '',
      colorCode: r['Color Code'] || '',
      size: r['Size'] || '',
      productName: r['Product Name'] || '',
    });
    setSearch(r['SKU'] || '');
    setShowDropdown(false);
  }

  function updateForm(k, v) { setForm({ ...form, [k]: v }); }

  function handleBulkUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => {
        setBulkData(r.data);
        setBulkSelected(new Set(r.data.map((_, i) => i)));
      }
    });
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

  return (
    <div className="container">
      <div className="header">
        <div className="logo">BD</div>
        <div>
          <h1>Birddogs Label Generator</h1>
          <p>{loading ? 'Loading products...' : `${db.length.toLocaleString()} products loaded`}</p>
        </div>
      </div>

      {/* Tabs + size selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="tabs" style={{ marginBottom: 0, flex: '0 0 auto' }}>
          {[['single', 'Single Label'], ['bulk', 'Bulk Labels']].map(([k, l]) => (
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

      {/* ===== SINGLE TAB ===== */}
      {tab === 'single' && (
        <div>
          {/* Search bar */}
          <div className="search-wrap" ref={searchRef}>
            <span className="search-icon">🔍</span>
            <input
              className="search-input"
              placeholder="Search by SKU, product name, color, or UPC..."
              value={search}
              onChange={e => doSearch(e.target.value)}
              onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            />
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
            {/* Form fields */}
            <div>
              <div className="section-label">Label fields</div>
              <div className="fields-stack">
                <div className="field">
                  <label>Product type</label>
                  <input placeholder="e.g. 3 IN 1 KHAKI SHORTS" value={form.productType} onChange={e => updateForm('productType', e.target.value)} />
                </div>
                <div className="field">
                  <label>SKU</label>
                  <input placeholder="e.g. UB-A108-S-S" value={form.sku} onChange={e => updateForm('sku', e.target.value)} />
                </div>
                <div className="field-row field-row-2-1">
                  <div className="field">
                    <label>Color name</label>
                    <input placeholder="e.g. Original Khaki" value={form.colorName} onChange={e => updateForm('colorName', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Color code</label>
                    <input placeholder="e.g. 303" value={form.colorCode} onChange={e => updateForm('colorCode', e.target.value)} />
                  </div>
                </div>
                <div className="field upc-field">
                  <label>Barcode / UPC <span style={{ color: '#e53e3e' }}>*</span></label>
                  <input placeholder="e.g. 840370500195" value={form.barcode} onChange={e => updateForm('barcode', e.target.value)} />
                </div>
                <div className="field">
                  <label>Size</label>
                  <input placeholder='e.g. Large / Long 9"' value={form.size} onChange={e => updateForm('size', e.target.value)} />
                </div>
                <div className="field">
                  <label>Product name</label>
                  <input placeholder="e.g. The Sunrise Crew" value={form.productName} onChange={e => updateForm('productName', e.target.value)} />
                </div>
                <div className="btn-row">
                  <div className="field" style={{ width: 80 }}>
                    <label>Qty</label>
                    <input type="number" min={1} max={500} value={qty} onChange={e => setQty(Math.max(1, +e.target.value || 1))} style={{ textAlign: 'center' }} />
                  </div>
                  <button className="btn" style={{ flex: 1 }} onClick={() => printLabels(Array(qty).fill(form), size)}>
                    Print {qty} label{qty > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <div className="section-label">Live preview</div>
              <div className="preview-box">
                <LabelPreview d={form} size={size} />
              </div>
              {!form.barcode && (
                <div className="info-bar warn" style={{ marginTop: 10 }}>
                  No barcode entered — label will show yellow placeholder
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== BULK TAB ===== */}
      {tab === 'bulk' && (
        <div>
          {bulkData.length === 0 ? (
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
3 IN 1 KHAKI SHORTS,UB-A108-S-S,840370500195,Original Khaki,303,Small / Short 5",The Sunrise Crew,5`}</pre>
              </div>
              <div className="upload-zone">
                <h3>Upload CSV for bulk printing</h3>
                <p>Or use the search bar in Single Label mode to find products one at a time</p>
                <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
                  Choose file
                  <input type="file" accept=".csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
                </label>
              </div>
            </div>
          ) : (
            <div>
              <div className="bulk-actions">
                <span style={{ fontSize: 13 }}><strong>{bulkSelected.size}</strong> of {bulkData.length} selected</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-outline" onClick={() => {
                    bulkSelected.size === bulkData.length
                      ? setBulkSelected(new Set())
                      : setBulkSelected(new Set(bulkData.map((_, i) => i)));
                  }}>
                    {bulkSelected.size === bulkData.length ? 'Deselect all' : 'Select all'}
                  </button>
                  <button className="btn-outline" style={{ color: '#888', borderColor: '#d1d5db' }} onClick={() => { setBulkData([]); setBulkSelected(new Set()); }}>
                    Clear
                  </button>
                  <button className="btn" onClick={() => {
                    const labels = [];
                    bulkData.forEach((r, i) => {
                      if (!bulkSelected.has(i)) return;
                      const d = mapRow(r);
                      const q = Math.max(1, parseInt(r['Quantity']) || 1);
                      for (let j = 0; j < q; j++) labels.push(d);
                    });
                    printLabels(labels, size);
                  }}>
                    Print {bulkSelected.size} labels
                  </button>
                </div>
              </div>

              <div className="table-wrap">
                <table className="bulk-table">
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>✓</th>
                      <th>SKU</th>
                      <th>Product</th>
                      <th>Color</th>
                      <th>Size</th>
                      <th>UPC</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.map((r, i) => (
                      <tr key={i} className={bulkSelected.has(i) ? 'selected' : ''}>
                        <td>
                          <input type="checkbox" checked={bulkSelected.has(i)} onChange={() => {
                            const n = new Set(bulkSelected);
                            n.has(i) ? n.delete(i) : n.add(i);
                            setBulkSelected(n);
                          }} />
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r['SKU'] || '—'}</td>
                        <td>{r['Product Type'] || '—'}</td>
                        <td>{r['Color Name'] || '—'}</td>
                        <td>{r['Size'] || '—'}</td>
                        <td style={{ fontFamily: 'monospace', color: r['Barcode Data'] ? '#111' : '#dc2626' }}>
                          {r['Barcode Data'] || 'MISSING'}
                        </td>
                        <td>{r['Quantity'] || 1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {bulkData[0] && (
                <div>
                  <div className="section-label">Preview (first item)</div>
                  <div className="preview-box">
                    <LabelPreview d={mapRow(bulkData[0])} size={size} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="print-tip">
        <strong>Printing:</strong> When the print dialog opens, select your Rollo printer, set paper size to match your labels, and set scale to 100%. Choose &quot;Save as PDF&quot; to preview first.
      </div>
    </div>
  );
}
