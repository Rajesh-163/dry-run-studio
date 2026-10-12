/* Dry Run Studio: drawing engine.
   Every structure type has one function R[type](panel, data) that syncs the DOM to a
   snapshot. Elements are keyed, so values slide, pop in and fade out between frames. */
const $ = s => document.querySelector(s);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const SVGNS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const fmt = v => v === null || v === undefined ? '∅' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
const ROLES = ['cur', 'cmp', 'ok', 'no', 'done', 'win'];
const role = r => ROLES.includes(r) ? r : '';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ALIAS = { string: 'array', matrix: 'grid', linkedlist: 'list', hashmap: 'map', heap: 'tree' };
const canon = t => ALIAS[t] || t;
let KID = 0, PUID = 0;
const setRole = (e, r) => { r = role(r); if (r) e.dataset.role = r; else delete e.dataset.role; };
const pulse = e => { e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse'); };

function makePanel(type) {
  const root = el('section', 'panel'), label = el('div', 'plabel'), scroll = el('div', 'pscroll'), body = el('div', 'pbody');
  root.dataset.t = canon(type); scroll.append(body); root.append(label, scroll);
  return { type, root, label, body, uid: ++PUID };
}

/* Give each value in a sequence a stable identity so swaps slide and pushes pop in. */
function rekey(pv, pk, nv) {
  const nk = new Array(nv.length).fill(null), used = new Set();
  const eq = (a, b) => fmt(a) === fmt(b);
  if (pv.length === nv.length) {
    nv.forEach((x, i) => { if (eq(x, pv[i])) { nk[i] = pk[i]; used.add(i); } });
    const perm = pv.map(fmt).sort().join('\u0001') === nv.map(fmt).sort().join('\u0001');
    if (perm) nv.forEach((x, i) => {
      if (nk[i] != null) return;
      let best = -1;
      pv.forEach((y, j) => { if (!used.has(j) && eq(x, y) && (best < 0 || Math.abs(j - i) < Math.abs(best - i))) best = j; });
      if (best >= 0) { nk[i] = pk[best]; used.add(best); }
    });
    nv.forEach((x, i) => { if (nk[i] == null) { if (!used.has(i) && pk[i] != null) { nk[i] = pk[i]; used.add(i); } else nk[i] = 'k' + (++KID); } });
  } else {
    let a = 0; while (a < pv.length && a < nv.length && eq(pv[a], nv[a])) { nk[a] = pk[a]; a++; }
    let b = 0; while (b < pv.length - a && b < nv.length - a && eq(pv[pv.length - 1 - b], nv[nv.length - 1 - b])) { nk[nv.length - 1 - b] = pk[pv.length - 1 - b]; b++; }
    for (let i = 0; i < nv.length; i++) if (nk[i] == null) nk[i] = 'k' + (++KID);
  }
  return nk;
}

/* Keyed sync of absolutely positioned shapes. items: [{key,x,y,w?,text,role,nil?,extra?}] */
function syncAbs(p, cls, items) {
  const map = p.cells || (p.cells = new Map()), seen = new Set();
  for (const it of items) {
    seen.add(it.key);
    let e = map.get(it.key), fresh = false;
    if (!e) {
      e = el('div', cls + ' enter'); e.append(el('span', 'val'));
      map.set(it.key, e); p.body.append(e); fresh = true;
      requestAnimationFrame(() => requestAnimationFrame(() => e.classList.remove('enter')));
    }
    const val = e.firstChild;
    if (val.textContent !== it.text) { val.textContent = it.text; if (!fresh) pulse(e); }
    const moved = !fresh && (e.style.getPropertyValue('--x') !== it.x + 'px' || e.style.getPropertyValue('--y') !== it.y + 'px');
    e.style.setProperty('--x', it.x + 'px'); e.style.setProperty('--y', it.y + 'px');
    if (it.w) e.style.width = it.w + 'px';
    if (moved) { e.classList.add('lift'); setTimeout(() => e.classList.remove('lift'), 500); }
    setRole(e, it.role);
    e.classList.toggle('nil', !!it.nil);
    if (it.extra) it.extra(e);
  }
  for (const [k, e] of map) if (!seen.has(k)) { map.delete(k); e.classList.add('exit'); setTimeout(() => e.remove(), 300); }
}

/* Named pointers that slide under slots. ptrs: {name: slot}; xOf(slot) gives the centre x. */
function syncPtrs(p, ptrs, xOf, baseY) {
  const map = p.ptrs || (p.ptrs = new Map()), rows = {}, seen = new Set();
  let maxRow = 0;
  for (const name of Object.keys(ptrs || {})) {
    const slot = ptrs[name]; if (slot == null || Number.isNaN(slot)) continue;
    seen.add(name);
    const row = rows[slot] = (rows[slot] || 0) + 1; maxRow = Math.max(maxRow, row);
    let e = map.get(name);
    if (!e) { e = el('div', 'ptr enter'); e.append(el('b', '', name)); map.set(name, e); p.body.append(e); requestAnimationFrame(() => e.classList.remove('enter')); }
    e.style.setProperty('--x', xOf(slot) + 'px'); e.style.setProperty('--y', (baseY + (row - 1) * 27) + 'px');
  }
  for (const [k, e] of map) if (!seen.has(k)) { map.delete(k); e.remove(); }
  return maxRow;
}

/* Keyed sync of flex chips. items: [{key,k?,v,role}] */
function syncChips(box, store, items) {
  const seen = new Set();
  let prev = null;
  for (const it of items) {
    seen.add(it.key);
    let e = store.get(it.key), fresh = false;
    if (!e) {
      e = el('div', 'chip enter');
      if (it.k !== undefined) e.append(el('span', 'k'));
      if (it.v !== undefined) e.append(el('span', 'v'));
      store.set(it.key, e); fresh = true;
      requestAnimationFrame(() => requestAnimationFrame(() => e.classList.remove('enter')));
    }
    const ks = e.querySelector('.k'), vs = e.querySelector('.v');
    if (ks && ks.textContent !== it.k) ks.textContent = it.k;
    if (vs && vs.textContent !== it.v) { vs.textContent = it.v; if (!fresh) pulse(e); }
    setRole(e, it.role);
    const want = prev ? prev.nextSibling : box.firstChild;
    if (want !== e) box.insertBefore(e, want);
    prev = e;
  }
  for (const [k, e] of store) if (!seen.has(k)) { store.delete(k); e.classList.add('exit'); setTimeout(() => e.remove(), 320); }
}

/* Arrows. Each wire is a <g> holding a line and a hand-built arrowhead, so colour and
   animation work the same in every browser. A wire whose path changes is redrawn. */
function syncWires(p, w, h, items) {
  if (!p.svg) { p.svg = svgEl('svg', { class: 'wires' }); p.wg = svgEl('g', {}); p.tg = svgEl('g', {}); p.svg.append(p.wg, p.tg); p.body.prepend(p.svg); p.wires = new Map(); }
  p.svg.setAttribute('width', w); p.svg.setAttribute('height', h);
  const seen = new Set(); p.tg.textContent = '';
  for (const it of items) {
    const sx = it.cx != null ? it.cx : it.x1, sy = it.cy != null ? it.cy : it.y1;
    const len = Math.hypot(it.x2 - sx, it.y2 - sy) || 1, ux = (it.x2 - sx) / len, uy = (it.y2 - sy) / len;
    const ex = it.arrow ? it.x2 - ux * 8 : it.x2, ey = it.arrow ? it.y2 - uy * 8 : it.y2;
    const d = it.cx != null ? `M${it.x1} ${it.y1}Q${it.cx} ${it.cy} ${ex} ${ey}` : `M${it.x1} ${it.y1}L${ex} ${ey}`;
    seen.add(it.key);
    let g = p.wires.get(it.key);
    if (g && g.dataset.d !== d) { g.remove(); g = null; }
    if (!g) {
      g = svgEl('g', { class: 'wire' }); g.dataset.d = d;
      g.append(svgEl('path', { d, pathLength: 1 }));
      if (it.arrow) { const s = 11, bx = it.x2 - ux * s, by = it.y2 - uy * s, px = -uy * s * 0.52, py = ux * s * 0.52;
        g.append(svgEl('polygon', { points: `${it.x2},${it.y2} ${bx + px},${by + py} ${bx - px},${by - py}` })); }
      p.wires.set(it.key, g); p.wg.append(g);
    }
    const r = role(it.role); if (r) g.dataset.e = r; else delete g.dataset.e;
    g.classList.toggle('rev', !!it.rev);
    if (it.label != null) { const t = svgEl('text', { x: (it.x1 + it.x2) / 2, y: (it.y1 + it.y2) / 2 + 4, 'text-anchor': 'middle' }); t.textContent = fmt(it.label); p.tg.append(t); }
  }
  for (const [k, g] of p.wires) if (!seen.has(k)) { p.wires.delete(k); g.remove(); }
}

/* ---------- structure renderers ---------- */
const R = {};

R.array = (p, d) => {
  const v = Array.isArray(d.v) ? d.v : typeof d.v === 'string' ? [...d.v] : [];
  const n = v.length, w = clamp(Math.max(0, ...v.map(x => fmt(x).length)) * 10 + 22, 52, 124), step = w + 8;
  p.keys = rekey(p.vals || [], p.keys || [], v); p.vals = v.slice();
  const hl = d.hl || {};
  syncAbs(p, 'cell', v.map((x, i) => ({ key: p.keys[i], x: i * step, y: 0, w, text: fmt(x), role: hl[i],
    extra: e => { let s = e.querySelector('.idx'); if (!s) { s = el('i', 'idx'); e.append(s); } s.textContent = i; } })));
  const rows = syncPtrs(p, d.ptr, s => clamp(s, -0.65, n - 0.35) * step + w / 2, 78);
  let band = p.band;
  const win = Array.isArray(d.win) && d.win.length === 2 && d.win[0] <= d.win[1] ? d.win : null;
  if (win) {
    if (!band) { band = p.band = el('div', 'band'); p.body.prepend(band); }
    const a = clamp(win[0], 0, n - 1), b = clamp(win[1], 0, n - 1);
    band.style.transform = `translateX(${a * step - 7}px)`; band.style.width = ((b - a) * step + w + 14) + 'px'; band.style.opacity = 1;
  } else if (band) band.style.opacity = 0;
  p.body.style.width = Math.max(n * step - 8, 60) + 'px';
  p.body.style.height = (76 + rows * 27) + 'px';
  p.body.style.margin = '8px 38px 0';
};

R.grid = (p, d) => {
  const v = Array.isArray(d.v) ? d.v.map(r => Array.isArray(r) ? r : typeof r === 'string' ? [...r] : [r]) : [];
  const rows = v.length, cols = Math.max(0, ...v.map(r => r.length)), heads = Array.isArray(d.cols), sides = Array.isArray(d.rows);
  const sig = [rows, cols, heads, sides].join();
  if (p.sig !== sig) {
    p.sig = sig; p.body.textContent = ''; p.g = new Map();
    const g = el('div', 'gridb'); g.style.gridTemplateColumns = `${sides ? 'auto ' : ''}repeat(${cols}, auto)`; p.body.append(g);
    p.heads = [];
    if (heads) { if (sides) g.append(el('div', 'ghead')); for (let c = 0; c < cols; c++) { const h = el('div', 'ghead'); p.heads.push(h); g.append(h); } }
    p.sides = [];
    for (let r = 0; r < rows; r++) {
      if (sides) { const h = el('div', 'ghead'); p.sides.push(h); g.append(h); }
      for (let c = 0; c < cols; c++) { const e = el('div', 'gcell'); e.append(el('span', 'val')); p.g.set(r + ',' + c, e); g.append(e); }
    }
    p.fresh = true;
  }
  p.heads.forEach((h, c) => h.textContent = fmt(d.cols[c] ?? ''));
  p.sides.forEach((h, r) => h.textContent = fmt(d.rows[r] ?? ''));
  const hl = d.hl || {}, tags = {};
  for (const name of Object.keys(d.ptr || {})) { const at = d.ptr[name]; if (Array.isArray(at)) (tags[at[0] + ',' + at[1]] ||= []).push(name); }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const key = r + ',' + c, e = p.g.get(key), t = c < v[r].length ? fmt(v[r][c]) : '';
    if (e.firstChild.textContent !== t) { e.firstChild.textContent = t; if (!p.fresh) pulse(e); }
    setRole(e, hl[key]);
    let tag = e.querySelector('em');
    if (tags[key]) { if (!tag) { tag = el('em'); e.append(tag); } tag.textContent = tags[key].join(','); } else if (tag) tag.remove();
  }
  p.fresh = false;
};

const chipPanel = kind => (p, d) => {
  if (!p.box) {
    p.box = el('div', 'chips' + (kind === 'stack' ? ' col' : kind === 'queue' ? ' row' : '')); p.store = new Map(); p.body.append(p.box);
    if (kind === 'queue') { const n = el('div', 'tagnote'); n.append(el('span', '', '← front'), el('span', '', 'back')); p.body.append(n); }
    if (kind === 'stack') p.body.append(el('div', 'tagnote', 'top is up'));
  }
  const hl = d.hl || {};
  let items;
  if (kind === 'map') {
    const ent = Array.isArray(d.v) ? d.v.map(e => Array.isArray(e) ? e : [e, '']) : d.v && typeof d.v === 'object' ? Object.entries(d.v) : [];
    items = ent.map(([k, val]) => ({ key: fmt(k), k: fmt(k), v: fmt(val), role: hl[fmt(k)] ?? hl[k] }));
  } else if (kind === 'set') {
    items = (Array.isArray(d.v) ? d.v : []).map(k => ({ key: fmt(k), v: fmt(k), role: hl[fmt(k)] ?? hl[k] }));
  } else {
    const arr = Array.isArray(d.v) ? d.v : [];
    if (kind === 'stack') items = arr.map((x, i) => ({ key: 's' + i, v: fmt(x), role: hl[i] }));
    else { p.keys = rekey(p.vals || [], p.keys || [], arr); p.vals = arr.slice(); items = arr.map((x, i) => ({ key: p.keys[i], v: fmt(x), role: hl[i] })); }
  }
  const dup = new Set(); items = items.filter(it => !dup.has(it.key) && dup.add(it.key));
  syncChips(p.box, p.store, items);
};
R.map = chipPanel('map'); R.set = chipPanel('set'); R.stack = chipPanel('stack'); R.queue = chipPanel('queue');

R.list = (p, d) => {
  const nodes = (Array.isArray(d.nodes) ? d.nodes : []).filter(n => n && n.id != null), n = nodes.length;
  const W = 56, H = 52, step = 106, top = 34, at = {};
  nodes.forEach((nd, i) => at[nd.id] = i);
  const hl = d.hl || {};
  const items = nodes.map((nd, i) => ({ key: 'n' + nd.id, x: i * step, y: top, w: W, text: fmt(nd.v ?? nd.val), role: hl[nd.id],
    extra: e => { const far = nd.next == null && i !== n - 1; let s = e.querySelector('.nx'); if (far) { if (!s) { s = el('i', 'nx', '→ ∅'); e.append(s); } } else if (s) s.remove(); } }));
  items.push({ key: 'nil', x: n * step, y: top, w: W, text: 'null', nil: true });
  syncAbs(p, 'cell', items);
  const cy = top + H / 2, wires = [];
  nodes.forEach((nd, i) => {
    const j = nd.next == null ? (i === n - 1 ? n : -1) : at[nd.next];
    if (j == null || j < 0 || j === i) return;
    if (j === i + 1) wires.push({ key: 'n' + nd.id, x1: i * step + W + 5, y1: cy, x2: j * step - 5, y2: cy, arrow: true });
    else if (j === i - 1) wires.push({ key: 'n' + nd.id, x1: i * step - 5, y1: cy, x2: j * step + W + 5, y2: cy, arrow: true, rev: true });
    else { const x1 = i * step + W / 2, x2 = j * step + W / 2 + (j < i ? 10 : -10); wires.push({ key: 'n' + nd.id, x1, y1: top - 4, x2, y2: top - 5, cx: (x1 + x2) / 2, cy: top - 44 - Math.min(26, Math.abs(j - i) * 5), arrow: true, rev: j < i }); }
  });
  syncWires(p, (n + 1) * step, 130, wires);
  const ptr = {}; for (const k of Object.keys(d.ptr || {})) { const id = d.ptr[k]; ptr[k] = id == null ? n : at[id]; }
  const rows = syncPtrs(p, ptr, s => s * step + W / 2, top + H + 10);
  p.body.style.width = ((n + 1) * step - 50) + 'px'; p.body.style.height = (top + H + 10 + Math.max(rows, 1) * 27) + 'px';
};

function treeNodes(d) {
  if (Array.isArray(d.nodes)) return { nodes: d.nodes.filter(n => n && n.id != null), root: d.root ?? (d.nodes[0] && d.nodes[0].id) };
  const a = Array.isArray(d.v) ? d.v : [], nodes = [];
  if (!a.length || a[0] == null) return { nodes, root: null };
  const mk = i => { const nd = { id: i, v: a[i], l: null, r: null }; nodes.push(nd); return nd; };
  const q = [mk(0)]; let i = 1;
  while (q.length && i < a.length) {
    const cur = q.shift();
    if (i < a.length) { if (a[i] != null) { cur.l = i; q.push(mk(i)); } i++; }
    if (i < a.length) { if (a[i] != null) { cur.r = i; q.push(mk(i)); } i++; }
  }
  return { nodes, root: 0 };
}
const nodeExtra = (tags, sub) => e => {
  let t = e.querySelector('.tags');
  if (tags && tags.length) { if (!t) { t = el('span', 'tags'); e.append(t); } t.textContent = ''; tags.forEach(x => t.append(el('em', '', x))); } else if (t) t.remove();
  let s = e.querySelector('.sub');
  if (sub != null && sub !== '') { if (!s) { s = el('span', 'sub'); e.append(s); } s.textContent = fmt(sub); } else if (s) s.remove();
};
const tagsBy = ptr => { const t = {}; for (const k of Object.keys(ptr || {})) if (ptr[k] != null) (t[ptr[k]] ||= []).push(k); return t; };
const NODE = 48, NR = NODE / 2;
const between = (a, b, pad) => { const x1 = a.x + NR, y1 = a.y + NR, x2 = b.x + NR, y2 = b.y + NR, len = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  return { x1: x1 + ux * (NR + 3), y1: y1 + uy * (NR + 3), x2: x2 - ux * (NR + pad), y2: y2 - uy * (NR + pad) }; };

R.tree = (p, d) => {
  const { nodes, root } = treeNodes(d), by = {}; nodes.forEach(n => by[n.id] = n);
  const XS = 56, YS = 82, pos = {}, seen = new Set(); let col = 0, maxD = 0;
  (function walk(id, depth) {
    if (id == null || !by[id] || seen.has(id)) return; seen.add(id);
    const n = by[id]; walk(n.l ?? n.left, depth + 1); pos[id] = { x: col++ * XS, y: depth * YS }; maxD = Math.max(maxD, depth); walk(n.r ?? n.right, depth + 1);
  })(root, 0);
  const hl = d.hl || {}, tags = tagsBy(d.ptr), ehl = d.ehl || {}, wires = [];
  for (const id of seen) for (const c of [by[id].l ?? by[id].left, by[id].r ?? by[id].right]) if (c != null && pos[c])
    wires.push({ key: id + '>' + c, ...between(pos[id], pos[c], 4), arrow: true, role: ehl[id + '-' + c] ?? (role(hl[id]) && hl[id] !== 'cmp' && role(hl[c]) && hl[c] !== 'cmp' ? (hl[c] === 'cur' ? 'ok' : hl[c]) : undefined) });
  const W = Math.max(col * XS, 60), H = (maxD + 1) * YS;
  syncWires(p, W, H, wires);
  syncAbs(p, 'node', [...seen].map(id => ({ key: 't' + id, x: pos[id].x, y: pos[id].y, text: fmt(by[id].v ?? by[id].val), role: hl[id], extra: nodeExtra(tags[id], by[id].sub) })));
  p.body.style.width = W + 'px'; p.body.style.height = (H - 10) + 'px'; p.body.style.marginTop = '6px';
  if (!seen.size) { if (!p.empty) { p.empty = el('span', 'emptynote', 'empty tree'); p.body.append(p.empty); } } else if (p.empty) { p.empty.remove(); p.empty = null; }
};

R.graph = (p, d) => {
  const nodes = (Array.isArray(d.nodes) ? d.nodes : []).map(n => n !== null && typeof n === 'object' ? n : { id: n }).filter(n => n.id != null);
  const n = nodes.length, rad = clamp(n * 19, 70, 170), cx = rad + 34, cy = rad + 34, pos = {};
  nodes.forEach((nd, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / Math.max(n, 1); pos[nd.id] = { x: cx + rad * Math.cos(a) - NR, y: cy + rad * Math.sin(a) - NR }; });
  const hl = d.hl || {}, ehl = d.ehl || {}, tags = tagsBy(d.ptr), wires = [];
  for (const ed of Array.isArray(d.edges) ? d.edges : []) {
    const [a, b, wt] = Array.isArray(ed) ? ed : [ed.from, ed.to, ed.w ?? ed.weight];
    if (!pos[a] || !pos[b]) continue;
    wires.push({ key: a + '>' + b, ...between(pos[a], pos[b], d.directed ? 4 : 3), arrow: !!d.directed, role: ehl[a + '-' + b] ?? (d.directed ? undefined : ehl[b + '-' + a]), label: wt });
  }
  syncWires(p, cx * 2, cy * 2, wires);
  syncAbs(p, 'node', nodes.map(nd => ({ key: 'g' + nd.id, x: pos[nd.id].x, y: pos[nd.id].y, text: fmt(nd.v ?? nd.label ?? nd.id), role: hl[nd.id], extra: nodeExtra(tags[nd.id], nd.sub) })));
  p.body.style.width = (cx * 2) + 'px'; p.body.style.height = (cy * 2 + 10) + 'px';
};
for (const a in ALIAS) R[a] = R[ALIAS[a]];
