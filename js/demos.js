/* ---------- built-in demos: each one runs the real algorithm and records the frames ---------- */
function mk(meta, brief, solution, example, related, run) {
  const frames = [];
  run((phase, line, say, s, vars, quiz) => frames.push({ phase, line, say, s, vars, quiz }));
  return { meta, brief, solution, example, related, frames, demo: true };
}
const DEMOS = [
  ['two-sum', 'Two Sum', 'hash map', () => mk(
    { title: 'Two Sum', number: 1, difficulty: 'Easy', slug: 'two-sum', patterns: ['Hash map', 'One pass'] },
    { oneLiner: 'Find the two numbers in the list that add up to the target, and say where they sit.',
      analogy: 'You are at a party looking for the one person whose age plus yours equals 15. Instead of asking everyone again and again, you keep a guest list of ages you have already met.',
      input: 'A list of integers and a target sum.', output: 'The two positions (indices) whose values add up to the target.',
      constraints: [{ raw: '2 ≤ nums.length ≤ 10⁴', means: 'Checking every pair is 50 million steps at worst. It passes, but the interviewer wants one pass.' }, { raw: 'Exactly one answer exists', means: 'No need to handle "not found" or pick between several pairs.' }],
      traps: ['You may not use the same element twice: [3, 3] with target 6 needs both threes.', 'Return positions, not the values.'], hints: [] },
    { language: 'Python', time: 'O(n)', space: 'O(n)', approach: 'Walk the list once. For each number, work out the partner it needs, and look that partner up in a map of numbers already seen.',
      insight: 'A lookup in a hash map costs one step, so the inner loop of the brute force disappears.', verdict: { ok: true, note: '' },
      code: 'def twoSum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        need = target - x\n        if need in seen:\n            return [seen[need], i]\n        seen[x] = i' },
    { input: 'nums = [3, 8, 11, 4, 7], target = 15', output: '[2, 3]' },
    [{ title: '3Sum', slug: '3sum', why: 'Fix one number, then it is Two Sum again.' }, { title: 'Subarray Sum Equals K', slug: 'subarray-sum-equals-k', why: 'Same "have I seen the partner?" lookup, on prefix sums.' }],
    F => {
      const nums = [3, 8, 11, 4, 7], target = 15, seen = new Map();
      const snap = (hl, ptr, mhl) => ({ nums: { t: 'array', label: 'nums', v: nums.slice(), hl, ptr }, seen: { t: 'map', label: 'seen: value → index', v: [...seen], hl: mhl } });
      F('Setup', 2, 'Start with an empty map. It will remember every number we pass and where we saw it.', snap({}, {}), { target });
      for (let i = 0; i < nums.length; i++) {
        const x = nums[i], need = target - x, done = {}; for (let k = 0; k < i; k++) done[k] = 'done';
        F('Scan', [3, 4], `Look at ${x}. To reach ${target} it needs a partner worth ${need}.`, snap({ ...done, [i]: 'cur' }, { i }), { target, x, need },
          i === 3 ? { q: `x is 4 and it needs 11. What does the code do next?`, options: ['11 is not in the map, so it stores 4 and moves on', '11 is in the map at index 2, so it returns [2, 3]', 'It starts a second loop to search the list for 11'], answer: 1, why: '11 was stored when we passed index 2, so the lookup hits immediately.' } : undefined);
        if (seen.has(need)) {
          const j = seen.get(need);
          F('Found', [5, 6], `${need} is already in the map, seen at index ${j}. ${need} + ${x} = ${target}, so return [${j}, ${i}].`, snap({ ...done, [j]: 'ok', [i]: 'ok' }, { i }, { [need]: 'ok' }), { target, x, need, answer: `[${j}, ${i}]` });
          return;
        }
        seen.set(x, i);
        F('Scan', [5, 7], `${need} is not in the map yet, so ${x} cannot be finished now. Remember ${x} at index ${i} for later.`, snap({ ...done, [i]: 'no' }, { i }, { [x]: 'cur' }), { target, x, need });
      }
    })],

  ['longest-substring-without-repeating-characters', 'Longest Substring', 'sliding window', () => mk(
    { title: 'Longest Substring Without Repeating Characters', number: 3, difficulty: 'Medium', slug: 'longest-substring-without-repeating-characters', patterns: ['Sliding window', 'Set'] },
    { oneLiner: 'Find the longest stretch of the string in which no letter appears twice.',
      analogy: 'Stretch a rubber band over the letters. Pull the right end forward one letter at a time. Whenever a duplicate gets inside, release the left end until the duplicate falls out.',
      input: 'A string s.', output: 'The length of the longest run of consecutive characters with no repeats.',
      constraints: [{ raw: '0 ≤ s.length ≤ 5·10⁴', means: 'Trying every substring is far too slow. Each character should be touched a constant number of times.' }],
      traps: ['Substring means consecutive characters. "pwke" is not a substring of "pwwkew".', 'The empty string has answer 0.'], hints: [] },
    { language: 'Python', time: 'O(n)', space: 'O(k)', approach: 'Keep a window [left, right] that never holds a duplicate. Grow it on the right. When the new letter is already inside, shrink from the left until it is not.',
      insight: 'left only ever moves forward, so both ends cross the string at most once.', verdict: { ok: true, note: '' },
      code: 'def lengthOfLongestSubstring(s):\n    seen = set()\n    left = best = 0\n    for right, ch in enumerate(s):\n        while ch in seen:\n            seen.remove(s[left])\n            left += 1\n        seen.add(ch)\n        best = max(best, right - left + 1)\n    return best' },
    { input: 's = "pwwkew"', output: '3' },
    [{ title: 'Minimum Window Substring', slug: 'minimum-window-substring', why: 'The same grow and shrink window, with counts.' }, { title: 'Longest Repeating Character Replacement', slug: 'longest-repeating-character-replacement', why: 'Window validity depends on a count instead of a set.' }],
    F => {
      const s = 'pwwkew', seen = new Set(); let left = 0, best = 0;
      const snap = (hl, right, win) => ({ s: { t: 'array', label: 's', v: [...s], hl, ptr: { left, right }, win }, seen: { t: 'set', label: 'seen: letters inside the window', v: [...seen] } });
      F('Setup', [2, 3], 'The window is empty. left marks where it starts, and the set holds the letters inside it.', { s: { t: 'array', label: 's', v: [...s], ptr: { left: 0 } }, seen: { t: 'set', label: 'seen: letters inside the window', v: [] } }, { left, best });
      for (let right = 0; right < s.length; right++) {
        const ch = s[right];
        const dup = seen.has(ch);
        F('Grow', [4, 5], dup ? `Next letter is "${ch}", but "${ch}" is already inside the window. The window must shrink first.` : `Next letter is "${ch}". It is not in the window, so it can join.`,
          snap({ [right]: dup ? 'no' : 'cur' }, right, right > left ? [left, right - 1] : null), { left, right, best },
          right === 2 ? { q: 'The window holds "pw" and the next letter is another "w". What happens?', options: ['The window resets to empty', 'left moves forward until the old "w" has left the window', 'The new "w" is skipped and right moves on'], answer: 1, why: 'Shrinking from the left removes "p", then the old "w". Only then can the new "w" join.' } : undefined);
        while (seen.has(ch)) {
          const out = s[left]; seen.delete(out); left++;
          F('Shrink', [6, 7], `Drop "${out}" from the left edge. left moves to ${left}.`, snap({ [left - 1]: 'done', [right]: seen.has(ch) ? 'no' : 'cur' }, right, right > left ? [left, right - 1] : null), { left, right, best });
        }
        seen.add(ch); const len = right - left + 1, was = best; best = Math.max(best, len);
        F('Grow', [8, 9], `"${ch}" joins. The window is ${len} long` + (best > was ? `, a new best.` : `, and the best stays ${best}.`), snap({ [right]: best > was ? 'ok' : 'cur' }, right, [left, right]), { left, right, best });
      }
      const hl = {}; [2, 3, 4].forEach(k => hl[k] = 'ok');
      F('Answer', 10, 'The string is finished. The longest window without a repeat was "wke", so the answer is 3.', { s: { t: 'array', label: 's', v: [...s], hl, win: [2, 4] }, seen: { t: 'set', label: 'seen: letters inside the window', v: [...seen] } }, { best });
    })],

  ['valid-parentheses', 'Valid Parentheses', 'stack', () => mk(
    { title: 'Valid Parentheses', number: 20, difficulty: 'Easy', slug: 'valid-parentheses', patterns: ['Stack'] },
    { oneLiner: 'Check that every bracket is closed by the right kind of bracket, in the right order.',
      analogy: 'Stacking plates: the last bracket you opened is the first one you must close.',
      input: 'A string made only of ( ) [ ] { }.', output: 'true if the brackets are balanced, otherwise false.',
      constraints: [{ raw: '1 ≤ s.length ≤ 10⁴', means: 'One pass is plenty. The interesting part is correctness.' }],
      traps: ['"([)]" has matching counts but the wrong order.', 'A closer with nothing open, like ")", must fail without crashing on an empty stack.', 'Left-over openers, like "((", must fail at the end.'], hints: [] },
    { language: 'Python', time: 'O(n)', space: 'O(n)', approach: 'Push every opener. On a closer, pop the most recent opener and check that it is the matching kind.',
      insight: 'The most recent unclosed opener is always the one that has to close next. A stack gives you exactly that.', verdict: { ok: true, note: '' },
      code: "def isValid(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    stack = []\n    for ch in s:\n        if ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n        else:\n            stack.append(ch)\n    return not stack" },
    { input: 's = "([]{})"', output: 'true' },
    [{ title: 'Min Stack', slug: 'min-stack', why: 'Stack practice with a twist.' }, { title: 'Daily Temperatures', slug: 'daily-temperatures', why: 'The stack holds things still waiting for their match.' }],
    F => {
      const s = '([]{})', pairs = { ')': '(', ']': '[', '}': '{' }, stack = [], done = {};
      const snap = (i, r, top) => ({ s: { t: 'array', label: 's', v: [...s], hl: { ...done, ...(i != null ? { [i]: r } : {}) }, ptr: i != null ? { ch: i } : {} }, stack: { t: 'stack', label: 'stack of open brackets', v: stack.slice(), hl: top ? { [stack.length - 1]: top } : {} } });
      F('Setup', 3, 'The stack starts empty. It will hold brackets that are open and still waiting to be closed.', snap());
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (pairs[ch]) {
          F('Close', [4, 5, 6], `"${ch}" is a closer. It must match the bracket on top of the stack, which is "${stack[stack.length - 1]}".`, snap(i, 'cmp', 'cmp'), { ch, needs: pairs[ch] },
            i === 2 ? { q: 'A "]" arrives and the top of the stack is "[". What happens next?', options: ['"[" is popped: the pair is complete', '"]" is pushed on top', 'The function returns false'], answer: 0, why: 'The top opener is the matching kind, so it is popped and the scan continues.' } : undefined);
          stack.pop(); done[i] = 'done';
          F('Close', 6, `They match, so the opener is popped. The pair is complete.`, snap(i, 'ok'), { ch });
        } else {
          stack.push(ch); done[i] = 'done';
          F('Open', [4, 8, 9], `"${ch}" is an opener. Push it and wait for its partner.`, snap(i, 'cur', 'cur'), { ch });
        }
      }
      F('Answer', 10, 'The string is finished and the stack is empty: nothing was left open. Return true.', { s: { t: 'array', label: 's', v: [...s], hl: Object.fromEntries([...s].map((_, k) => [k, 'ok'])) }, stack: { t: 'stack', label: 'stack of open brackets', v: [] } }, { answer: true });
    })],

  ['reverse-linked-list', 'Reverse Linked List', 'pointers', () => mk(
    { title: 'Reverse Linked List', number: 206, difficulty: 'Easy', slug: 'reverse-linked-list', patterns: ['Linked list', 'Three pointers'] },
    { oneLiner: 'Make every arrow in the list point the other way, and return the new first node.',
      analogy: 'A line of people each pointing at the person ahead. Walk down the line and ask each one to point at the person behind instead.',
      input: 'The head of a singly linked list.', output: 'The head of the same list, reversed.',
      constraints: [{ raw: '0 ≤ number of nodes ≤ 5000', means: 'The list can be empty. Your code must survive head = null.' }],
      traps: ['The moment you flip an arrow you lose the rest of the list, unless you saved it first.', 'An empty list and a single node are already reversed.'], hints: [] },
    { language: 'Python', time: 'O(n)', space: 'O(1)', approach: 'Walk with three pointers. Save the next node, flip the current arrow backwards, then step both pointers forward.',
      insight: 'nxt exists only to keep hold of the rest of the list while the arrow is being flipped.', verdict: { ok: true, note: '' },
      code: 'def reverseList(head):\n    prev, curr = None, head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev' },
    { input: 'head = [1, 2, 3, 4]', output: '[4, 3, 2, 1]' },
    [{ title: 'Reverse Linked List II', slug: 'reverse-linked-list-ii', why: 'The same flip, on a slice of the list.' }, { title: 'Palindrome Linked List', slug: 'palindrome-linked-list', why: 'Reverse the second half, then compare.' }],
    F => {
      const next = { 1: 2, 2: 3, 3: 4, 4: null }; let prev = null, curr = 1, nxt;
      const snap = (ptr, hl) => ({ list: { t: 'list', label: 'linked list', nodes: [1, 2, 3, 4].map(id => ({ id, v: id, next: next[id] })), ptr, hl } });
      F('Setup', 2, 'prev starts at null because the old head will become the tail. curr starts at the head.', snap({ curr }, { [curr]: 'cur' }));
      while (curr != null) {
        nxt = next[curr];
        F('Save', 4, `Save the node after ${curr} in nxt. Without this, flipping the arrow would cut us off from the rest of the list.`, snap({ prev: prev ?? undefined, curr, nxt }, { [curr]: 'cur', ...(nxt ? { [nxt]: 'cmp' } : {}) }), undefined,
          curr === 2 ? { q: 'curr is 2, prev is 1 and nxt is 3. Which arrow changes next?', options: ['2 now points to 3', '2 now points back to 1', '1 now points to 2'], answer: 1, why: 'curr.next = prev turns the arrow of node 2 around so it points at node 1.' } : undefined);
        next[curr] = prev;
        F('Flip', 5, prev == null ? `Point ${curr} at prev, which is null. Node ${curr} is now the end of the reversed list.` : `Flip the arrow: ${curr} now points back at ${prev}.`, snap({ prev: prev ?? undefined, curr, nxt }, { [curr]: 'ok' }));
        prev = curr; curr = nxt;
        F('Step', [6, 7], curr == null ? 'Move both pointers forward. curr has run off the end, so the loop stops.' : `Move both pointers forward: prev is ${prev}, curr is ${curr}.`, snap({ prev, curr }, { [prev]: 'done', ...(curr ? { [curr]: 'cur' } : {}) }));
      }
      F('Answer', 8, 'Every arrow has been flipped. prev sits on 4, the new head: 4 → 3 → 2 → 1.', snap({ prev }, { 1: 'ok', 2: 'ok', 3: 'ok', 4: 'ok' }));
    })],

  ['number-of-islands', 'Number of Islands', 'grid BFS', () => mk(
    { title: 'Number of Islands', number: 200, difficulty: 'Medium', slug: 'number-of-islands', patterns: ['Grid', 'BFS', 'Flood fill'] },
    { oneLiner: 'Count the separate patches of land in a map of land and water.',
      analogy: 'Fly over the map row by row. Each time you spot land you have not visited, plant a flag, then walk the whole island so you never count it again.',
      input: 'A grid of "1" (land) and "0" (water).', output: 'How many islands there are. Land connects up, down, left and right only.',
      constraints: [{ raw: 'm, n ≤ 300', means: 'Up to 90,000 cells. Visit each one a constant number of times.' }],
      traps: ['Diagonal neighbours do not connect.', 'Mark a cell as visited when you add it to the queue, not when you take it out, or it gets queued many times.'], hints: [] },
    { language: 'Python', time: 'O(m·n)', space: 'O(min(m, n))', approach: 'Scan every cell. On unvisited land, add one to the count and flood the whole island with BFS, sinking each cell as it is queued.',
      insight: 'Sinking visited land means the scan can only ever discover an island once.', verdict: { ok: true, note: '' },
      code: "def numIslands(grid):\n    rows, cols, count = len(grid), len(grid[0]), 0\n    for r in range(rows):\n        for c in range(cols):\n            if grid[r][c] == '1':\n                count += 1\n                queue = deque([(r, c)])\n                grid[r][c] = '0'\n                while queue:\n                    y, x = queue.popleft()\n                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):\n                        ny, nx = y + dy, x + dx\n                        if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == '1':\n                            grid[ny][nx] = '0'\n                            queue.append((ny, nx))\n    return count" },
    { input: 'grid = [[1,1,0,0],[1,0,0,1],[0,0,1,1]]', output: '2' },
    [{ title: 'Max Area of Island', slug: 'max-area-of-island', why: 'Same flood, but count the cells.' }, { title: 'Rotting Oranges', slug: 'rotting-oranges', why: 'BFS on a grid from many starting points.' }],
    F => {
      const g = [[1, 1, 0, 0], [1, 0, 0, 1], [0, 0, 1, 1]], R_ = 3, C = 4, sunk = {}; let count = 0, q = [];
      const snap = extra => ({ grid: { t: 'grid', label: 'grid', v: g.map(r => r.slice()), hl: { ...sunk, ...extra } }, queue: { t: 'queue', label: 'queue', v: q.map(([y, x]) => `(${y},${x})`) } });
      F('Setup', 2, 'Scan the grid row by row. count holds the number of islands found so far.', snap({}), { count });
      for (let r = 0; r < R_; r++) for (let c = 0; c < C; c++) {
        if (g[r][c] !== 1) { if (!sunk[r + ',' + c]) F('Scan', [3, 4, 5], `Cell (${r},${c}) is water. Keep scanning.`, snap({ [r + ',' + c]: 'cur' }), { r, c, count }); continue; }
        count++; q = [[r, c]]; g[r][c] = 0; sunk[r + ',' + c] = 'done';
        F('New island', [5, 6, 7, 8], `Unvisited land at (${r},${c}). That is island number ${count}. Sink it and start a flood from here.`, snap({ [r + ',' + c]: 'ok' }), { r, c, count },
          count === 1 ? { q: 'The flood starts at (0,0). Which cells join the queue next?', options: ['(0,1) and (1,0), its land neighbours', '(1,1), the diagonal cell', 'Every remaining "1" in the grid'], answer: 0, why: 'BFS only looks up, down, left and right, and only at land.' } : undefined);
        while (q.length) {
          const [y, x] = q.shift(), found = {};
          for (const [dy, dx] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ny = y + dy, nx = x + dx; if (ny >= 0 && ny < R_ && nx >= 0 && nx < C && g[ny][nx] === 1) { g[ny][nx] = 0; q.push([ny, nx]); found[ny + ',' + nx] = 'cmp'; } }
          const names = Object.keys(found).map(k => `(${k})`);
          Object.keys(found).forEach(k => sunk[k] = 'done');
          F('Flood', [10, 11, 12, 13, 14, 15], `Take (${y},${x}) from the queue. ` + (names.length ? `Its land neighbours ${names.join(' and ')} are sunk and queued.` : 'It has no unvisited land around it.'), snap({ [y + ',' + x]: 'cur', ...found }), { r, c, count });
        }
      }
      F('Answer', 16, `Every cell has been scanned. The flood ran ${count} times, so there are ${count} islands.`, snap({}), { count });
    })],

  ['binary-tree-level-order-traversal', 'Level Order Traversal', 'tree BFS', () => mk(
    { title: 'Binary Tree Level Order Traversal', number: 102, difficulty: 'Medium', slug: 'binary-tree-level-order-traversal', patterns: ['Tree', 'BFS', 'Queue'] },
    { oneLiner: 'Read the tree one floor at a time, top to bottom, left to right.',
      analogy: 'A building where you list everyone on floor 1, then everyone on floor 2, and so on.',
      input: 'The root of a binary tree.', output: 'A list of lists: the node values on each level.',
      constraints: [{ raw: '0 ≤ nodes ≤ 2000', means: 'The tree can be empty: return [].' }],
      traps: ['Freeze the queue size before the inner loop. The queue grows while you are emptying the level.'], hints: [] },
    { language: 'Python', time: 'O(n)', space: 'O(w)', approach: 'Use a queue. At the start of each round the queue holds exactly one level, so pop that many nodes and queue their children for the next round.',
      insight: 'len(queue), read once before the loop, is the trick that separates one level from the next.', verdict: { ok: true, note: '' },
      code: 'def levelOrder(root):\n    res, queue = [], deque([root] if root else [])\n    while queue:\n        level = []\n        for _ in range(len(queue)):\n            node = queue.popleft()\n            level.append(node.val)\n            if node.left: queue.append(node.left)\n            if node.right: queue.append(node.right)\n        res.append(level)\n    return res' },
    { input: 'root = [8, 3, 10, 1, 6, null, 14]', output: '[[8], [3, 10], [1, 6, 14]]' },
    [{ title: 'Binary Tree Right Side View', slug: 'binary-tree-right-side-view', why: 'Same loop, keep only the last node of each level.' }, { title: 'Binary Tree Zigzag Level Order Traversal', slug: 'binary-tree-zigzag-level-order-traversal', why: 'Same loop, reverse every other level.' }],
    F => {
      const N = { a: { v: 8, l: 'b', r: 'c' }, b: { v: 3, l: 'd', r: 'e' }, c: { v: 10, l: null, r: 'f' }, d: { v: 1 }, e: { v: 6 }, f: { v: 14 } };
      const nodes = Object.keys(N).map(id => ({ id, v: N[id].v, l: N[id].l ?? null, r: N[id].r ?? null }));
      const res = [], seen = {}; let q = ['a'], level = [];
      const snap = cur => { const hl = { ...seen }; q.forEach(id => hl[id] = 'cmp'); if (cur) hl[cur] = 'cur';
        return { tree: { t: 'tree', label: 'tree', nodes, root: 'a', hl, ptr: cur ? { node: cur } : {} }, queue: { t: 'queue', label: 'queue', v: q.map(id => N[id].v) }, level: { t: 'array', label: 'level', v: level.slice() }, res: { t: 'array', label: 'res', v: res.map(l => '[' + l.join(', ') + ']') } }; };
      F('Setup', 2, 'The queue starts with just the root. Whatever is in the queue at the start of a round is exactly one level.', snap());
      while (q.length) {
        const size = q.length; level = [];
        F('New level', [3, 4, 5], `The queue holds ${size} node${size > 1 ? 's' : ''}. That number is frozen now: this round pops exactly ${size}.`, snap(), { size },
          res.length === 1 ? { q: 'The queue holds 3 and 10. While processing them their children are added. How many nodes does this round pop?', options: ['2, the size measured before the loop', '5, everything that ends up in the queue', '1, then it starts a new level'], answer: 0, why: 'range(len(queue)) is evaluated once, so the children wait for the next round.' } : undefined);
        for (let k = 0; k < size; k++) {
          const id = q.shift(), n = N[id]; level.push(n.v); const kids = [n.l, n.r].filter(Boolean); q.push(...kids); seen[id] = 'done';
          F('Visit', [6, 7, 8, 9], `Pop ${n.v} and add it to this level. ` + (kids.length ? `Queue its ${kids.length > 1 ? 'children' : 'child'} ${kids.map(c => N[c].v).join(' and ')} for the next round.` : 'It has no children.'), snap(id), { size });
        }
        res.push(level.slice());
        F('Close level', 10, `The round is over. [${level.join(', ')}] goes into the result as one finished level.`, snap(), { size });
      }
      level = [];
      F('Answer', 11, 'The queue is empty, so every level has been read. Return the result.', snap());
    })],

  ['course-schedule', 'Course Schedule', 'graph', () => mk(
    { title: 'Course Schedule', number: 207, difficulty: 'Medium', slug: 'course-schedule', patterns: ['Graph', 'Topological sort', 'BFS'] },
    { oneLiner: 'Given which courses must come before which, decide whether you can finish them all.',
      analogy: 'Getting dressed: socks before shoes. If the rules ever say "shoes before socks" as well, you are stuck forever. That loop is what you are hunting for.',
      input: 'n courses and pairs [a, b] meaning "take b before a".', output: 'true if some order lets you take every course, false if the rules contain a cycle.',
      constraints: [{ raw: 'n ≤ 2000, prerequisites ≤ 5000', means: 'Small graph. One pass over nodes and edges, O(V + E), is expected.' }],
      traps: ['[a, b] means b → a. Drawing the arrow the wrong way round is the classic slip.', 'Courses with no rules at all still count toward n.'], hints: [] },
    { language: 'Python', time: 'O(V + E)', space: 'O(V + E)', approach: 'Count how many prerequisites each course still waits on. Take every course waiting on zero, and each time you take one, release the courses that depend on it.',
      insight: 'A course stuck inside a cycle never reaches zero, so it is never taken. If taken equals n, there was no cycle.', verdict: { ok: true, note: '' },
      code: 'def canFinish(n, prerequisites):\n    adj = [[] for _ in range(n)]\n    indeg = [0] * n\n    for course, pre in prerequisites:\n        adj[pre].append(course)\n        indeg[course] += 1\n    queue = deque(i for i in range(n) if indeg[i] == 0)\n    taken = 0\n    while queue:\n        cur = queue.popleft()\n        taken += 1\n        for nxt in adj[cur]:\n            indeg[nxt] -= 1\n            if indeg[nxt] == 0:\n                queue.append(nxt)\n    return taken == n' },
    { input: 'n = 5, prerequisites = [[1,0],[2,0],[3,1],[3,2],[4,3]]', output: 'true' },
    [{ title: 'Course Schedule II', slug: 'course-schedule-ii', why: 'Same loop, but record the order.' }, { title: 'Alien Dictionary', slug: 'alien-dictionary', why: 'Build the graph yourself, then topological sort.' }],
    F => {
      const n = 5, pre = [[1, 0], [2, 0], [3, 1], [3, 2], [4, 3]], adj = [[], [], [], [], []], indeg = [0, 0, 0, 0, 0], edges = pre.map(([c, p]) => [p, c]);
      pre.forEach(([c, p]) => { adj[p].push(c); indeg[c]++; });
      let q = [], taken = 0; const done = {}, edone = {};
      const snap = (hl, ehl, ihl, cur) => ({ graph: { t: 'graph', label: 'courses: arrow means "comes before"', directed: true, nodes: [0, 1, 2, 3, 4].map(id => ({ id })), edges, hl: { ...done, ...hl }, ehl: { ...edone, ...ehl }, ptr: cur != null ? { cur } : {} },
        indeg: { t: 'array', label: 'indeg: prerequisites still missing', v: indeg.slice(), hl: ihl }, queue: { t: 'queue', label: 'queue: ready to take', v: q.slice() } });
      F('Build', [2, 3, 4, 5, 6], 'Draw an arrow from each prerequisite to the course it unlocks, and count the arrows coming into every course.', snap({}, {}, {}), { taken });
      q = [0];
      F('Build', 7, 'Course 0 waits on nothing, so it is the only one ready to take.', snap({ 0: 'cmp' }, {}, { 0: 'ok' }), { taken });
      while (q.length) {
        const cur = q.shift(); taken++;
        F('Take', [9, 10, 11], `Take course ${cur}. That makes ${taken} taken.`, snap({ [cur]: 'cur' }, {}, {}, cur), { taken },
          cur === 1 ? { q: 'Course 1 is taken, so course 3 loses one prerequisite. Does 3 join the queue now?', options: ['Yes, one of its prerequisites is done', 'No, it still waits on course 2', 'No, 3 is part of a cycle'], answer: 1, why: 'indeg[3] drops from 2 to 1. It is only ready when it reaches 0.' } : undefined);
        for (const nxt of adj[cur]) {
          indeg[nxt]--; const ready = indeg[nxt] === 0; if (ready) q.push(nxt);
          F('Release', ready ? [12, 13, 14, 15] : [12, 13, 14], `Course ${nxt} needed ${cur}. It now waits on ${indeg[nxt]} more` + (ready ? ', so it is ready and joins the queue.' : '.'), snap({ [cur]: 'cur', [nxt]: ready ? 'ok' : 'cmp' }, { [cur + '-' + nxt]: 'cur' }, { [nxt]: ready ? 'ok' : 'cmp' }, cur), { taken });
          edone[cur + '-' + nxt] = 'done';
        }
        done[cur] = 'done';
      }
      F('Answer', 16, `The queue is empty and all ${n} courses were taken. No course was stuck in a cycle, so return true.`, snap({ 0: 'ok', 1: 'ok', 2: 'ok', 3: 'ok', 4: 'ok' }, {}, {}), { taken, answer: true });
    })],
];
