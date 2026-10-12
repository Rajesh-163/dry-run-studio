/* Dry Run Studio: the storyboard contract.
   SPEC is the prompt that tells the model what JSON to write. normalize() checks what
   comes back, so a sloppy reply degrades instead of breaking the board. */
const SPEC = `You are the storyboard writer for "Dry Run Studio", a tool that teaches data structures and algorithms by animating a hand trace (a "dry run") on one small example.
Reply with ONE JSON object and nothing else: no markdown fence, no commentary.

SHAPE
{
 "meta": {"title": str, "number": int or null, "difficulty": "Easy"|"Medium"|"Hard", "slug": str, "patterns": [1 to 3 short pattern names]},
 "brief": {
   "oneLiner": the task restated in one plain sentence a beginner understands,
   "analogy": one or two sentences giving a real-world picture of the task,
   "input": str, "output": str,
   "constraints": [{"raw": "1 <= n <= 10^5", "means": what this implies for the approach or the time complexity}],   (max 3)
   "traps": [edge cases that commonly break solutions],   (max 3)
   "hints": [3 hints, from a gentle nudge to nearly the idea]   (problem mode only, otherwise [])
 },
 "solution": null or {"language": str, "code": str, "approach": 1 or 2 sentences, "insight": the one key idea, "time": "O(..)", "space": "O(..)", "verdict": {"ok": bool, "note": str}},
 "example": {"input": str, "output": str},
 "related": [{"title": str, "slug": the leetcode url slug, "why": short reason}],   (2 items)
 "frames": [FRAME, ...]
}
FRAME = {"phase": short label for this stage of the run, "line": int or [ints] (1-based code lines executing now; solution traces only), "say": narration, "vars": {name: value} for scalar variables worth watching, "s": {id: STRUCTURE, ...}, "quiz": optional QUIZ}
QUIZ = {"q": a question asking the learner to predict what the NEXT frame will do, "options": [3 strings], "answer": index of the correct option, "why": one sentence}

STRUCTURES (the "t" field picks the drawing)
{"t":"array","label":str,"v":[values],"hl":{"index":ROLE},"ptr":{"name":index},"win":[lo,hi]}   strings are arrays of characters; "win" draws a sliding-window bracket over lo..hi inclusive
{"t":"grid","label":str,"v":[[row],[row]],"hl":{"r,c":ROLE},"ptr":{"name":[r,c]},"rows":[row headers],"cols":[column headers]}   matrices and DP tables
{"t":"map","label":str,"v":[[key,value],...],"hl":{"key":ROLE}}
{"t":"set","label":str,"v":[items],"hl":{"item":ROLE}}
{"t":"stack","label":str,"v":[bottom,...,top],"hl":{"index":ROLE}}
{"t":"queue","label":str,"v":[front,...,back],"hl":{"index":ROLE}}
{"t":"list","label":str,"nodes":[{"id":str,"v":value,"next":id or null}],"ptr":{"name":id or null},"hl":{"id":ROLE}}   linked list; nodes are drawn in array order, so keep that order fixed in every frame and only change "next"
{"t":"tree","label":str,"nodes":[{"id":str,"v":value,"l":id or null,"r":id or null}],"root":id,"ptr":{"name":id},"hl":{"id":ROLE}}   binary trees and heaps
{"t":"graph","label":str,"directed":bool,"nodes":[{"id":str,"v":label,"sub":small note such as a distance}],"edges":[[from,to,weight?]],"hl":{"id":ROLE},"ehl":{"from-to":ROLE},"ptr":{"name":id}}
ROLE is one of "cur" (being looked at now), "cmp" (being compared, a candidate, or waiting), "ok" (match, chosen, part of the answer), "no" (rejected or mismatch), "done" (finished or visited), "win" (inside the current range).

RULES
1. Pick ONE small example that shows the interesting behaviour: arrays up to 8 items, grids up to 5x6, trees up to 9 nodes, graphs up to 7 nodes. Aim for 12 to 26 frames. If a loop is long, show the first iterations in full and summarise the repetitive middle in one frame.
2. Every frame is a full snapshot: "s" must contain every structure that should be on screen, with all its current values. Keep the same ids in the same order in every frame. Use 1 to 4 structures.
3. The trace must be exactly right. Execute step by step and double-check every value, index and pointer before writing it. Never show a state the code could not produce.
4. "say" is 1 or 2 short sentences in plain English for a learner. Say WHY the step happens, not only what happens. No markdown.
5. Use highlights and pointers in every frame so the eye knows where to look. The last frame shows the final answer with "ok" highlights.
6. Include 2 or 3 quizzes at moments where the next step is a real decision. Never put one on the last frame.
7. Values inside structures are short: numbers, single characters, or strings under 10 characters.
8. If you do not recognise the problem and no statement is given, reply exactly {"error":"unknown_problem"}.`;

const MODES = {
  problem: () => `MODE: problem walkthrough. The learner has NOT solved this yet. Set "solution" to null and leave out "line". The frames explain WHAT is being asked by working through the example the way a person would by hand: which candidates count, which do not, and why the expected output is what it is. Do not reveal the optimal algorithm or its key trick; a naive by-definition check is fine. Fill "hints".`,
  trace: c => `MODE: trace the learner's own solution. Their code is below with line numbers, and "line" must use those numbers. Do NOT fix or rewrite the code. In "solution" set "code" to "" (the page already has it) and fill language, approach, insight, time and space. If the code is correct, set verdict.ok to true and say in verdict.note whether it is also optimal. If it has a bug, choose an example that exposes it, trace faithfully up to the point where it goes wrong, show the wrong result with "no" highlights, and explain the bug and the fix in verdict.note and in the last frame.\n\nLEARNER'S CODE\n${c.code.split('\n').map((l, i) => (i + 1) + '| ' + l).join('\n')}`,
  optimal: c => `MODE: optimal solution. Write a clean, idiomatic, interview-quality optimal solution in ${c.lang}, with no comments and under 40 lines, return it in solution.code, and trace it. "line" numbers refer to lines of solution.code, where the first line is 1. Set verdict to {"ok": true, "note": ""}.`,
};
function buildPrompt(c) {
  let p = SPEC + '\n\n' + MODES[c.mode](c) + '\n\n';
  if (c.stmt) p += 'PROBLEM STATEMENT (pasted by the learner)\n' + c.stmt.slice(0, 6000) + '\n';
  else if (c.slug) p += `PROBLEM: the LeetCode problem whose URL slug is "${c.slug}" (https://leetcode.com/problems/${c.slug}/).\n`;
  else if (c.name) p += `PROBLEM: the well-known coding problem called "${c.name}".\n`;
  else p += 'PROBLEM: not given. Work out which problem the code solves from the code itself.\n';
  if (c.custom) p += `\nEXAMPLE: use this input instead of choosing your own. If it is too large to draw, shrink it and say so in the first frame: ${c.custom.slice(0, 400)}\n`;
  return p;
}
function parseJSON(text) {
  let t = text.trim();
  try { return JSON.parse(t); } catch (e) {}
  const f = t.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/); if (f) { t = f[1].trim(); try { return JSON.parse(t); } catch (e) {} }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error('no json');
}
const TYPES = { array: 1, string: 1, grid: 1, matrix: 1, map: 1, hashmap: 1, set: 1, stack: 1, queue: 1, list: 1, linkedlist: 1, tree: 1, heap: 1, graph: 1 };
const str = (x, d = '') => typeof x === 'string' ? x : x == null ? d : String(x);
function normalize(raw, c) {
  if (!raw || typeof raw !== 'object') throw { code: 'invalid_json' };
  if (raw.error) throw { code: 'unknown_problem' };
  const frames = (Array.isArray(raw.frames) ? raw.frames : []).map(f => {
    if (!f || typeof f !== 'object') return null;
    const s = {};
    for (const id of Object.keys(f.s && typeof f.s === 'object' ? f.s : {})) { const d = f.s[id]; if (d && typeof d === 'object' && TYPES[d.t]) s[id] = d; }
    let quiz;
    const q = f.quiz;
    if (q && Array.isArray(q.options) && q.options.length >= 2 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length) quiz = { q: str(q.q), options: q.options.map(o => str(o)), answer: q.answer, why: str(q.why) };
    return { phase: str(f.phase), line: f.line, say: str(f.say), vars: f.vars && typeof f.vars === 'object' && !Array.isArray(f.vars) ? f.vars : undefined, s, quiz };
  }).filter(f => f && (f.say || Object.keys(f.s).length));
  if (!frames.length) throw { code: 'invalid_json' };
  const m = raw.meta || {}, br = raw.brief || {}, ex = raw.example || {};
  const arr = x => Array.isArray(x) ? x : [];
  let solution = null;
  if (c.mode !== 'problem') {
    const so = raw.solution || {};
    solution = { language: str(so.language, c.lang || ''), code: c.mode === 'trace' ? c.code : str(so.code).replace(/^\n+|\s+$/g, ''), approach: str(so.approach), insight: str(so.insight), time: str(so.time), space: str(so.space),
      verdict: so.verdict && typeof so.verdict === 'object' ? { ok: so.verdict.ok !== false, note: str(so.verdict.note) } : null };
    if (c.mode === 'optimal') solution.verdict = null;
  }
  return {
    meta: { title: str(m.title, c.slug || c.name || 'Untitled problem'), number: Number.isInteger(m.number) ? m.number : null, difficulty: ['Easy', 'Medium', 'Hard'].includes(m.difficulty) ? m.difficulty : '', slug: str(m.slug, c.slug || ''), patterns: arr(m.patterns).map(x => str(x)) },
    brief: { oneLiner: str(br.oneLiner), analogy: str(br.analogy), input: str(br.input), output: str(br.output),
      constraints: arr(br.constraints).map(x => ({ raw: str(x && x.raw), means: str(x && x.means) })), traps: arr(br.traps).map(x => str(x)), hints: arr(br.hints).map(x => str(x)) },
    solution, example: { input: str(ex.input), output: str(ex.output) },
    related: arr(raw.related).filter(r => r && r.slug).map(r => ({ title: str(r.title), slug: str(r.slug).replace(/[^a-z0-9-]/gi, ''), why: str(r.why) })),
    frames, ctx: { mode: c.mode, slug: c.slug, name: c.name, stmt: c.stmt, code: c.code, lang: c.lang },
  };
}

