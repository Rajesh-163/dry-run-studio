/* Dry Run Studio: playback. Shows one frame at a time, runs the timeline, quizzes, sound and voice. */
const S = { board: null, i: 0, playing: false, timer: 0, speed: 1, predict: true, sound: false, voice: false, answered: new Set(), score: [0, 0], quizOpen: false, resume: false };
const panels = new Map();
const stage = $('#stage');
function clearStage() { for (const [, p] of panels) p.root.remove(); panels.clear(); stage.textContent = ''; }

function show(i) {
  const b = S.board; if (!b) return;
  i = clamp(i, 0, b.frames.length - 1); S.i = i;
  const f = b.frames[i], ids = Object.keys(f.s);
  for (const [id, p] of panels) if (!(id in f.s)) { panels.delete(id); p.root.classList.add('gone'); setTimeout(() => p.root.remove(), 220); }
  ids.forEach((id, k) => {
    const d = f.s[id]; let p = panels.get(id);
    if (!p || p.type !== d.t) { if (p) p.root.remove(); p = makePanel(d.t); panels.set(id, p); stage.append(p.root); }
    p.root.style.order = k; p.label.textContent = d.label || id;
    try { R[d.t](p, d); } catch (e) { console.warn('render', id, e); }
  });
  // variables
  const vars = f.vars && typeof f.vars === 'object' ? Object.entries(f.vars) : [];
  syncChips($('#vars'), S.varStore || (S.varStore = new Map()), vars.map(([k, v]) => ({ key: k, k, v: fmt(v) })));
  // caption
  const say = $('#say');
  if (say.textContent !== f.say) { say.textContent = f.say; say.classList.remove('swap'); void say.offsetWidth; say.classList.add('swap'); }
  $('#phase').textContent = f.phase || '';
  // code line
  const on = new Set(Array.isArray(f.line) ? f.line : f.line ? [f.line] : []);
  let first = null;
  document.querySelectorAll('#paneCode .ln').forEach((ln, k) => { const hit = on.has(k + 1); ln.classList.toggle('on', hit); if (hit && !first) first = ln; });
  if (first) { const box = first.parentElement; const y = first.offsetTop - box.offsetTop; if (y < box.scrollTop + 20 || y > box.scrollTop + box.clientHeight - 40) box.scrollTop = Math.max(0, y - box.clientHeight / 3); }
  // timeline
  const tl = $('#timeline');
  [...tl.children].forEach((t, k) => { t.classList.toggle('past', k < i); t.classList.toggle('now', k === i); });
  tl.setAttribute('aria-valuenow', i + 1); tl.setAttribute('aria-valuetext', `Step ${i + 1} of ${b.frames.length}`);
  $('#count').textContent = `${i + 1} / ${b.frames.length}`;
}

function go(i, fwd) {
  const b = S.board; if (!b) return;
  closeQuiz();
  show(i);
  const f = b.frames[S.i];
  if (S.sound) blip(f, S.i === b.frames.length - 1);
  if (S.voice) speak(f.say);
  if (fwd && S.predict && f.quiz && !S.answered.has(S.i) && S.i < b.frames.length - 1) openQuiz(f.quiz, S.i);
}
const dur = f => clamp(1300 + (f.say || '').length * 34, 1500, 6500) / S.speed;
function schedule() {
  clearTimeout(S.timer);
  if (!S.playing || S.quizOpen) return;
  S.timer = setTimeout(() => {
    if (S.i >= S.board.frames.length - 1) return pause();
    go(S.i + 1, true); schedule();
  }, dur(S.board.frames[S.i]));
}
function setPlayIcon() { $('#playIcon').setAttribute('d', S.playing ? 'M3 2h4v12H3zM9 2h4v12H9z' : 'M4 2l10 6-10 6z'); $('#bPlay').setAttribute('aria-label', S.playing ? 'Pause' : 'Play'); }
function play() {
  if (!S.board) return; if (S.i >= S.board.frames.length - 1) go(0);
  S.playing = true; setPlayIcon();
  const f = S.board.frames[S.i];
  if (S.predict && f.quiz && !S.answered.has(S.i) && !S.quizOpen && S.i < S.board.frames.length - 1) openQuiz(f.quiz, S.i); else schedule();
}
function pause() { S.playing = false; clearTimeout(S.timer); setPlayIcon(); }

/* quiz: asked on a frame, about what the NEXT frame will do */
function openQuiz(q, at) {
  const box = $('#quiz'); S.quizOpen = true; S.resume = S.playing; clearTimeout(S.timer);
  box.textContent = ''; box.hidden = false;
  box.append(el('span', 'eyebrow', 'Predict the next step'), el('h2', '', q.q));
  const opts = el('div', 'opts'); box.append(opts);
  const why = el('p', 'why'); const cont = el('button', 'btn primary small', 'Continue'); cont.hidden = true;
  q.options.forEach((o, k) => {
    const b = el('button', 'btn opt', o); opts.append(b);
    b.onclick = () => {
      if (S.answered.has(at)) return;
      S.answered.add(at); S.score[1]++; if (k === q.answer) S.score[0]++;
      [...opts.children].forEach((x, j) => { x.disabled = true; if (j === q.answer) x.classList.add('right'); else if (j === k) x.classList.add('wrong'); });
      why.textContent = (k === q.answer ? 'Correct. ' : 'Not quite. ') + (q.why || '') + `  Score ${S.score[0]}/${S.score[1]}.`;
      cont.hidden = false; cont.focus();
      if (S.sound) tone(k === q.answer ? 660 : 180, .18, k === q.answer ? 'sine' : 'sawtooth');
    };
  });
  const skip = el('button', 'btn small', 'Skip');
  const row = el('div', 'slate-row'); row.append(cont, skip); box.append(why, row);
  const done = () => { S.answered.add(at); closeQuiz(); if (S.resume) { S.playing = true; setPlayIcon(); } go(S.i + 1, true); schedule(); };
  cont.onclick = done; skip.onclick = done;
}
function closeQuiz() { S.quizOpen = false; $('#quiz').hidden = true; }

/* sound: every step is a note, so a loop sounds like a loop */
let AC = null;
function tone(freq, len, type, when) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const t = AC.currentTime + (when || 0), o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(AC.destination); o.start(t); o.stop(t + len + 0.02);
  } catch (e) {}
}
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
function blip(f, last) {
  if (last) { [0, 4, 7, 12].forEach((s, k) => tone(330 * 2 ** (s / 12), .5, 'sine', k * .09)); return; }
  let n = S.i, roles = '';
  for (const id in f.s) { const d = f.s[id]; if (d.ptr) { const v = Object.values(d.ptr).find(x => typeof x === 'number'); if (v != null) n = v; } roles += Object.values(d.hl || {}).join(' '); }
  const base = 262 * 2 ** (SCALE[Math.abs(n) % SCALE.length] / 12);
  if (roles.includes('no')) tone(base / 2, .16, 'sawtooth'); else { tone(base, .16); if (roles.includes('ok')) tone(base * 1.5, .3, 'sine', .05); }
}
function speak(text) {
  try { if (!('speechSynthesis' in window)) return; speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = clamp(S.speed, .7, 1.6); speechSynthesis.speak(u); } catch (e) {}
}

/* ---------- loading a board into the studio ---------- */
function loadBoard(board, startAt) {
  pause(); closeQuiz(); clearStage();
  S.board = board; S.answered = new Set(); S.score = [0, 0]; S.varStore = null; $('#vars').textContent = '';
  const m = board.meta;
  $('#pTitle').textContent = (m.number ? m.number + '. ' : '') + m.title;
  const diff = $('#pDiff'); diff.textContent = m.difficulty || ''; diff.dataset.d = m.difficulty || ''; diff.hidden = !m.difficulty;
  $('#pKind').textContent = board.solution ? 'Solution trace' : 'Problem walkthrough';
  const tags = $('#pTags'); tags.textContent = ''; (m.patterns || []).slice(0, 4).forEach(t => tags.append(el('span', 'badge', t)));
  $('#exIn').textContent = board.example.input || 'n/a'; $('#exOut').textContent = board.example.output || 'n/a';
  // timeline
  const tl = $('#timeline'); tl.textContent = ''; tl.setAttribute('aria-valuemax', board.frames.length);
  board.frames.forEach((f, k) => { const t = el('i', 'tick'); if (k && f.phase !== board.frames[k - 1].phase) t.classList.add('cut'); if (f.quiz) t.classList.add('q'); tl.append(t); });
  renderBrief(board); renderCode(board); resetChat(board);
  selectTab(board.solution && board.solution.code ? 'tabCode' : 'tabBrief');
  show(startAt || 0);
}

function section(parent, title) { const s = el('div'); s.append(el('h3', '', title)); parent.append(s); return s; }
function renderBrief(b) {
  const pane = $('#paneBrief'), br = b.brief, sol = b.solution; pane.textContent = '';
  if (sol && sol.verdict) { const v = el('div', 'verdict' + (sol.verdict.ok === false ? ' bad' : ''), (sol.verdict.ok === false ? 'Bug found. ' : 'This solution is correct. ') + (sol.verdict.note || '')); pane.append(v); }
  if (br.oneLiner) { const s = section(pane, 'In plain words'); s.append(el('p', 'lead', br.oneLiner)); }
  if (br.analogy) section(pane, 'Picture it').append(el('p', '', br.analogy));
  if (br.input || br.output) { const dl = el('dl', 'io'); if (br.input) dl.append(el('dt', '', 'You get'), el('dd', '', br.input)); if (br.output) dl.append(el('dt', '', 'You return'), el('dd', '', br.output)); section(pane, 'Input and output').append(dl); }
  if (sol) {
    const s = section(pane, 'The idea');
    if (sol.approach) s.append(el('p', '', sol.approach));
    if (sol.insight) { const p = el('p', '', sol.insight); p.style.marginTop = '6px'; p.style.color = 'var(--muted)'; s.append(p); }
    const bd = el('div', 'badges'); bd.style.marginTop = '8px';
    if (sol.time) bd.append(el('span', 'badge', 'Time ' + sol.time)); if (sol.space) bd.append(el('span', 'badge', 'Space ' + sol.space)); if (sol.language) bd.append(el('span', 'badge', sol.language));
    s.append(bd);
  }
  if (br.constraints && br.constraints.length) {
    const ul = el('ul', 'rows'); br.constraints.forEach(c => { const li = el('li'); li.append(el('code', '', c.raw || ''), el('small', '', c.means || '')); ul.append(li); });
    section(pane, 'What the constraints tell you').append(ul);
  }
  if (br.traps && br.traps.length) { const ul = el('ul', 'rows'); br.traps.forEach(t => ul.append(el('li', '', t))); section(pane, 'Edge cases that bite').append(ul); }
  if (!sol && br.hints && br.hints.length) {
    const s = section(pane, 'Hints, one at a time'); s.style.display = 'flex'; s.style.flexDirection = 'column'; s.style.gap = '6px';
    br.hints.forEach((h, k) => { const btn = el('button', 'hint', `Reveal hint ${k + 1}`); btn.onclick = () => { btn.textContent = h; btn.classList.add('open'); }; s.append(btn); });
  }
  if (b.related && b.related.length) {
    const s = section(pane, 'Same pattern, next problems'), box = el('div', 'rel'); s.append(box);
    b.related.forEach(r => { const btn = el('button', 'btn small'); btn.append(document.createTextNode(r.title || r.slug)); if (r.why) btn.append(el('small', '', r.why));
      btn.onclick = () => { setMode('link'); $('#url').value = 'https://leetcode.com/problems/' + r.slug + '/'; $('#url').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); }; box.append(btn); });
  }
}
function renderCode(b) {
  const pane = $('#paneCode'); pane.textContent = '';
  const code = b.solution && b.solution.code;
  if (!code) { pane.append(el('p', 'muted', 'This is a problem walkthrough, so there is no code yet. Add your solution in the composer, or press "Show an optimal solution", and it will run here line by line.')); return; }
  const pre = el('pre', 'code'); code.split('\n').forEach(l => pre.append(el('span', 'ln', l || ' '))); pane.append(pre);
  pane.append(el('p', 'muted', 'The highlighted line is the one running in the current step.'));
}
function selectTab(id) {
  document.querySelectorAll('.tab').forEach(t => { const on = t.id === id; t.setAttribute('aria-selected', on); $('#' + t.dataset.pane).hidden = !on; });
}

/* ---------- controls ---------- */
$('#bPlay').onclick = () => S.playing ? pause() : play();
$('#bNext').onclick = () => { pause(); go(S.i + 1, true); };
$('#bPrev').onclick = () => { pause(); go(S.i - 1); };
$('#bRestart').onclick = () => { pause(); go(0); };
$('#speed').onchange = e => { S.speed = +e.target.value; schedule(); };
document.querySelectorAll('.tab').forEach(t => t.onclick = () => selectTab(t.id));
const bindTog = (id, key, onOn) => { const b = $(id); b.onclick = () => { S[key] = !S[key]; b.setAttribute('aria-pressed', S[key]); if (S[key] && onOn) onOn(); if (key === 'voice' && !S.voice) try { speechSynthesis.cancel(); } catch (e) {} }; };
bindTog('#togPredict', 'predict'); bindTog('#togSound', 'sound', () => tone(523, .15)); bindTog('#togVoice', 'voice', () => S.board && speak(S.board.frames[S.i].say));
if (!('speechSynthesis' in window)) $('#togVoice').hidden = true;
{
  const tl = $('#timeline'); let drag = false;
  const at = e => { const r = tl.getBoundingClientRect(); return Math.floor(clamp((e.clientX - r.left) / r.width, 0, .9999) * S.board.frames.length); };
  tl.addEventListener('pointerdown', e => { if (!S.board) return; drag = true; try { tl.setPointerCapture(e.pointerId); } catch (x) {} pause(); go(at(e)); });
  tl.addEventListener('pointermove', e => { if (drag) { const k = at(e); if (k !== S.i) go(k); } });
  const end = () => drag = false; tl.addEventListener('pointerup', end); tl.addEventListener('pointercancel', end);
}
document.addEventListener('keydown', e => {
  if ($('#app').hidden) return;
  if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName) && !(e.target.id === 'timeline')) { if (e.target.tagName !== 'BUTTON' || e.key === ' ') return; }
  if (e.key === ' ') { e.preventDefault(); S.playing ? pause() : play(); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); pause(); go(S.i + 1, true); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); pause(); go(S.i - 1); }
});
