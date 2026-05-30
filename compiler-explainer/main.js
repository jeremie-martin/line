const NS = "http://www.w3.org/2000/svg";

const state = {
  compiler: "legacy",
  stageIndex: 0,
  labChoice: 1,
};

const compilers = {
  legacy: {
    name: "Legacy greedy compiler",
    accent: "#bf5b38",
    soft: "#f5dfd4",
    status:
      "scripts/v0/compile.ts is the older v0 implementation. It solves gaps left to right, commits the locally cheapest surviving candidate, and uses bounded backtracking plus validation retries when the cascade breaks.",
    summary: [
      ["Entry point", "compile(userSpec, seed) in scripts/v0/compile.ts; scripts/v0/run.ts still uses it for manual runs."],
      ["Search unit", "One contact-ending gap at a time. Each gap receives up to CALIB.K sampled Arc candidates, currently defaulting to 48."],
      ["Guarantee shape", "Deterministic for a fixed Spec and seed, but not an anytime optimizer: raising local candidate budget can change an early greedy choice and make the final cascade worse."],
      ["Output", "TrackJson plus DriftReport and legacy CompileStats counters."],
    ],
    stages: [
      {
        kind: "Input",
        title: "Spec",
        detail:
          "The authoring surface is a TypeScript Spec: duration, hard Contact times, optional defaults, and section axes for air, speed, contact_style, and grain.",
        bullets: [
          "Hard contacts are converted from seconds to frames at 40 fps.",
          "Sections are soft targets; overlapping sections are resolved before each gap is compiled.",
          "Optional start/preroll state is resolved before search begins.",
        ],
        file: "scripts/v0/types.ts",
      },
      {
        kind: "Slice",
        title: "Gaps",
        detail:
          "Hard contacts slice the timeline. Each interior gap ends with a required landing/contact, while the tail gap just carries the rider to the end.",
        bullets: [
          "sliceTimeline builds ordered Gap objects.",
          "effectiveAxes and sampleGapTargets assign per-gap style targets.",
          "The same gap structure is reused by both compilers.",
        ],
        file: "scripts/v0/core/substrate.ts",
      },
      {
        kind: "Generate",
        title: "Ranked candidates",
        detail:
          "For each contact gap, the legacy compiler samples candidate arcs, bisects anchor Y until the landing occurs near the target frame, simulates, hard-gates, then ranks survivors by local axis cost.",
        bullets: [
          "Hard gate: survive, land on the target contact, and avoid off-beat landings in the measured window.",
          "Cost is equal-axis squared distance from the gap targets.",
          "Residual air/grain targeting gives the legacy path some look-ahead behavior.",
        ],
        file: "scripts/v0/core/candidate.ts",
      },
      {
        kind: "Commit",
        title: "Greedy cascade",
        detail:
          "The best local candidate is committed and lr-core state is advanced. If a later gap has no viable candidate, the loop backs up to an earlier gap with an unused alternative.",
        bullets: [
          "Prefix engines cache immutable lr-core states after committed gaps.",
          "Backtracking is bounded; exhausted gaps are reported as hard failures.",
          "The committed path is the answer, not one leaf among many alternatives.",
        ],
        file: "scripts/v0/compile.ts",
      },
      {
        kind: "Repair",
        title: "Validation retries",
        detail:
          "A full assembled track can create failures that per-gap windows missed. The legacy compiler detects those owners, retries offending prefixes, then runs in-place polish passes.",
        bullets: [
          "Off-beat landings and missing contacts are mapped back to owning gaps by line id.",
          "Polish mutates committed fits for air/contact refinements.",
          "Final simulation builds the DriftReport.",
        ],
        file: "scripts/v0/compile.ts",
      },
    ],
  },
  lds: {
    name: "Standalone LDS compiler",
    accent: "#236f8f",
    soft: "#d7edf4",
    status:
      "scripts/v0/optimizer/api.ts exposes compileLDS. It keeps a deterministic best-so-far register over a fixed leaf sequence: backtracking floor, guided repair leaves, discrepancy deviations, and optional polished variants.",
    summary: [
      ["Entry point", "compileLDS(spec, seed, opts) in scripts/v0/optimizer/api.ts; npm run golden currently imports this path directly."],
      ["Search unit", "Complete track leaves. Each leaf is a full candidate cascade that can be scored against the DriftReport contract."],
      ["Guarantee shape", "Budget truncates a fixed deterministic leaf prefix; best-so-far can only improve under the comparator."],
      ["Output", "TrackJson, DriftReport, and optimizer-native stats: sim_frames, leaves_considered, improvements, repair_rounds, cache hits, and base backtracks."],
    ],
    stages: [
      {
        kind: "Input",
        title: "Spec context",
        detail:
          "compileLDS validates the same Spec contract, resolves preroll/start, slices contacts into gaps, and samples deterministic per-gap targets.",
        bullets: [
          "This preserves the v0 authoring surface.",
          "The optimizer reuses the shared core substrate and candidate sampler.",
          "Seed validation is explicit because per-gap RNGs use integer mixing.",
        ],
        file: "scripts/v0/optimizer/api.ts",
      },
      {
        kind: "Floor",
        title: "Backtracking base leaf",
        detail:
          "The d=0 leaf is a deterministic backtracking descent. It follows the cheapest candidates where possible, backs up on downstream dead ends, and may skip an unlandable contact to keep the leaf complete.",
        bullets: [
          "BASE_BACKTRACK_DEPTH controls the per-failure backtrack cap.",
          "Candidate lists are cached by committed candidate identity.",
          "The floor is budget-exempt so there is always at least one complete leaf to score when possible.",
        ],
        file: "scripts/v0/optimizer/lds.ts",
      },
      {
        kind: "Repair",
        title: "Guided repair leaves",
        detail:
          "If the assembled base leaf misses a contact or lands off-beat, the optimizer forbids the failure-owning committed candidate and re-runs the backtracking descent as another leaf.",
        bullets: [
          "Failures are attributed by detector events and contact line ids.",
          "Repair leaves are additive; they do not mutate the incumbent answer.",
          "Their ranks are measured relative to the base path, not absolute sorted indices.",
        ],
        file: "scripts/v0/optimizer/lds.ts",
      },
      {
        kind: "Explore",
        title: "LDS deviations",
        detail:
          "Limited-discrepancy search enumerates complete cascades near the base path. Rank 0 follows the base while on-base; after the first deviation, rank 0 means greedy continuation from the new state.",
        bullets: [
          "N_CAND is a fixed code constant, not a budget knob.",
          "maxDiscrepancy extends the leaf sequence; it does not reorder earlier leaves.",
          "The budget cuts off traversal at deterministic physics-frame boundaries.",
        ],
        file: "scripts/v0/optimizer/node.ts",
      },
      {
        kind: "Select",
        title: "Best-so-far register",
        detail:
          "Every evaluated leaf is scored once and offered to the register. Strict improvement is required to replace the incumbent, so ties stay stable as budget grows.",
        bullets: [
          "Comparator: contract pass first, then axis_quality, then full score for failing leaves.",
          "Polish variants are extra leaves, never in-place changes to the incumbent.",
          "Sim-frame budget is metered by lr-core getLastFrameIndex deltas.",
        ],
        file: "scripts/v0/optimizer/register.ts",
      },
    ],
  },
};

const comparisonRows = [
  {
    topic: "Decision granularity",
    legacy: "Commits one best local GapFit at a time.",
    lds: "Evaluates whole-track leaves and lets the register choose the best full cascade.",
  },
  {
    topic: "Budget meaning",
    legacy: "CALIB.K changes local candidate pools; larger K can reveal a locally cheaper but globally worse branch.",
    lds: "Budget controls how many fixed-order leaves are considered; more budget means a prefix superset.",
  },
  {
    topic: "Recovery",
    legacy: "Backtracks inside the main loop and retries final-validation owners in place.",
    lds: "Repairs are additional leaves created by forbidding failure-owning choices.",
  },
  {
    topic: "Scoring",
    legacy: "Ranks candidates by per-gap local axis cost, then reports final DriftReport quality.",
    lds: "Scores each assembled leaf with the final DriftReport comparator before replacement.",
  },
  {
    topic: "Risk",
    legacy: "Greedy cascade choices can be brittle; compute is not a clean external dial.",
    lds: "Floor cost can consume small budgets before repair/deviation work runs; single-arc gaps remain a simplification.",
  },
];

const evidence = [
  {
    title: "Current new entry point",
    text: "scripts/v0/golden.ts imports compileLDS from scripts/v0/optimizer/api.ts; current golden runs the optimizer path directly.",
  },
  {
    title: "Shared data contract",
    text: "scripts/v0/types.ts defines Spec, Gap, Arc, DriftReport, and CompileStats for both v0 compilers.",
  },
  {
    title: "Candidate physics gate",
    text: "scripts/v0/core/candidate.ts samples arcs, bisects anchor Y, simulates with lr-core, and rejects survival/sync/off-beat failures.",
  },
  {
    title: "Monotone selection mechanism",
    text: "scripts/v0/optimizer/register.ts keeps the strictly best leaf under a deterministic comparator.",
  },
  {
    title: "Older non-v0 stack",
    text: "scripts/lib contains Move, Route, Monte Carlo, primitive registry, and beam-search experiments; useful history, not the main legacy/new pair.",
  },
];

const chartData = {
  legacy: {
    pill: "K-sweep",
    xLabel: "candidate budget K",
    yLabel: "mean axis quality among passing rows",
    series: [
      { x: 8, y: 0.47 },
      { x: 16, y: 0.504 },
      { x: 32, y: 0.51 },
      { x: 48, y: 0.499 },
      { x: 96, y: 0.47 },
    ],
    notes: "Historical greedy_v2 K-sweep: more local candidates did not reliably improve quality, and some specs lost passing coverage.",
  },
  lds: {
    pill: "prefix best",
    xLabel: "leaves considered",
    yLabel: "best-so-far score",
    series: [
      { x: 1, y: 72 },
      { x: 2, y: 72 },
      { x: 3, y: 82 },
      { x: 4, y: 88 },
      { x: 5, y: 88 },
    ],
    notes: "Mechanism view: failing or tied leaves do not replace the incumbent, while better passing leaves ratchet the answer upward.",
  },
};

const lab = {
  legacy: {
    choices: [
      { value: 1, label: "K 1" },
      { value: 2, label: "K 2" },
      { value: 3, label: "K 3" },
      { value: 4, label: "K 4" },
    ],
    readout: (k) => `K=${k}`,
    explain: {
      1: {
        score: 72,
        contract: "pass",
        text: "Only the first sampled candidate is visible. It is not locally best in the larger pool, but it leaves a usable downstream state.",
        path: ["A", "A1", "A2"],
      },
      2: {
        score: 18,
        contract: "fail",
        text: "A new lower local-cost first-gap candidate appears. Greedy commits it, then the next gap inherits a poor state and misses the contract.",
        path: ["B", "B1"],
      },
      3: {
        score: 82,
        contract: "pass",
        text: "Another candidate changes the cascade again. This one is globally better, but the improvement is accidental rather than guaranteed by K.",
        path: ["C", "C1", "C2"],
      },
      4: {
        score: 48,
        contract: "fail",
        text: "The locally cheapest visible first choice changes again and produces an off-beat/missing failure. Local budget is not monotone global quality.",
        path: ["D", "D1"],
      },
    },
    nodes: [
      { id: "A", x: 135, y: 72, label: "A", sub: "cost .34" },
      { id: "B", x: 135, y: 152, label: "B", sub: "cost .20" },
      { id: "C", x: 135, y: 232, label: "C", sub: "cost .16" },
      { id: "D", x: 135, y: 312, label: "D", sub: "cost .12" },
      { id: "A1", x: 360, y: 72, label: "A1", sub: "ok" },
      { id: "B1", x: 360, y: 152, label: "B1", sub: "dead" },
      { id: "C1", x: 360, y: 232, label: "C1", sub: "ok" },
      { id: "D1", x: 360, y: 312, label: "D1", sub: "off" },
      { id: "A2", x: 585, y: 72, label: "72", sub: "pass" },
      { id: "C2", x: 585, y: 232, label: "82", sub: "pass" },
    ],
    edges: [
      ["root", "A"],
      ["root", "B"],
      ["root", "C"],
      ["root", "D"],
      ["A", "A1"],
      ["B", "B1"],
      ["C", "C1"],
      ["D", "D1"],
      ["A1", "A2"],
      ["C1", "C2"],
    ],
  },
  lds: {
    choices: [
      { value: 1, label: "1 leaf" },
      { value: 2, label: "2 leaves" },
      { value: 3, label: "3 leaves" },
      { value: 5, label: "5 leaves" },
    ],
    readout: (n) => `${n} leaf${n === 1 ? "" : "s"}`,
    leaves: [
      { id: "L0", score: 72, contract: "pass", label: "floor", text: "Backtracking base leaf." },
      { id: "L1", score: 48, contract: "fail", label: "repair", text: "Guided repair tries a different owner but still fails." },
      { id: "L2", score: 82, contract: "pass", label: "d=1", text: "One discrepancy finds a better full cascade." },
      { id: "L3", score: 88, contract: "pass", label: "polish", text: "Clone-and-test polish improves the best leaf." },
      { id: "L4", score: 55, contract: "fail", label: "d=2", text: "A later failing leaf is ignored by the register." },
    ],
  },
};

function $(id) {
  return document.getElementById(id);
}

function svgEl(tag, attrs = {}, children = []) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const child of children) el.appendChild(child);
  return el;
}

function textEl(text, x, y, attrs = {}) {
  const el = svgEl("text", { x, y, ...attrs });
  el.textContent = text;
  return el;
}

function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function setCompiler(compiler) {
  state.compiler = compiler;
  state.stageIndex = 0;
  state.labChoice = compiler === "legacy" ? 1 : 1;
  for (const button of document.querySelectorAll(".mode-button")) {
    const active = button.dataset.compiler === compiler;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  render();
}

function render() {
  renderSummary();
  renderPipeline();
  renderStageDetail();
  renderLabControls();
  renderLab();
  renderChart();
  renderComparison();
  renderEvidence();
}

function renderSummary() {
  const data = compilers[state.compiler];
  $("system-title").textContent = data.name;
  $("compiler-status").textContent = data.status;
  const grid = $("summary-grid");
  clear(grid);
  for (const [term, desc] of data.summary) {
    const wrap = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = desc;
    wrap.append(dt, dd);
    grid.appendChild(wrap);
  }
}

function renderPipeline() {
  const svg = $("pipeline-svg");
  clear(svg);
  const data = compilers[state.compiler];
  $("pipeline-title").textContent = `${data.name} flow`;
  $("stage-counter").textContent = `${state.stageIndex + 1}/${data.stages.length}`;

  svg.appendChild(svgEl("defs", {}, [
    svgEl("marker", {
      id: "arrow",
      markerWidth: 10,
      markerHeight: 10,
      refX: 8,
      refY: 5,
      orient: "auto",
    }, [svgEl("path", { d: "M0,0 L10,5 L0,10 z", class: "flow-arrow" })]),
  ]));

  const points = [
    { x: 110, y: 78 },
    { x: 330, y: 78 },
    { x: 550, y: 78 },
    { x: 770, y: 78 },
    { x: 550, y: 250 },
  ];

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = i === 3
      ? `M${a.x + 78},${a.y + 26} C${a.x + 120},${a.y + 120} ${b.x + 100},${b.y - 80} ${b.x + 78},${b.y}`
      : `M${a.x + 78},${a.y + 26} L${b.x - 18},${b.y + 26}`;
    svg.appendChild(svgEl("path", { d, class: "flow-line", "marker-end": "url(#arrow)" }));
  }

  data.stages.forEach((stage, index) => {
    const p = points[index];
    const g = svgEl("g", {
      class: `stage-node${index === state.stageIndex ? " is-active" : ""}`,
      tabindex: 0,
      role: "button",
      "aria-label": stage.title,
    });
    const rect = svgEl("rect", {
      x: p.x - 86,
      y: p.y,
      width: 172,
      height: 86,
      rx: 6,
      style: index === state.stageIndex ? `stroke:${data.accent};fill:${data.soft}` : "",
    });
    g.appendChild(rect);
    g.appendChild(textEl(stage.kind, p.x - 68, p.y + 24, { class: "stage-kind" }));
    g.appendChild(textEl(stage.title, p.x - 68, p.y + 57));
    g.addEventListener("click", () => {
      state.stageIndex = index;
      renderPipeline();
      renderStageDetail();
    });
    g.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        state.stageIndex = index;
        renderPipeline();
        renderStageDetail();
      }
    });
    svg.appendChild(g);
  });
}

function renderStageDetail() {
  const data = compilers[state.compiler];
  const stage = data.stages[state.stageIndex];
  const panel = $("stage-detail");
  clear(panel);
  const label = document.createElement("p");
  label.className = "section-label";
  label.textContent = stage.kind;
  const h = document.createElement("h2");
  h.textContent = stage.title;
  const p = document.createElement("p");
  p.textContent = stage.detail;
  const ul = document.createElement("ul");
  ul.className = "detail-list";
  for (const item of stage.bullets) {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  }
  const file = document.createElement("p");
  file.innerHTML = `Primary file: <code>${stage.file}</code>`;
  panel.append(label, h, p, ul, file);
}

function renderLabControls() {
  const controls = $("lab-controls");
  clear(controls);
  const cfg = lab[state.compiler];
  for (const choice of cfg.choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `lab-choice${state.labChoice === choice.value ? " is-active" : ""}`;
    button.textContent = choice.label;
    button.addEventListener("click", () => {
      state.labChoice = choice.value;
      renderLabControls();
      renderLab();
    });
    controls.appendChild(button);
  }
}

function renderLab() {
  $("lab-readout").textContent = lab[state.compiler].readout(state.labChoice);
  if (state.compiler === "legacy") renderLegacyLab();
  else renderLdsLab();
}

function renderLegacyLab() {
  const cfg = lab.legacy;
  const selected = cfg.explain[state.labChoice];
  const root = $("search-visual");
  clear(root);

  const svg = svgEl("svg", { viewBox: "0 0 720 350", class: "cascade-svg" });
  const nodesById = new Map(cfg.nodes.map((n) => [n.id, n]));
  nodesById.set("root", { id: "root", x: 32, y: 192, label: "start", sub: "state" });
  const active = new Set(selected.path);
  active.add("root");

  for (const [from, to] of cfg.edges) {
    const a = nodesById.get(from);
    const b = nodesById.get(to);
    const isActive = active.has(from) && active.has(to);
    svg.appendChild(svgEl("line", {
      x1: a.x + 56,
      y1: a.y,
      x2: b.x - 44,
      y2: b.y,
      class: `path-edge${isActive ? " active" : ""}`,
      style: isActive ? `stroke:${compilers.legacy.accent}` : "",
    }));
  }

  for (const node of nodesById.values()) {
    const inPath = active.has(node.id);
    const fail = node.sub === "dead" || node.sub === "off";
    const pass = node.sub === "pass";
    const g = svgEl("g");
    g.appendChild(svgEl("circle", {
      cx: node.x,
      cy: node.y,
      r: node.id === "root" ? 34 : 38,
      class: `path-node${pass ? " best" : ""}${fail ? " fail" : ""}${inPath ? "" : " pending"}`,
      style: inPath ? `fill:${compilers.legacy.soft}` : "",
    }));
    g.appendChild(textEl(node.label, node.x, node.y - 3, {
      "text-anchor": "middle",
      "font-size": node.id === "root" ? 14 : 18,
      "font-weight": 900,
    }));
    g.appendChild(textEl(node.sub, node.x, node.y + 17, {
      "text-anchor": "middle",
      "font-size": 12,
      fill: "#5b6660",
      "font-weight": 800,
    }));
    svg.appendChild(g);
  }

  svg.appendChild(textEl("gap 1", 108, 334, { class: "axis-label" }));
  svg.appendChild(textEl("gap 2", 335, 334, { class: "axis-label" }));
  svg.appendChild(textEl("report", 560, 334, { class: "axis-label" }));

  root.appendChild(svg);
  root.appendChild(explainBox(selected, "Greedy selected path"));
}

function renderLdsLab() {
  const cfg = lab.lds;
  const visible = cfg.leaves.slice(0, state.labChoice);
  const best = bestLeaf(visible);
  const root = $("search-visual");
  clear(root);

  const svg = svgEl("svg", { viewBox: "0 0 720 350", class: "cascade-svg" });
  svg.appendChild(textEl("fixed leaf sequence E", 38, 34, { class: "axis-label" }));
  svg.appendChild(textEl("best-so-far register", 454, 34, { class: "axis-label" }));
  svg.appendChild(svgEl("line", { x1: 42, y1: 64, x2: 665, y2: 64, class: "path-edge" }));

  cfg.leaves.forEach((leaf, index) => {
    const x = 78 + index * 118;
    const seen = index < state.labChoice;
    const isBest = best && best.id === leaf.id;
    const fail = leaf.contract === "fail";
    svg.appendChild(svgEl("circle", {
      cx: x,
      cy: 122,
      r: 38,
      class: `path-node${isBest ? " best" : ""}${fail ? " fail" : ""}${seen ? "" : " pending"}`,
      style: seen ? `fill:${compilers.lds.soft}` : "",
    }));
    svg.appendChild(textEl(leaf.label, x, 116, {
      "text-anchor": "middle",
      "font-size": 13,
      "font-weight": 900,
    }));
    svg.appendChild(textEl(String(leaf.score), x, 138, {
      "text-anchor": "middle",
      "font-size": 16,
      "font-weight": 900,
    }));

    if (seen) {
      const registerY = 236;
      svg.appendChild(svgEl("line", {
        x1: x,
        y1: 162,
        x2: x,
        y2: registerY - 38,
        class: "path-edge active",
        style: `stroke:${isBest ? compilers.lds.accent : "#a8b8b1"}`,
      }));
      svg.appendChild(svgEl("rect", {
        x: x - 45,
        y: registerY - 26,
        width: 90,
        height: 52,
        rx: 6,
        fill: isBest ? compilers.lds.soft : "#f7f9f7",
        stroke: isBest ? compilers.lds.accent : "#acbbb5",
        "stroke-width": isBest ? 3 : 2,
      }));
      svg.appendChild(textEl(isBest ? "keep" : "ignore", x, registerY - 3, {
        "text-anchor": "middle",
        "font-size": 14,
        "font-weight": 900,
      }));
      svg.appendChild(textEl(leaf.contract, x, registerY + 17, {
        "text-anchor": "middle",
        "font-size": 12,
        fill: "#5b6660",
        "font-weight": 800,
      }));
    }
  });

  const text = best
    ? {
        score: best.score,
        contract: best.contract,
        text:
          "The returned track is the best leaf seen so far. Later leaves only replace it if the comparator says they are strictly better.",
      }
    : { score: 0, contract: "none", text: "No leaf considered yet." };

  root.appendChild(svg);
  root.appendChild(explainBox(text, "Register output"));
}

function explainBox(selected, heading) {
  const box = document.createElement("div");
  box.className = "lab-explain";
  const h = document.createElement("h3");
  h.textContent = heading;
  const score = document.createElement("div");
  score.className = "lab-score";
  const scoreA = document.createElement("span");
  const scoreB = document.createElement("span");
  scoreA.textContent = `score ${selected.score}`;
  scoreB.textContent = `contract ${selected.contract}`;
  score.append(scoreA, scoreB);
  const p = document.createElement("p");
  p.textContent = selected.text;
  const legend = document.createElement("div");
  legend.className = "legend-row";
  legend.innerHTML = "<span class=\"pass\">passing best</span><span class=\"fail\">failing leaf</span><span class=\"seen\">visited path</span>";
  box.append(h, score, p, legend);
  return box;
}

function bestLeaf(leaves) {
  let best = null;
  for (const leaf of leaves) {
    if (!best) {
      best = leaf;
      continue;
    }
    if (leaf.contract === "pass" && best.contract !== "pass") best = leaf;
    else if (leaf.contract === best.contract && leaf.score > best.score) best = leaf;
  }
  return best;
}

function renderChart() {
  const data = chartData[state.compiler];
  $("chart-pill").textContent = data.pill;
  $("chart-note").textContent = data.notes;
  const svg = $("quality-chart");
  clear(svg);
  const pad = { left: 70, right: 24, top: 30, bottom: 58 };
  const w = 720;
  const h = 330;
  const xs = data.series.map((p) => p.x);
  const ys = data.series.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys) * 1.12;
  const minY = state.compiler === "legacy" ? 0.42 : 0;

  const sx = (x) => pad.left + ((x - minX) / (maxX - minX || 1)) * (w - pad.left - pad.right);
  const sy = (y) => h - pad.bottom - ((y - minY) / (maxY - minY || 1)) * (h - pad.top - pad.bottom);

  svg.appendChild(svgEl("line", { x1: pad.left, y1: h - pad.bottom, x2: w - pad.right, y2: h - pad.bottom, stroke: "#a8b8b1", "stroke-width": 2 }));
  svg.appendChild(svgEl("line", { x1: pad.left, y1: pad.top, x2: pad.left, y2: h - pad.bottom, stroke: "#a8b8b1", "stroke-width": 2 }));

  for (let i = 0; i < 4; i++) {
    const y = minY + ((maxY - minY) * i) / 3;
    const yy = sy(y);
    svg.appendChild(svgEl("line", { x1: pad.left, y1: yy, x2: w - pad.right, y2: yy, stroke: "#d6ded9", "stroke-width": 1 }));
    svg.appendChild(textEl(state.compiler === "legacy" ? y.toFixed(2) : Math.round(y), pad.left - 12, yy + 4, {
      "text-anchor": "end",
      class: "axis-label",
    }));
  }

  const d = data.series.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x)},${sy(p.y)}`).join(" ");
  svg.appendChild(svgEl("path", { d, class: "chart-line", stroke: compilers[state.compiler].accent }));

  for (const p of data.series) {
    svg.appendChild(svgEl("circle", { cx: sx(p.x), cy: sy(p.y), r: 6, fill: compilers[state.compiler].accent, class: "chart-dot" }));
    svg.appendChild(textEl(String(p.x), sx(p.x), h - 25, { "text-anchor": "middle", class: "axis-label" }));
  }

  svg.appendChild(textEl(data.xLabel, w / 2, h - 6, { "text-anchor": "middle", class: "axis-label" }));
  svg.appendChild(textEl(data.yLabel, 18, 22, { class: "axis-label" }));
}

function renderComparison() {
  const table = $("comparison-table");
  clear(table);
  const headers = ["Topic", "Legacy greedy", "Standalone LDS"];
  for (const header of headers) {
    const cell = document.createElement("div");
    cell.className = "comparison-cell header";
    cell.textContent = header;
    table.appendChild(cell);
  }
  for (const row of comparisonRows) {
    for (const value of [row.topic, row.legacy, row.lds]) {
      const cell = document.createElement("div");
      cell.className = `comparison-cell${value === row.topic ? " topic" : ""}`;
      cell.textContent = value;
      table.appendChild(cell);
    }
  }
}

function renderEvidence() {
  const list = $("evidence-list");
  clear(list);
  for (const item of evidence) {
    const row = document.createElement("div");
    row.className = "evidence-item";
    const title = document.createElement("strong");
    const text = document.createElement("span");
    title.textContent = item.title;
    text.textContent = item.text;
    row.append(title, text);
    list.appendChild(row);
  }
}

for (const button of document.querySelectorAll(".mode-button")) {
  button.addEventListener("click", () => setCompiler(button.dataset.compiler));
}

render();
