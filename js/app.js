/* Dry Run Studio: the app. Connect screen, composer, generation, recents and the Ask tab. */

/* ---------- connection: provider + key + model ---------- */
const CONN_KEY = 'drs.conn.v1';
let CONN = null;        // {provider, key, model, models, remember}
let draft = { provider: 'anthropic', models: null };
const store = { get(k) { try { return JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k)); } catch (e) { return null; } },
  set(k, v, keep) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); (keep ? localStorage : sessionStorage).setItem(k, JSON.stringify(v)); } catch (e) {} } };
const P = id => LLM.PROVIDERS[id];
const keyMsg = (text, kind) => { const m = $('#keyMsg'); m.hidden = !text; m.textContent = text || ''; m.className = 'msg' + (kind ? ' ' + kind : ''); };

function pickProvider(id) {
  draft = { provider: id, models: null };
  document.querySelectorAll('.prov').forEach(b => b.setAttribute('aria-checked', b.dataset.p === id));
  $('#apiKey').placeholder = P(id).hint;
  const a = $('#keyLink'); a.href = P(id).keyUrl; a.textContent = `Get a ${P(id).name} key`;
  $('#stepModel').hidden = true; keyMsg('');
}
function fillModels(list, chosen) {
  const sel = $('#modelSel'); sel.textContent = '';
  list.forEach(m => { const o = el('option', '', m.label === m.id ? m.id : `${m.label}  (${m.id})`); o.value = m.id; sel.append(o); });
  sel.value = chosen; $('#stepModel').hidden = false;
}
async function verifyKey() {
  const key = $('#apiKey').value.trim(), id = draft.provider, btn = $('#btnVerify');
  if (!key) return keyMsg('Paste your API key first.');
  btn.disabled = true; btn.innerHTML = '<span class="spin"></span>Checking with ' + P(id).by; keyMsg(''); $('#stepModel').hidden = true;
  try {
    const list = await LLM.verify(id, key);
    if (draft.provider !== id) return;
    draft.models = list; fillModels(list, LLM.pick(id, list));
    keyMsg(`Key verified. ${list.length} model${list.length > 1 ? 's' : ''} available on this key.`, 'good');
    $('#btnOpen').focus();
  } catch (e) {
    const name = P(id).by;
    keyMsg(e.code === 'bad_key' ? `${name} rejected that key. Check that you copied all of it and that it is a ${P(id).name} key.`
      : e.code === 'rate_limited' ? `${name} says this key is out of quota or rate limited. Check billing in the provider console, then try again.`
      : e.code === 'network' ? `Could not reach ${name}. Check your connection. If you opened index.html by double-clicking, run the local server instead (see README).`
      : `${name} answered with an error: ${e.message || e.code}`);
  } finally { btn.disabled = false; btn.textContent = 'Verify key'; }
}
function showConnect(note) {
  pause();
  if (CONN) { pickProvider(CONN.provider); $('#apiKey').value = CONN.key; $('#remember').checked = !!CONN.remember; draft.models = CONN.models; fillModels(CONN.models, CONN.model); }
  keyMsg(note || '', 'info');
  $('#app').hidden = true; $('#connect').hidden = false; window.scrollTo(0, 0);
}
function showApp() {
  $('#connect').hidden = true; $('#app').hidden = false; window.scrollTo(0, 0);
  const chip = $('#connChip'); chip.classList.toggle('on', !!CONN);
  $('#connText').textContent = CONN ? `${P(CONN.provider).name} · ${CONN.model}` : 'No model connected';
  chip.querySelector('u').textContent = CONN ? 'Change' : 'Connect';
  if (S.board) show(S.i);
}
document.querySelectorAll('.prov').forEach(b => b.onclick = () => { if (draft.provider !== b.dataset.p) { pickProvider(b.dataset.p); $('#apiKey').value = ''; } $('#apiKey').focus(); });
$('#apiKey').addEventListener('input', () => { draft.models = null; $('#stepModel').hidden = true; keyMsg(''); });
$('#apiKey').addEventListener('keydown', e => { if (e.key === 'Enter') verifyKey(); });
$('#btnShowKey').onclick = e => { const i = $('#apiKey'), on = i.type === 'password'; i.type = on ? 'text' : 'password'; e.target.textContent = on ? 'Hide' : 'Show'; e.target.setAttribute('aria-pressed', on); };
$('#btnVerify').onclick = verifyKey;
$('#btnOpen').onclick = () => {
  if (!draft.models) return;
  CONN = { provider: draft.provider, key: $('#apiKey').value.trim(), model: $('#modelSel').value, models: draft.models, remember: $('#remember').checked };
  store.set(CONN_KEY, CONN, CONN.remember); showApp();
};
$('#btnDemoOnly').onclick = showApp;
$('#connChip').onclick = () => showConnect();

/* ---------- the looping tree on the connect screen ---------- */
function hero() {
  const nodes = [[100, 50, 200], [50, 10, 60], [200, 150, 300], [10], [60], [150], [300, null, 500], [500]].map(([id, l, r]) => ({ id, v: id, l: l ?? null, r: r ?? null }));
  const by = Object.fromEntries(nodes.map(n => [n.id, n])), frames = [];
  for (const t of [500, 60, 150, 10]) {
    let cur = 100; const path = [];
    for (;;) {
      const hl = {}; path.forEach(x => hl[x] = 'ok');
      if (cur === t) { hl[cur] = 'ok'; frames.push({ t, hl, cap: `Found ${t}.` }, { t, hl, cap: `Found ${t}.` }); break; }
      hl[cur] = 'cur';
      frames.push({ t, hl, cap: t > cur ? `${t} is bigger than ${cur}, so go right.` : `${t} is smaller than ${cur}, so go left.` });
      path.push(cur); cur = t > cur ? by[cur].r : by[cur].l;
    }
    frames.push({ t, hl: {}, cap: 'Back to the root for the next search.' });
  }
  const p = makePanel('tree'); $('#heroStage').append(p.root);
  let i = 0;
  const tick = () => { if ($('#connect').hidden) return; const f = frames[i++ % frames.length]; R.tree(p, { nodes, root: 100, hl: f.hl }); $('#heroTag').textContent = 'search ' + f.t; $('#heroCap').textContent = f.cap; };
  tick(); setInterval(tick, 1500);
}

/* ---------- composer ---------- */
let MODE = 'link';
function setMode(m) {
  MODE = m;
  document.querySelectorAll('#modeSeg button').forEach(b => b.setAttribute('aria-selected', b.dataset.mode === m));
  document.querySelectorAll('.composer [data-for]').forEach(e => e.hidden = !e.dataset.for.split(' ').includes(m));
  $('#exOpt').textContent = m === 'code' ? 'the input your code should be dry run on' : 'optional: one is chosen for you';
  say('');
  try { localStorage.setItem('drs.mode', m); } catch (e) {}
}
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));

const COPY = {
  bad_key: 'The provider rejected your key. Press Change (top right) and enter a working key.',
  rate_limited: 'The provider says you are out of quota or sending too fast. Wait a little, or check billing in the provider console.',
  no_model: 'That model is not available on your key. Press Change (top right) and pick another model.',
  network: 'Could not reach the provider. Check your connection. If you opened index.html by double-clicking, run the local server instead (see README).',
  provider_down: 'The provider is having trouble right now. Try again in a minute.',
  invalid_json: 'The storyboard came back incomplete. Try again, pick a stronger model, or give a smaller example input.',
  empty: 'The model returned nothing. Try again, or pick another model.',
  unknown_problem: 'The model does not recognise this problem from the link alone. Paste the problem statement below and try again.',
};
function say(text, info) { const m = $('#slateMsg'); m.hidden = !text; m.textContent = text || ''; m.classList.toggle('info', !!info); }
function readTarget() {
  const raw = MODE === 'code' ? '' : $('#url').value.trim(), stmt = $('#stmt').value.trim();
  const m = raw.match(/leetcode\.(?:com|cn)\/problems\/([a-z0-9-]+)/i), bare = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw);
  return { slug: m ? m[1].toLowerCase() : bare ? raw : '', name: !m && raw && !bare ? raw.slice(0, 120) : '', stmt };
}
const readCode = () => $('#code').value.replace(/^\s*\n/, '').replace(/\s+$/, '');
let inflight = null;
function setBusy(on) {
  $('#busy').hidden = !on;
  ['#btnExplain', '#btnOptimal', '#btnTrace', '#btnDry', '#btnRerun'].forEach(id => $(id).disabled = on);
  if (on) { $('#busyBig').textContent = 'Storyboarding'; $('#busySub').textContent = `${P(CONN.provider).name} is tracing the example by hand. This usually takes 30 to 90 seconds.`; }
}
async function generate(c) {
  if (inflight) return;
  if (!CONN) return showConnect('Connect a model to create new walkthroughs. The demos work without one.');
  say(''); pause();
  const ctl = new AbortController(); inflight = ctl; setBusy(true);
  $('.board:not(.hero)').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  try {
    const res = await LLM.ask(CONN, [{ role: 'user', content: buildPrompt(c) }], { json: true, signal: ctl.signal,
      onText: text => { const n = (text.match(/"say"\s*:/g) || []).length; $('#busyBig').textContent = n ? `Drawing frame ${n}` : 'Writing the brief'; $('#busySub').textContent = 'Each frame is a full snapshot of the data structures.'; } });
    if (res.truncated) throw { code: 'invalid_json' };
    let raw; try { raw = parseJSON(res.text); } catch (e) { throw { code: 'invalid_json' }; }
    const board = normalize(raw, c);
    loadBoard(board); remember(board);
    document.querySelectorAll('#shelfDemos .chipbtn').forEach(b => b.classList.remove('on'));
    play();
  } catch (e) {
    const code = e && e.code;
    if (code === 'unknown_problem') $('#stmtBox').open = true;
    if (code !== 'cancelled') say(COPY[code] || ('The provider answered with an error: ' + ((e && e.message) || code || 'unknown')));
  } finally { inflight = null; setBusy(false); }
}
const needTarget = t => t.slug || t.name || t.stmt;
$('#btnStop').onclick = () => inflight && inflight.abort();
$('#btnExplain').onclick = () => { const t = readTarget(); if (!needTarget(t)) return say('Paste a LeetCode link first, or add the problem statement.'); generate({ mode: 'problem', ...t }); };
$('#btnOptimal').onclick = () => { const t = readTarget(); if (!needTarget(t)) return say('Paste a LeetCode link first, or add the problem statement.'); generate({ mode: 'optimal', lang: $('#lang').value, ...t }); };
$('#btnTrace').onclick = () => {
  const t = readTarget(), code = readCode();
  if (!needTarget(t)) return say('Paste the LeetCode link for this solution. No link? Use the "Solution + example" tab.');
  if (!code.trim()) return say('Paste your solution code.');
  generate({ mode: 'trace', code, custom: $('#example').value.trim(), ...t });
};
$('#btnDry').onclick = () => {
  const code = readCode(); if (!code.trim()) return say('Paste your solution code.');
  generate({ mode: 'trace', code, custom: $('#example').value.trim(), ...readTarget() });
};
$('#btnRerun').onclick = () => {
  const custom = $('#customIn').value.trim(), b = S.board; if (!b) return;
  if (!custom) return say('Type your own example input next to the button first.', true);
  const c = b.ctx || { mode: b.solution ? 'trace' : 'problem', slug: b.meta.slug, code: b.solution && b.solution.code };
  generate({ ...c, custom });
};

/* ---------- recent walkthroughs (this browser only) ---------- */
const KEY = 'drs.recent.v1';
function recents() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
function remember(board) {
  try {
    const id = (board.meta.slug || board.meta.title) + ':' + board.ctx.mode;
    localStorage.setItem(KEY, JSON.stringify([{ id, board }, ...recents().filter(r => r.id !== id)].slice(0, 8)));
  } catch (e) {}
  drawRecents();
}
function drawRecents() {
  const shelf = $('#shelfRecent'), list = recents();
  shelf.hidden = !list.length; [...shelf.querySelectorAll('.chipbtn')].forEach(x => x.remove());
  list.forEach(r => { const b = el('button', 'chipbtn', r.board.meta.title); b.append(el('small', '', r.board.ctx.mode === 'problem' ? 'problem' : 'solution'));
    b.onclick = () => { say(''); loadBoard(r.board); document.querySelectorAll('#shelfDemos .chipbtn').forEach(x => x.classList.remove('on')); }; shelf.append(b); });
}

/* ---------- ask about the step on the board ---------- */
let turns = [], askCtl = null;
const TUTOR = 'You are the tutor inside Dry Run Studio, a tool that animates a hand trace of a coding problem. Answer the learner\'s question about the step currently on screen. Be concrete and refer to the actual values shown. At most 120 words, plain text only, no markdown, no code fences unless asked for code.';
function resetChat(b) {
  turns = []; $('#chat').textContent = '';
  const sg = $('#askSugg'); sg.textContent = '';
  ['Why does this step happen?', 'What would break without this step?', 'Explain the whole idea again, more simply', b.solution ? 'Why is this the time complexity?' : 'Give me a hint for where to start'].forEach(q => { const c = el('button', 'chipbtn', q); c.type = 'button'; c.onclick = () => ask(q); sg.append(c); });
}
function frameContext() {
  const b = S.board, f = b.frames[S.i];
  let t = `Problem: ${b.meta.title}. ${b.brief.oneLiner}\nExample: ${b.example.input} gives ${b.example.output}\n`;
  if (b.solution && b.solution.code) t += 'Code:\n' + b.solution.code.split('\n').map((l, i) => (i + 1) + '| ' + l).join('\n') + '\n';
  t += `On screen: step ${S.i + 1} of ${b.frames.length}` + (f.line ? `, code line ${[].concat(f.line).join(', ')}` : '') + `.\nNarration: ${f.say}\nState: ${JSON.stringify({ vars: f.vars, s: f.s }).slice(0, 5000)}\n`;
  if (S.i) t += `Previous step narration: ${b.frames[S.i - 1].say}\n`;
  return t;
}
async function ask(q) {
  q = (q || '').trim(); if (!q || !S.board || askCtl) return;
  const chat = $('#chat'); chat.append(el('div', 'bub me', q));
  const bub = el('div', 'bub ai', CONN ? 'Thinking…' : 'Connect a model first: press Connect at the top right.'); chat.append(bub);
  $('#paneAsk').scrollTop = 1e6;
  if (!CONN) return;
  pause(); askCtl = new AbortController(); $('#askBtn').disabled = true;
  try {
    const res = await LLM.ask(CONN, [{ role: 'user', content: TUTOR }, ...turns.slice(-6), { role: 'user', content: frameContext() + '\nQuestion: ' + q }], { signal: askCtl.signal, onText: text => { bub.textContent = text; $('#paneAsk').scrollTop = 1e6; } });
    bub.textContent = res.text.trim(); turns.push({ role: 'user', content: 'Question: ' + q }, { role: 'assistant', content: res.text });
  } catch (e) { bub.textContent = COPY[e && e.code] || 'That did not go through. Try asking again.'; }
  finally { askCtl = null; $('#askBtn').disabled = false; }
}
$('#askForm').addEventListener('submit', e => { e.preventDefault(); const i = $('#askIn'); const q = i.value; i.value = ''; ask(q); });

/* ---------- boot ---------- */
{
  const shelf = $('#shelfDemos');
  DEMOS.forEach(([slug, title, tag, build], k) => {
    const make = () => { const board = build(); board.ctx = { mode: 'trace', slug, code: board.solution.code }; return board; };
    const b = el('button', 'chipbtn', title); b.append(el('small', '', tag));
    b.onclick = () => { say(''); loadBoard(make()); shelf.querySelectorAll('.chipbtn').forEach(x => x.classList.toggle('on', x === b)); play(); };
    shelf.append(b);
    if (!k) { loadBoard(make(), 3); b.classList.add('on'); }
  });
  drawRecents();
  let m = 'link'; try { m = localStorage.getItem('drs.mode') || 'link'; } catch (e) {}
  setMode(['link', 'both', 'code'].includes(m) ? m : 'link');
  pickProvider('anthropic');
  const saved = store.get(CONN_KEY);
  if (saved && saved.key && saved.model && Array.isArray(saved.models) && LLM.PROVIDERS[saved.provider]) { CONN = saved; showApp(); } else $('#connect').hidden = false;
  hero();
}
