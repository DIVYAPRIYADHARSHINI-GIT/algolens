# AlgoLens

**See how algorithms think.**

A free algorithm visualiser that runs entirely in your browser. Pick a sorting, searching,
pathfinding or graph algorithm, load or draw the input, and watch it run one step at a time
with highlighted pseudocode, live counters and a plain-language explanation of every step.

- **Live demo:** _(added after deployment — see "Live demo" below)_
- **Repository:** _(added after deployment)_

---

## Purpose

Most algorithm visualisers animate a *version* of an algorithm. AlgoLens animates the
algorithm itself: every frame you see is generated from a recorded run of real code, every
finished result is checked against an independent reference solver, and you can step
backwards through any run and see exactly the same state you saw on the way forward.

Three properties are treated as non-negotiable:

1. **The animation is the algorithm.** The pure algorithm code emits a list of recorded
   steps; the renderers can only draw the state they are handed. They cannot invent a frame.
2. **Stepping back is exact.** Every step stores the inverse of its own change, so
   `seek(k)` always equals replaying from the start to step `k`. This is checked by
   property-based tests on random inputs.
3. **Results are verified, not asserted.** A finished sort must be ordered *and* a true
   permutation of the input. A path is re-walked for legality and compared with a
   Bellman-Ford reference. Graph results are compared with independently written solvers.
   If a check ever fails, the app shows an error and logs it — it never hides it.

---

## Features

### Sorting
Bubble (with early exit), selection, insertion, merge, quick (first / last / median-of-three
/ seeded-random pivot), heap, shell and counting sort. Bars and number-cell views, sizes 5 to
100, five presets (random, nearly sorted, reversed, few unique values, already sorted),
custom comma-separated values including duplicates and negatives, and a seeded generator so
any run can be repeated exactly. Element roles (comparing, swapping, writing, pivot, sorted,
current range) are shown with a colour **and** a letter cue, never colour alone. Merge and
quick sort show the live call stack and depth. An optional comparison tone is off by default,
with volume control, and the audio context is created only after you press play.

### Searching
Linear, binary and interpolation search with visible low / middle / high pointers and the
shrinking range. Binary and interpolation search on unsorted data show a clear warning and
offer to sort first; a wrong answer caused by unsorted input is reported as *"Precondition not
met"* with an explanation rather than as an app defect.

### Pathfinding (grid)
BFS, DFS, Dijkstra, A* (Manhattan / Euclidean / diagonal heuristics) and greedy best-first.
Each algorithm states plainly what it guarantees — BFS optimises *moves*, Dijkstra always
finds a cheapest path, A* does so only while its heuristic is admissible, DFS and greedy
guarantee nothing — and the verification panel compares the route's cost against the true
optimum. Draw and erase walls by dragging (mouse, pen and touch), paint weights 1 to 9, drag
the start and target, switch between 4-way and 8-way movement, and generate random walls, a
randomised depth-first maze or a recursive-division maze, all seeded. Sizes up to 60 by 40.
Shows the frontier, visited set, current cell, final path, per-cell cost on hover, and a stats
panel (visited cells, path length, path cost, steps).

### Graphs (node-link)
Add nodes by clicking, drag between nodes to connect them, set weights, toggle directed or
undirected, move and delete, and load examples. BFS and DFS traversal, Dijkstra shortest path,
Prim and Kruskal minimum spanning tree (Kruskal shows the union-find sets merging), plus
topological sort. The queue, stack or priority queue and the distance table are shown as they
change. Negative weights are refused for Dijkstra with an explanation of why its correctness
argument breaks.

### Explanation panels
Pseudocode with the current line highlighted, a Code tab with original JavaScript and Python
implementations (the shipped JavaScript is *executed by the test suite* and checked for
correctness), a live explanation line for every step announced politely to screen readers,
counters (comparisons, swaps, writes, array accesses, steps, recursion depth, edges relaxed),
a complexity table, and a Learn page per algorithm with original text.

### Compare, benchmark and practice
**Compare** runs two algorithms side by side on identical input with synchronised playback, a
race mode and a results table. **Benchmark** counts operations on growing inputs (10 to 5,000)
in a Web Worker with no animation, charted on linear and log scales against reference n,
n log n and n² curves — operation counts, not wall-clock time, because counts are exactly
reproducible. **Practice** asks you to predict the next step, with the questions generated
from the real recorded run so the correct answer is by construction what the algorithm
actually did.

### Sharing and saving
Copy a link that carries the whole setup — algorithm, input, options, run-length-encoded grid
or full graph — inside the URL hash, so sharing needs no server. Save named grids and graphs
in the browser, rename and delete them, export and import them as validated JSON, and export
the current picture as a PNG (also copied to the clipboard where supported).

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | SvelteKit 3 + Svelte 5 runes + TypeScript |
| Adapter | `@sveltejs/adapter-static` with a `200.html` SPA fallback — **no server routes at all** |
| Styling | One hand-written CSS token file (no CSS framework) |
| Fonts | Inter and JetBrains Mono, self-hosted via `@fontsource-variable` |
| Charts / renderers | Hand-written SVG and CSS grid — no chart library |
| Tests | Vitest + fast-check (property-based) + Playwright + axe-core |

Every dependency is free, well-maintained and pinned to an exact version. The algorithms, the
playback engine and all renderers are written from scratch for this project.

**Nothing is fetched from a third-party server at runtime**: no CDN, no analytics, no
trackers, no cookies, no API keys, no accounts.

---

## How the step recorder works

Each algorithm is pure TypeScript with no knowledge of the screen. It walks a local copy of
the data and pushes a `Step` for each observable event:

```ts
interface Step {
  kind: StepKind;      // compare | swap | write | visit | enqueue | relax | ...
  line: number;        // 1-based pseudocode line to highlight
  explain: string;     // "Comparing 5 and 3. 5 is greater, so they are out of order."
  patch: Patch[];      // forward mutations
  inverse: Patch[];    // exact inverse, applied in reverse when stepping back
  counters?: CounterDelta;
}
```

A `Patch` is a small tagged union (`arr`, `tag`, `cursor`, `range`, `stack`, `cell`, `node`,
`dist`, `prev`, `queue`, `edge`, `sets`, …). The crucial discipline is that **every inverse is
built from the value read before the mutation**, never from a guess about what the previous
value "should" be. A `Recorder` enforces a 60,000-step budget so a huge input can never
exhaust memory; when the budget is hit the trace is marked `truncated` and the UI says so,
while the reported *result* is still from the complete run.

## How the playback engine works

The engine owns one `VisualState` and a cursor, and exposes play / pause / step forward /
step back / jump / seek plus speeds from 0.25x to 8x. It deliberately **does not own a
timer**: the caller drives `tick(now)` from a `requestAnimationFrame` loop, which is what makes
the engine unit-testable with a fake clock and free of browser globals.

- **Stepping forward** applies `patch` in order and adds the counter deltas.
- **Stepping back** applies `inverse` in *reverse* order and subtracts the deltas.
- **Seeking** compares the cost of walking from the current cursor against the cost of
  replaying from the start, and picks the cheaper direction. Both are exact, so
  `seek(k) === replayTo(k)` always holds.
- **Changing speed** only changes the delay between steps; it can never change the sequence
  of states, and a property-based test asserts exactly that.
- Memory stays bounded because the engine stores one state plus reversible patches, not a
  snapshot per step. Six seeks across a 12,441-step trace measured **95 ms** in total.

At high speed several steps are applied per frame, so the screen-reader announcement is
rate-limited to roughly one per 900 ms rather than one per step, and nothing in the UI blinks
on a timer.

## How results are verified

| Family | Independent reference |
| --- | --- |
| Sorting | Output must be non-decreasing **and** a multiset permutation of the input |
| Searching | The reported index must really hold the target; "not found" is cross-checked by a linear scan |
| Pathfinding | The path is re-walked for contiguity, wall-avoidance and cost; the cost is compared against a **Bellman-Ford** pass over the grid; BFS is additionally compared against a plain breadth-first move-count reference |
| Graph Dijkstra | Every distance compared against a **Bellman-Ford** reference |
| Prim / Kruskal | Total weight compared against an independently written sorted-edge union-find reference (MST weight is unique even when the edge set is not) |
| Topological sort | Every directed edge must point forwards in the produced order |

The reference solvers live in `src/lib/core/reference.ts` and are written in a deliberately
different style from the recorders, so a shared bug is unlikely to cancel out. A passing run
shows a **Verified** badge; a failing one shows an error badge, lists what failed on the
Explanation tab, and logs to the console.

---

## Complexity table

Every value below was checked against standard textbook definitions, and is asserted in
`tests/catalog.test.ts` so it cannot drift.

### Sorting

| Algorithm | Best | Average | Worst | Space | Stable | In place |
| --- | --- | --- | --- | --- | --- | --- |
| Bubble (early exit) | O(n) | O(n²) | O(n²) | O(1) | Yes | Yes |
| Selection | O(n²) | O(n²) | O(n²) | O(1) | No | Yes |
| Insertion | O(n) | O(n²) | O(n²) | O(1) | Yes | Yes |
| Merge | O(n log n) | O(n log n) | O(n log n) | O(n) | Yes | No |
| Quick | O(n log n) | O(n log n) | O(n²) | O(log n) | No | Yes |
| Heap | O(n log n) | O(n log n) | O(n log n) | O(1) | No | Yes |
| Shell (halving gaps) | O(n log n) | sequence-dependent | O(n²) | O(1) | No | Yes |
| Counting | O(n + k) | O(n + k) | O(n + k) | O(k) | Yes | No |

Notes that matter and are shown in the app: bubble sort's O(n) best case **requires** the
early-exit flag (and makes exactly n−1 comparisons on sorted input — asserted in the tests);
selection sort has no cheap case at all and always makes n(n−1)/2 comparisons; quick sort's
O(log n) space is recursion depth, becoming O(n) in the worst case; Shell sort's bound depends
entirely on the gap sequence (Hibbard gives O(n^1.5), Sedgewick O(n^4/3)), so quoting one
figure without naming the sequence is meaningless; counting sort is linear only when k, the
*value range*, is O(n).

### Searching

| Algorithm | Best | Average | Worst | Space |
| --- | --- | --- | --- | --- |
| Linear | O(1) | O(n) | O(n) | O(1) |
| Binary | O(1) | O(log n) | O(log n) | O(1) iterative |
| Interpolation | O(1) | O(log log n) on uniform data | O(n) | O(1) |

### Pathfinding and graphs

| Algorithm | Time | Space | Shortest path? |
| --- | --- | --- | --- |
| BFS | O(V + E) | O(V) | Fewest **moves** only |
| DFS | O(V + E) | O(V) | **No guarantee** |
| Dijkstra | O(E log V) binary heap; O(E + V log V) Fibonacci | O(V) | Yes, with non-negative weights |
| A* | O(E log V) | O(V) | Yes, **only** with an admissible heuristic |
| Greedy best-first | O(E log V) | O(V) | **No guarantee**, with any heuristic |
| Prim | O(E log V) binary heap; O(V²) array | O(V + E) | — (MST) |
| Kruskal | O(E log E) | O(V + E) | — (MST) |
| Topological (Kahn) | O(V + E) | O(V) | — |

A point the app is explicit about: with 8-way movement where a diagonal costs the same as a
straight move, **Manhattan distance is not admissible** — it overestimates, so A* becomes fast
but can return a route that is not cheapest. AlgoLens warns about that combination instead of
quietly returning a suboptimal path, and the A*-equals-Dijkstra tests only use admissible
combinations.

### Sources checked (titles only)

- *Introduction to Algorithms* — Cormen, Leiserson, Rivest, Stein (CLRS), 4th edition
- *The Art of Computer Programming, Volume 3: Sorting and Searching* — Donald Knuth
- *Algorithms*, 4th edition — Sedgewick and Wayne
- *Algorithm Design* — Kleinberg and Tardos
- *Data Structures and Algorithm Analysis in C++* — Mark Allen Weiss
- *A High-Speed Sorting Procedure* (1959) — D. L. Shell, for the original halving gap sequence
- *A Note on Two Problems in Connexion with Graphs* (1959) — E. W. Dijkstra
- *A Formal Basis for the Heuristic Determination of Minimum Cost Paths* (1968) — Hart,
  Nilsson and Raphael, for the admissibility condition on A*
- *Topological Sorting of Large Networks* (1962) — A. B. Kahn
- Wikipedia articles on each algorithm, used only to cross-check the figures above against the
  printed sources

---

## Storage and sharing, and their limits

**All data is stored only in this browser's `localStorage`, under one key
(`algolens.settings.v1`). Nothing is ever uploaded.** There is no server, no database, no
cloud storage and no account — the app is published as static files, so there is not even a
server route to send data to.

Data access goes through a single `SettingsStore` interface with one implementation
(`createSettingsStore`, backed by `localStorage`) in `src/lib/core/store.ts`. The schema is
versioned with an ordered migration list in `src/lib/core/schema.ts`.

What is stored: theme, sound and motion preferences, saved grids (run-length encoded walls
plus sparse weights), saved graphs, and the practice score.

Handled explicitly and covered by tests:

- **Storage disabled** (private browsing): the app runs in memory for the session and says so.
- **Storage full**: the change is kept in memory, and a message explains what happened — it is
  never silently dropped.
- **Corrupted data**: unreadable blobs are reset, invalid entries are repaired and reported.
- **Backup import**: validated before anything changes, with a specific error for each failure
  mode, and it **always asks before replacing existing data**.

**Share links** encode the setup as base64url JSON in the URL hash. Limits worth knowing: the
data is *inside the link*, so anyone you give it to can read the input (the app says so); the
hash is capped at 8,000 characters and a 60 × 40 grid is well within that thanks to
run-length encoding; and a broken, truncated, oversized or deliberately hostile link produces
a clear message and never a crash — fuzz-tested over hundreds of random strings.

---

## Setup

Requires Node 20 or newer.

```bash
npm install
npm run dev        # development server
npm run build      # production build into build/
npm run preview    # serve the production build locally
```

### Tests

```bash
npm run check        # svelte-check: 0 errors, 0 warnings
npm run test         # 174 unit and property-based tests
npm run probe        # 59 headless-Chrome end-to-end checks
npm run probe:a11y   # 30 axe-core / keyboard / text-alternative checks
npm run probe:design # 19 design-QA checks + 88 screenshots
npm run test:all     # everything above
```

Browser probes build the site and serve `build/` exactly the way Vercel serves it, then drive
the real UI. They fail on **any** console error or unhandled rejection, so a silent exception
cannot pass as green.

---

## Deployment

Deployed as a static site on **Vercel's free Hobby plan**, which is for **non-commercial use**.
The hosting project is the only Vercel resource: no Blob, no Storage, no KV, no Postgres, no
database, no Marketplace integration, and no environment variables of any kind.

## Live demo

_Added after deployment._

---

## Project layout

```
src/
  lib/
    algorithms/   sorting, searching, grid, pathfinding, graph   (pure, no UI)
    core/         types, state, engine, heap, rng, reference, verify, schema, store, share
    components/   renderers and chrome (Icon, ArrayView, GridView, GraphView, SidePanel, …)
    data/         catalog (pseudocode, complexity, code, Learn text), presets, samples
    benchmark.ts  operation counters + Web Worker
    practice.ts   question generator, driven from real recorded steps
  routes/         one page per mode, plus settings and privacy
tests/            unit and property-based tests (Vitest + fast-check)
probes/           e2e, a11y, design-QA and performance probes (Playwright + axe-core)
```
