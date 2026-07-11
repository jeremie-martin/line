const NS = "http://www.w3.org/2000/svg";

const AXES = ["air", "speed", "grain", "elevation", "amplitude", "impact"];
const AXIS_META = {
  air: { label: "air", color: "#1f6b73" },
  speed: { label: "speed", color: "#a8442f" },
  grain: { label: "grain", color: "#5d7a43" },
  elevation: { label: "elevation", color: "#57508d" },
  amplitude: { label: "amplitude", color: "#b57d1d" },
  impact: { label: "impact", color: "#a8442f" },
};
const CAMERA_META = {
  zoom: { label: "zoom", color: "#2d5d8f" },
};
const NOTE_TAGS = ["sync", "impact", "zoom", "speed", "air", "amplitude", "elevation", "music", "flat", "too much"];

const refs = {
  specSelect: document.getElementById("spec-select"),
  reload: document.getElementById("reload-spec"),
  subtitle: document.getElementById("spec-subtitle"),
  audio: document.getElementById("audio"),
  play: document.getElementById("play"),
  back: document.getElementById("back"),
  forward: document.getElementById("forward"),
  timeNow: document.getElementById("time-now"),
  timeTotal: document.getElementById("time-total"),
  scrub: document.getElementById("scrub"),
  musicMeta: document.getElementById("music-meta"),
  summary: document.getElementById("summary-row"),
  timeline: document.getElementById("timeline"),
  zoomOut: document.getElementById("zoom-out"),
  zoomIn: document.getElementById("zoom-in"),
  zoomSelection: document.getElementById("zoom-selection"),
  zoomReset: document.getElementById("zoom-reset"),
  followPlayhead: document.getElementById("follow-playhead"),
  viewWindow: document.getElementById("view-window"),
  snapMode: document.getElementById("snap-mode"),
  snapSelection: document.getElementById("snap-selection"),
  toggleBeats: document.getElementById("toggle-beats"),
  togglePhases: document.getElementById("toggle-phases"),
  toggleNotes: document.getElementById("toggle-notes"),
  cursorTime: document.getElementById("cursor-time"),
  cursorGrid: document.getElementById("cursor-grid"),
  axisReadouts: document.getElementById("axis-readouts"),
  editorAnchor: document.getElementById("editor-anchor"),
  editState: document.getElementById("edit-state"),
  editTime: document.getElementById("edit-time"),
  editAxis: document.getElementById("edit-axis"),
  editValue: document.getElementById("edit-value"),
  editEase: document.getElementById("edit-ease"),
  editImpact: document.getElementById("edit-impact"),
  stageEdit: document.getElementById("stage-edit"),
  clearEdits: document.getElementById("clear-edits"),
  undoEdit: document.getElementById("undo-edit"),
  redoEdit: document.getElementById("redo-edit"),
  editList: document.getElementById("edit-list"),
  calibrationState: document.getElementById("calibration-state"),
  calibrationSummary: document.getElementById("calibration-summary"),
  calibrationBudget: document.getElementById("calibration-budget"),
  calibrationSeeds: document.getElementById("calibration-seeds"),
  calibrationCandidate: document.getElementById("calibration-candidate"),
  calibrationRun: document.getElementById("calibration-run"),
  calibrationApply: document.getElementById("calibration-apply"),
  calibrationDisable: document.getElementById("calibration-disable"),
  calibrationReport: document.getElementById("calibration-report"),
  calibrationLogs: document.getElementById("calibration-logs"),
  scopeTabs: document.getElementById("scope-tabs"),
  noteAnchor: document.getElementById("note-anchor"),
  notePath: document.getElementById("note-path"),
  noteText: document.getElementById("note-text"),
  tagRow: document.getElementById("tag-row"),
  saveState: document.getElementById("save-state"),
  deleteNote: document.getElementById("delete-note"),
  clearNotes: document.getElementById("clear-notes"),
  notesList: document.getElementById("notes-list"),
  agentJson: document.getElementById("agent-json"),
  copyContext: document.getElementById("copy-context"),
  toast: document.getElementById("toast"),
};

const state = {
  specs: [],
  data: null,
  notes: [],
  notesPath: null,
  edits: [],
  history: null,
  analysis: null,
  timeline: null,
  cursorT: 0,
  viewStart: 0,
  viewEnd: 0,
  selection: null,
  pointerDrag: null,
  suppressNextClick: false,
  snapMode: "beat",
  selectedScope: "moment",
  activeAnchor: null,
  activeNoteId: null,
  activeTags: [],
  saveTimer: null,
  pendingNoteSave: null,
  calibrationJob: null,
  calibrationPoll: null,
  simulatedPlaying: false,
  lastTickMs: performance.now(),
  followPlayhead: true,
  followSuspended: false,
};

init().catch((error) => showFatal(error));

async function init() {
  wireEvents();
  await loadSpecList();
  requestAnimationFrame(tick);
}

function wireEvents() {
  refs.specSelect.addEventListener("change", () => loadSpec(refs.specSelect.value, true));
  refs.reload.addEventListener("click", () => loadSpec(refs.specSelect.value, false, {
    cursorT: specTime(),
    viewStart: state.viewStart,
    viewEnd: state.viewEnd,
    selectedScope: state.selectedScope,
  }));
  refs.play.addEventListener("click", togglePlayback);
  refs.back.addEventListener("click", () => seekTo(specTime() - 5));
  refs.forward.addEventListener("click", () => seekTo(specTime() + 5));
  refs.scrub.addEventListener("input", () => {
    if (!state.data) return;
    seekTo(Number(refs.scrub.value) * state.data.spec.duration);
  });
  refs.audio.addEventListener("loadedmetadata", updatePlaybackUi);
  refs.audio.addEventListener("timeupdate", updatePlaybackUi);
  refs.audio.addEventListener("play", updatePlaybackUi);
  refs.audio.addEventListener("pause", updatePlaybackUi);
  refs.audio.addEventListener("ended", () => {
    if (state.data && state.cursorT < state.data.spec.duration) state.simulatedPlaying = true;
    updatePlaybackUi();
  });
  refs.audio.addEventListener("error", () => {
    refs.musicMeta.textContent = "Audio failed to load";
    updatePlaybackUi();
  });
  refs.zoomOut.addEventListener("click", () => zoomAround(specTime(), 2, { manual: true }));
  refs.zoomIn.addEventListener("click", () => zoomAround(specTime(), 0.5, { manual: true }));
  refs.zoomSelection.addEventListener("click", () => zoomToSelection());
  refs.zoomReset.addEventListener("click", () => resetZoom());
  refs.followPlayhead.addEventListener("click", () => {
    state.followPlayhead = !state.followPlayhead || state.followSuspended;
    state.followSuspended = false;
    updateViewUi();
    if (state.followPlayhead) revealTime(specTime(), { manual: false });
  });
  refs.snapMode.addEventListener("change", () => {
    state.snapMode = refs.snapMode.value;
  });
  refs.snapSelection.addEventListener("click", () => snapCurrentSelection());
  refs.timeline.addEventListener("pointerdown", onTimelinePointerDown);
  refs.timeline.addEventListener("pointermove", onTimelinePointerMove);
  refs.timeline.addEventListener("pointerup", onTimelinePointerUp);
  refs.timeline.addEventListener("pointercancel", cancelTimelineDrag);
  refs.timeline.addEventListener("wheel", onTimelineWheel, { passive: false });
  refs.timeline.addEventListener("selectstart", (event) => event.preventDefault());
  refs.timeline.addEventListener("dragstart", (event) => event.preventDefault());
  refs.timeline.addEventListener("click", (event) => {
    if (!state.timeline) return;
    if (state.suppressNextClick) {
      state.suppressNextClick = false;
      return;
    }
    clearTransientSelection();
    const t = event.shiftKey ? state.timeline.tAtClient(event.clientX) : snapTime(state.timeline.tAtClient(event.clientX));
    seekTo(t);
  });
  refs.timeline.addEventListener("mouseleave", () => {
    if (!state.pointerDrag) setHover(null);
  });
  [refs.toggleBeats, refs.togglePhases, refs.toggleNotes].forEach((input) => {
    input.addEventListener("change", renderTimeline);
  });
  refs.scopeTabs.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-scope]");
    if (!button) return;
    state.selectedScope = button.dataset.scope;
    renderScopeTabs();
    selectAnchorAtCursor();
  });
  refs.noteText.addEventListener("input", () => saveActiveNoteDebounced());
  refs.tagRow.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-tag]");
    if (!button) return;
    const tag = button.dataset.tag;
    state.activeTags = state.activeTags.includes(tag)
      ? state.activeTags.filter((value) => value !== tag)
      : [...state.activeTags, tag];
    renderTags();
    saveActiveNoteDebounced();
  });
  refs.deleteNote.addEventListener("click", () => deleteActiveNote());
  refs.clearNotes.addEventListener("click", () => clearAllNotes());
  refs.stageEdit.addEventListener("click", () => applyActiveEdit());
  refs.clearEdits.addEventListener("click", () => loadSpec(refs.specSelect.value, false, {
    cursorT: specTime(),
    viewStart: state.viewStart,
    viewEnd: state.viewEnd,
    selectedScope: state.selectedScope,
  }));
  refs.undoEdit.addEventListener("click", () => applyHistoryAction("undo"));
  refs.redoEdit.addEventListener("click", () => applyHistoryAction("redo"));
  document.querySelector(".editor-grid")?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyActiveEdit();
  });
  refs.calibrationRun.addEventListener("click", () => runCalibration());
  refs.calibrationApply.addEventListener("click", () => applyCalibrationSelection());
  refs.calibrationDisable.addEventListener("click", () => disableCalibrationSelection());
  refs.editTime.addEventListener("change", () => {
    const snapped = snapTime(Number(refs.editTime.value));
    if (Number.isFinite(snapped)) refs.editTime.value = String(round(snapped, 3));
  });
  refs.notesList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-note-id]");
    if (!button) return;
    const note = state.notes.find((item) => item.id === button.dataset.noteId);
    if (!note) return;
    state.selectedScope = note.scope;
    renderScopeTabs();
    state.selection = note.scope === "range" && typeof note.t0 === "number" && typeof note.t1 === "number"
      ? { t0: note.t0, t1: note.t1 }
      : null;
    seekTo(note.t, { select: false });
    setActiveAnchor({
      id: note.id,
      t: note.t,
      scope: note.scope,
      index: note.index,
      t0: note.t0 ?? null,
      t1: note.t1 ?? null,
      axis: note.axis ?? null,
      title: note.title,
    });
  });
  refs.copyContext.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(refs.agentJson.textContent);
      toast("Copied agent context");
    } catch {
      toast("Clipboard unavailable");
    }
  });
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && (key === "z" || key === "y")) {
      if (isEditableElement(document.activeElement)) return;
      event.preventDefault();
      if (key === "z" && event.shiftKey) applyHistoryAction("redo");
      else if (key === "z") applyHistoryAction("undo");
      else applyHistoryAction("redo");
      return;
    }
    const tag = document.activeElement?.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
    if (event.key === " ") {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === "ArrowLeft") {
      seekTo(specTime() - 1);
    } else if (event.key === "ArrowRight") {
      seekTo(specTime() + 1);
    }
  });
}

async function loadSpecList() {
  const res = await fetch("/api/specs", { cache: "no-cache" });
  if (!res.ok) throw new Error(`spec list HTTP ${res.status}`);
  const body = await res.json();
  const params = new URLSearchParams(location.search);
  const collection = params.get("collection");
  const allSpecs = body.specs || [];
  state.specs = collection === "v2"
    ? allSpecs.filter((spec) => spec.group.startsWith("v2/"))
    : allSpecs;
  refs.specSelect.innerHTML = "";
  for (const spec of state.specs) {
    const opt = document.createElement("option");
    opt.value = spec.path;
    opt.textContent = spec.label;
    refs.specSelect.appendChild(opt);
  }
  const requested = params.get("spec");
  const preferred = collection === "v2"
    ? state.specs.find((spec) => spec.group === "v2/representative")
    : state.specs.find((spec) => spec.group === "production")
    || state.specs.find((spec) => spec.path === "scripts/v0/specs/drums_0_56s_creative.ts");
  const first = state.specs.find((spec) => spec.path === requested) || preferred || state.specs[0];
  if (!first) throw new Error("no specs found");
  refs.specSelect.value = first.path;
  await loadSpec(first.path, !requested);
}

async function loadSpec(specPath, pushUrl, restore = null) {
  await flushPendingNoteSave();
  stopCalibrationPolling();
  pausePlayback();
  refs.subtitle.textContent = "Loading " + specPath;
  refs.saveState.textContent = "";
  refs.timeline.innerHTML = "";
  state.data = null;
  state.notes = [];
  state.notesPath = null;
  state.edits = [];
  state.history = null;
  state.analysis = null;
  state.activeAnchor = null;
  state.activeNoteId = null;
  state.activeTags = [];
  state.calibrationJob = null;
  state.viewStart = 0;
  state.viewEnd = 0;
  state.selection = null;
  state.pointerDrag = null;
  state.suppressNextClick = false;
  if (restore?.selectedScope) state.selectedScope = restore.selectedScope;

  const [view, notes, edits, historyStatus] = await Promise.all([
    fetch(`/api/spec-view?spec=${encodeURIComponent(specPath)}&samples=1400`, { cache: "no-cache" }).then(readJsonOk),
    fetch(`/api/spec-notes?spec=${encodeURIComponent(specPath)}`, { cache: "no-cache" }).then(readJsonOk),
    fetch(`/api/spec-edits?spec=${encodeURIComponent(specPath)}`, { cache: "no-cache" }).then(readJsonOk),
    fetch(`/api/spec-history?spec=${encodeURIComponent(specPath)}`, { cache: "no-cache" }).then(readJsonOk),
  ]);
  state.data = view;
  state.notes = notes.notes || [];
  state.notesPath = notes.notesPath || null;
  state.edits = edits.edits || [];
  state.history = historyStatus.history || null;
  state.cursorT = clamp(Number(restore?.cursorT ?? 0), 0, view.spec.duration);
  state.viewStart = clamp(Number(restore?.viewStart ?? 0), 0, view.spec.duration);
  state.viewEnd = clamp(Number(restore?.viewEnd ?? view.spec.duration), state.viewStart + 1e-6, view.spec.duration);
  state.analysis = await loadAnalysis(view.music);

  if (view.music?.audioUrl) {
    refs.audio.src = view.music.audioUrl;
    refs.audio.load();
  } else {
    refs.audio.removeAttribute("src");
    refs.audio.load();
  }

  if (pushUrl) {
    const params = new URLSearchParams(location.search);
    params.set("spec", specPath);
    window.history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  renderAll();
  seekTo(state.cursorT, { select: true, reveal: false, resumeFollow: false });
}

async function readJsonOk(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function loadAnalysis(music) {
  if (!music?.beatsUrl) return null;
  try {
    const raw = await fetch(music.beatsUrl, { cache: "no-cache" }).then(readJsonOk);
    return normalizeAnalysis(raw, musicOffset(music));
  } catch {
    return null;
  }
}

function normalizeAnalysis(raw, offset) {
  const withOffset = (t) => round(audioToSpecTime(Number(t), offset), 4);
  const beats = numericTimes(raw.beats ?? raw.beat_times).map(withOffset);
  const downbeats = numericTimes(raw.downbeats).map(withOffset);
  const onsetSource = raw.drum_onsets ?? raw.onsets_drums ?? raw.onsets_mix ?? raw.onsets ?? [];
  const onsets = numericEvents(onsetSource).map((event) => ({
    t: withOffset(event.t),
    strength: event.strength,
  }));
  return { beats, downbeats, onsets };
}

function numericTimes(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "number" ? item : typeof item?.t === "number" ? item.t : typeof item?.time === "number" ? item.time : null)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
}

function numericEvents(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "number") return { t: item, strength: 1 };
      const t = typeof item?.t === "number" ? item.t : typeof item?.time === "number" ? item.time : null;
      const strength = typeof item?.strength === "number" ? item.strength : 1;
      return typeof t === "number" && Number.isFinite(t) ? { t, strength } : null;
    })
    .filter(Boolean);
}

function clearNativeSelection() {
  window.getSelection?.()?.removeAllRanges();
}

function isEditableElement(element) {
  if (!element) return false;
  if (element.isContentEditable) return true;
  const tag = element.tagName;
  return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
}

function snapCandidates(mode = state.snapMode) {
  if (mode === "beat") {
    const beats = state.analysis ? [...state.analysis.beats, ...state.analysis.downbeats] : [];
    return beats.length ? beats : (state.data?.contacts || []).map((contact) => contact.t);
  }
  if (mode === "contact") return (state.data?.contacts || []).map((contact) => contact.t);
  if (mode === "keyframe") return [
    ...(state.data?.keyframes || []).map((point) => point.t),
    ...cameraZoomKeyframes().map((point) => point.t),
  ];
  return [];
}

function snapTime(t, mode = state.snapMode) {
  if (!state.data || mode === "off") return Number.isFinite(t) ? t : 0;
  const candidates = snapCandidates(mode).filter((value) => Number.isFinite(value));
  if (candidates.length === 0) return clamp(t, 0, state.data.spec.duration);
  let best = candidates[0];
  let bestDistance = Math.abs(best - t);
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - t);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return round(clamp(best, 0, state.data.spec.duration), 4);
}

function snapCurrentSelection() {
  const range = normalizedRange(state.selection);
  if (!range) return;
  let t0 = snapTime(range.t0);
  let t1 = snapTime(range.t1);
  if (t0 === t1) {
    const candidates = snapCandidates()
      .filter((value) => value > t0)
      .sort((a, b) => a - b);
    if (candidates[0] !== undefined) t1 = candidates[0];
  }
  const snapped = normalizedRange({ t0, t1 });
  if (!snapped || snapped.t1 - snapped.t0 < 0.01) return;
  state.selection = snapped;
  state.selectedScope = "range";
  renderScopeTabs();
  seekTo((snapped.t0 + snapped.t1) / 2, { select: false });
  setActiveAnchor(anchorFor("range", (snapped.t0 + snapped.t1) / 2));
}

function clearTransientSelection() {
  clearNativeSelection();
  if (!state.selection && state.selectedScope !== "range") return;
  state.selection = null;
  if (state.selectedScope === "range") {
    state.selectedScope = "moment";
    renderScopeTabs();
  }
  renderTimeline();
  renderAgentContext();
}

function onTimelinePointerDown(event) {
  if (!state.timeline || event.button !== 0) return;
  refs.timeline.focus?.({ preventScroll: true });
  const mark = event.target.closest?.("[data-mark-kind]");
  if (mark) {
    event.preventDefault();
    clearNativeSelection();
    const anchor = anchorForMarkElement(mark);
    if (!anchor) return;
    state.selectedScope = anchor.scope;
    renderScopeTabs();
    seekTo(anchor.t, { select: false, reveal: true });
    setActiveAnchor(anchor);
    const editable = Boolean(anchorEdit(anchor)?.editable);
    state.pointerDrag = {
      mode: "mark",
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      anchor,
      editable,
      laneY: Number(mark.dataset.laneY),
      laneH: Number(mark.dataset.laneH),
      moved: false,
    };
    refs.timeline.setPointerCapture?.(event.pointerId);
    state.suppressNextClick = true;
    return;
  }
  event.preventDefault();
  clearNativeSelection();
  const rawT = state.timeline.tAtClient(event.clientX);
  const t = event.shiftKey ? rawT : snapTime(rawT);
  state.pointerDrag = {
    mode: "range",
    pointerId: event.pointerId,
    clientX: event.clientX,
    startT: t,
    moved: false,
  };
  refs.timeline.setPointerCapture?.(event.pointerId);
}

function onTimelinePointerMove(event) {
  if (!state.timeline) return;
  setHover(state.timeline.xAtClient(event.clientX));
  const drag = state.pointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  clearNativeSelection();
  if (drag.mode === "mark") {
    const distance = Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY);
    if (distance < 3 && !drag.moved) return;
    drag.moved = true;
    if (drag.editable) updateEditorFieldsFromMarkDrag(drag, event);
    return;
  }
  const distance = Math.abs(event.clientX - drag.clientX);
  if (distance < 4 && !drag.moved) return;
  drag.moved = true;
  const rawT = state.timeline.tAtClient(event.clientX);
  const t = event.shiftKey ? rawT : snapTime(rawT);
  state.selection = { t0: drag.startT, t1: t };
  renderTimeline();
}

function onTimelinePointerUp(event) {
  if (!state.timeline || !state.pointerDrag || state.pointerDrag.pointerId !== event.pointerId) return;
  const drag = state.pointerDrag;
  refs.timeline.releasePointerCapture?.(event.pointerId);
  state.pointerDrag = null;
  event.preventDefault();
  clearNativeSelection();
  if (drag.mode === "mark") {
    state.suppressNextClick = true;
    setTimeout(() => {
      state.suppressNextClick = false;
    }, 0);
    const edit = anchorEdit(drag.anchor);
    if (!drag.editable) {
      toast(edit?.readOnlyReason || "Selection is read-only");
    } else if (drag.moved) {
      applyActiveEdit();
    }
    return;
  }
  if (!drag.moved) return;

  const rawT = state.timeline.tAtClient(event.clientX);
  const range = normalizedRange({ t0: drag.startT, t1: event.shiftKey ? rawT : snapTime(rawT) });
  state.suppressNextClick = true;
  setTimeout(() => {
    state.suppressNextClick = false;
  }, 0);
  if (!range || range.t1 - range.t0 < 0.05) {
    state.selection = null;
    renderTimeline();
    return;
  }

  state.selection = range;
  state.selectedScope = "range";
  renderScopeTabs();
  seekTo((range.t0 + range.t1) / 2, { select: false });
  setActiveAnchor(anchorFor("range", (range.t0 + range.t1) / 2));
}

function cancelTimelineDrag(event) {
  if (state.pointerDrag?.pointerId === event.pointerId) {
    state.pointerDrag = null;
    renderTimeline();
  }
}

function anchorForMarkElement(mark) {
  const index = Number(mark.dataset.index);
  if (!Number.isInteger(index)) return null;
  if (mark.dataset.markKind === "axisKeyframe") {
    const axis = mark.dataset.axis;
    const point = (state.data?.keyframes || []).find((item) => item.axis === axis && item.index === index);
    if (!point) return null;
    return {
      id: `keyframe:${point.axis}:${point.index}`,
      t: point.t,
      scope: "keyframe",
      index: point.index,
      axis: point.axis,
      title: `keyframe ${point.axis} #${point.index} at ${formatTime(point.t)} - ${fmt(point.v)}${point.ease ? ` ${point.ease}` : ""}`,
    };
  }
  if (mark.dataset.markKind === "zoomKeyframe") {
    const point = cameraZoomKeyframes().find((item) => item.index === index);
    if (!point) return null;
    return {
      id: `keyframe:zoom:${point.index}`,
      t: point.t,
      scope: "keyframe",
      index: point.index,
      axis: "zoom",
      title: `keyframe zoom #${point.index} at ${formatTime(point.t)} - ${fmt(point.zoom)}`,
    };
  }
  if (mark.dataset.markKind === "contactImpact") {
    const contact = state.data?.contacts[index];
    if (!contact) return null;
    return {
      id: `contact:${index}`,
      t: contact.t,
      scope: "contact",
      index,
      title: `contact #${index} at ${formatTime(contact.t)} - impact ${contact.impact === null ? "untargeted" : fmt(contact.impact)}`,
    };
  }
  return null;
}

function anchorEdit(anchor) {
  if (!anchor) return null;
  if (anchor.scope === "keyframe") return keyframeByAnchor(anchor)?.edit || null;
  if (anchor.scope === "contact" && typeof anchor.index === "number") return state.data?.contacts?.[anchor.index]?.edit || null;
  return null;
}

function updateEditorFieldsFromMarkDrag(drag, event) {
  const t = event.shiftKey ? state.timeline.tAtClient(event.clientX) : snapTime(state.timeline.tAtClient(event.clientX));
  if (drag.anchor.scope === "keyframe") {
    refs.editTime.value = String(round(t, 3));
    const y = svgYAtClient(refs.timeline, event.clientY, state.timeline.height);
    const u = clamp((drag.laneY + drag.laneH - 5 - y) / Math.max(1e-9, drag.laneH - 10), 0, 1);
    if (drag.anchor.axis === "zoom") {
      const range = cameraZoomRange();
      refs.editValue.value = String(round(range.min + u * (range.max - range.min), 3));
    } else {
      refs.editValue.value = String(round(u, 3));
    }
  } else if (drag.anchor.scope === "contact") {
    const y = svgYAtClient(refs.timeline, event.clientY, state.timeline.height);
    const base = drag.laneY + drag.laneH - 8;
    const value = clamp((base - y) / Math.max(1e-9, drag.laneH - 14), 0, 1);
    refs.editImpact.value = String(round(value, 3));
  }
}

function onTimelineWheel(event) {
  if (!state.timeline || !state.data) return;
  event.preventDefault();
  const span = state.viewEnd - state.viewStart;
  if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
    const delta = ((event.deltaX || event.deltaY) / Math.max(1, refs.timeline.getBoundingClientRect().width)) * span;
    setView(state.viewStart + delta, state.viewEnd + delta, { manual: true });
    return;
  }
  const center = state.timeline.tAtClient(event.clientX);
  const factor = Math.exp(event.deltaY * 0.002);
  zoomAround(center, factor, { manual: true });
}

function resetZoom() {
  if (!state.data) return;
  setView(0, state.data.spec.duration, { manual: true });
}

function zoomToSelection() {
  const range = normalizedRange(state.selection);
  if (!range) return;
  const pad = Math.max(0.25, (range.t1 - range.t0) * 0.08);
  setView(range.t0 - pad, range.t1 + pad, { manual: true });
}

function zoomAround(center, factor, opts = { manual: false }) {
  if (!state.data) return;
  const duration = state.data.spec.duration;
  const currentSpan = Math.max(0.001, state.viewEnd - state.viewStart || duration);
  const nextSpan = clamp(currentSpan * factor, Math.min(0.5, duration), duration);
  const anchor = clamp(center, 0, duration);
  const u = currentSpan > 0 ? clamp((anchor - state.viewStart) / currentSpan, 0.05, 0.95) : 0.5;
  setView(anchor - nextSpan * u, anchor + nextSpan * (1 - u), opts);
}

function setView(t0, t1, opts = { manual: false }) {
  if (!state.data) return;
  const duration = state.data.spec.duration;
  const minSpan = Math.min(0.5, duration);
  let start = clamp(Math.min(t0, t1), 0, duration);
  let end = clamp(Math.max(t0, t1), 0, duration);
  if (end - start < minSpan) {
    const mid = clamp((start + end) / 2, 0, duration);
    start = mid - minSpan / 2;
    end = mid + minSpan / 2;
  }
  if (start < 0) {
    end = Math.min(duration, end - start);
    start = 0;
  }
  if (end > duration) {
    start = Math.max(0, start - (end - duration));
    end = duration;
  }
  state.viewStart = round(start, 4);
  state.viewEnd = round(end, 4);
  if (opts.manual) suspendFollow();
  renderTimeline();
  updatePlaybackUi();
}

function revealTime(t, opts = { manual: false }) {
  if (!state.data || (t >= state.viewStart && t <= state.viewEnd)) return;
  const duration = state.data.spec.duration;
  const span = Math.max(0.5, state.viewEnd - state.viewStart || duration);
  setView(t - span * 0.35, t + span * 0.65, opts);
}

function followTime(t) {
  if (!state.data || !state.followPlayhead || state.followSuspended) return;
  const span = Math.max(0.5, state.viewEnd - state.viewStart || state.data.spec.duration);
  if (span >= state.data.spec.duration - 1e-6) return;
  const margin = span * 0.18;
  if (t < state.viewStart + margin || t > state.viewEnd - margin) {
    setView(t - span * 0.35, t + span * 0.65, { manual: false });
  }
}

function suspendFollow() {
  if (isPlaying()) state.followSuspended = true;
  updateViewUi();
}

function resumeFollow() {
  state.followSuspended = false;
  updateViewUi();
}

function updateViewUi() {
  if (!state.data) return;
  refs.viewWindow.textContent = `${formatTime(state.viewStart)}-${formatTime(state.viewEnd)}`;
  const hasRange = Boolean(normalizedRange(state.selection));
  refs.zoomSelection.disabled = !hasRange;
  refs.snapSelection.disabled = !hasRange;
  refs.followPlayhead.classList.toggle("on", state.followPlayhead && !state.followSuspended);
}

function renderAll() {
  renderHeader();
  renderTimeline();
  renderScopeTabs();
  renderTags();
  renderNotesList();
  renderEditAxisOptions();
  renderEditsList();
  renderHistoryControls();
  renderCalibration();
  renderInspector();
  renderEditor();
  selectAnchorAtCursor();
}

function renderHeader() {
  const { data } = state;
  if (!data) return;
  refs.subtitle.textContent = `${data.spec.label} - ${formatTime(data.spec.duration)} - ${data.summary.contacts} contacts`;
  refs.timeTotal.textContent = "/ " + formatTime(data.spec.duration);
  refs.musicMeta.textContent = data.music
    ? [data.music.title, data.music.artist, data.music.tempo].filter(Boolean).join(" - ") || data.music.audio
    : "No audio linked";
  const s = data.summary;
  refs.summary.innerHTML = [
    metric("duration", formatTime(data.spec.duration)),
    metric("contacts", s.contacts),
    metric("keyframes", s.keyframes || 0),
    metric("zoom", s.zoomKeyframes ? `${fmt(s.zoomMin)}-${fmt(s.zoomMax)} (${s.zoomKeyframes})` : "none"),
    metric("impact", s.impactTargets ? `${fmt(s.minImpact)}-${fmt(s.maxImpact)}` : "none"),
    metric("gap", `${fmt(s.shortestGap)}-${fmt(s.longestGap)}s`),
    metric("axes", s.activeAxes.join(", ") || "none"),
  ].join("");
  updateViewUi();
}

function metric(label, value) {
  return `<span class="metric">${escapeHtml(label)} <b>${escapeHtml(String(value))}</b></span>`;
}

function renderTimeline() {
  const { data } = state;
  if (!data) return;
  const svg = refs.timeline;
  svg.innerHTML = "";

  const axisNames = AXES.filter((axis) => data.axes[axis]);
  const W = 1240;
  const L = 72;
  const R = 24;
  const plotW = W - L - R;
  const spectroH = 108;
  const impactH = 66;
  const axisH = 48;
  const axisGap = 10;
  const hasZoomLane = Boolean(data.camera?.zoom?.points?.length);
  const zoomH = hasZoomLane ? axisH : 0;
  const zoomGap = hasZoomLane ? axisGap : 0;
  const notesH = refs.toggleNotes.checked ? 34 : 0;
  const top = 20;
  const spectroY = top + 26;
  const impactY = spectroY + spectroH + 28;
  const axesY = impactY + impactH + 18;
  const H = axesY + axisNames.length * (axisH + axisGap) + zoomH + zoomGap + notesH + 42;
  const viewStart = clamp(state.viewStart, 0, data.spec.duration);
  const viewEnd = clamp(state.viewEnd || data.spec.duration, viewStart + 1e-6, data.spec.duration);
  const visibleSpan = Math.max(1e-6, viewEnd - viewStart);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;
  state.timeline = {
    left: L,
    right: W - R,
    width: plotW,
    height: H,
    duration: data.spec.duration,
    viewStart,
    viewEnd,
    visibleSpan,
    rawXFor: (t) => L + ((t - viewStart) / visibleSpan) * plotW,
    xFor: (t) => L + clamp((t - viewStart) / visibleSpan, 0, 1) * plotW,
    tFor: (x) => clamp(viewStart + ((x - L) / plotW) * visibleSpan, viewStart, viewEnd),
    xAtClient: (clientX) => {
      const x = svgXAtClient(svg, clientX, W);
      return clamp(x, L, W - R);
    },
    tAtClient: (clientX) => {
      const x = svgXAtClient(svg, clientX, W);
      return clamp(viewStart + ((x - L) / plotW) * visibleSpan, viewStart, viewEnd);
    },
  };

  add(svg, "rect", { x: 0, y: 0, width: W, height: H, fill: "#fffdfa" });
  drawPhases(svg, L, plotW, H);
  drawTimeRuler(svg, L, plotW, top, H);
  drawSpectrogram(svg, L, plotW, spectroY, spectroH);
  drawBeatLayer(svg, L, plotW, spectroY, spectroH, H);
  drawContacts(svg, L, plotW, spectroY, H);
  drawImpactLane(svg, L, plotW, impactY, impactH);

  let y = axesY;
  for (const axis of axisNames) {
    drawAxisLane(svg, axis, L, plotW, y, axisH);
    y += axisH + axisGap;
  }
  if (hasZoomLane) {
    drawZoomLane(svg, L, plotW, y, zoomH);
    y += zoomH + zoomGap;
  }
  if (refs.toggleNotes.checked) drawNoteLane(svg, L, plotW, y, notesH);
  drawSelection(svg, L, plotW, H);

  const playX = state.timeline.xFor(specTime());
  add(svg, "line", { id: "playhead", class: "svg-playhead", x1: playX, y1: 0, x2: playX, y2: H });
  add(svg, "line", { id: "hoverhead", class: "svg-hover", x1: -10, y1: 0, x2: -10, y2: H, opacity: 0 });
  updateViewUi();
}

function drawPhases(svg, L, plotW, H) {
  const phases = Array.isArray(state.data.overlayMeta?.phases) ? state.data.overlayMeta.phases : [];
  if (!refs.togglePhases.checked || phases.length === 0) return;
  for (const phase of phases) {
    if (typeof phase.t0 !== "number" || typeof phase.t1 !== "number") continue;
    if (!timeIntersects(phase.t0, phase.t1)) continue;
    const t0 = Math.max(phase.t0, state.timeline.viewStart);
    const t1 = Math.min(phase.t1, state.timeline.viewEnd);
    const x = state.timeline.xFor(t0);
    const w = state.timeline.xFor(t1) - x;
    add(svg, "rect", {
      x,
      y: 0,
      width: Math.max(0, w),
      height: H,
      fill: phase.color || "#1f6b73",
      opacity: 0.07,
    });
    if (w > 44) {
      add(svg, "text", { x: x + 5, y: 16, class: "svg-small" }, String(phase.name || ""));
    }
  }
}

function drawTimeRuler(svg, L, plotW, y, H) {
  add(svg, "line", { x1: L, y1: y, x2: L + plotW, y2: y, class: "svg-rule" });
  const step = chooseTickStep(state.timeline.visibleSpan);
  const first = Math.ceil(state.timeline.viewStart / step) * step;
  for (let t = first; t <= state.timeline.viewEnd + 1e-6; t += step) {
    const x = state.timeline.xFor(t);
    add(svg, "line", { x1: x, y1: y - 5, x2: x, y2: H - 12, stroke: "#efe5d2", "stroke-width": 1 });
    add(svg, "text", { x: x + 3, y: y - 8, class: "svg-small" }, formatTime(t));
  }
}

function drawSpectrogram(svg, L, plotW, y, h) {
  add(svg, "text", { x: 12, y: y + 17, class: "svg-label" }, "music");
  add(svg, "rect", { x: L, y, width: plotW, height: h, fill: "#2a251f", opacity: 0.95 });
  const spec = state.data.music?.spectrogram;
  const imageUrl = spec?.imageUrl;
  if (!imageUrl) {
    add(svg, "text", { x: L + 12, y: y + h / 2 + 4, fill: "#f5ead6", "font-size": 12 }, state.data.music ? "no spectrogram asset" : "no music linked");
    return;
  }
  const clipId = "spectrogram-clip";
  const defs = add(svg, "defs", {});
  const clip = add(defs, "clipPath", { id: clipId });
  add(clip, "rect", { x: L, y, width: plotW, height: h });
  const metaDuration = Number(spec.meta?.duration) || audioDurationForMusic(state.data.music) || state.data.spec.duration;
  const offset = musicOffset(state.data.music);
  const imageT0 = audioToSpecTime(0, offset);
  const imageT1 = audioToSpecTime(metaDuration, offset);
  add(svg, "image", {
    href: imageUrl,
    x: state.timeline.rawXFor(imageT0),
    y,
    width: Math.max(1, ((imageT1 - imageT0) / state.timeline.visibleSpan) * plotW),
    height: h,
    preserveAspectRatio: "none",
    opacity: 0.88,
    "clip-path": `url(#${clipId})`,
  });
}

function drawBeatLayer(svg, L, plotW, y, h, H) {
  if (!refs.toggleBeats.checked || !state.analysis) return;
  const duration = state.data.spec.duration;
  for (const t of state.analysis.beats) {
    if (t < 0 || t > duration || !timeVisible(t)) continue;
    const x = state.timeline.xFor(t);
    add(svg, "line", { x1: x, y1: y, x2: x, y2: y + h, stroke: "#fff7e3", "stroke-width": 0.6, opacity: 0.35 });
  }
  for (const t of state.analysis.downbeats) {
    if (t < 0 || t > duration || !timeVisible(t)) continue;
    const x = state.timeline.xFor(t);
    add(svg, "line", { x1: x, y1: y, x2: x, y2: H - 14, stroke: "#b57d1d", "stroke-width": 1, opacity: 0.34 });
  }
  const maxStrength = Math.max(1, ...state.analysis.onsets.map((event) => event.strength || 1));
  for (const event of state.analysis.onsets) {
    if (event.t < 0 || event.t > duration || !timeVisible(event.t)) continue;
    const x = state.timeline.xFor(event.t);
    const height = Math.max(4, Math.min(h, (event.strength / maxStrength) * h));
    add(svg, "rect", {
      x: x - 0.7,
      y: y + h - height,
      width: 1.4,
      height,
      fill: "#f6c85f",
      opacity: 0.34,
    });
  }
}

function drawContacts(svg, L, plotW, y, H) {
  for (const [index, contact] of state.data.contacts.entries()) {
    if (!timeVisible(contact.t)) continue;
    const x = state.timeline.xFor(contact.t);
    const strong = contact.impact !== null && contact.impact >= 0.45;
    add(svg, "line", {
      x1: x,
      y1: y - 3,
      x2: x,
      y2: H - 14,
      stroke: strong ? "#a8442f" : "#6d665b",
      "stroke-width": strong ? 1.3 : 0.8,
      opacity: strong ? 0.38 : 0.22,
    });
    if (index % 8 === 0) add(svg, "text", { x: x + 3, y: y - 7, class: "svg-small" }, String(index));
  }
}

function drawImpactLane(svg, L, plotW, y, h) {
  add(svg, "text", { x: 12, y: y + 18, class: "svg-label" }, "impact");
  add(svg, "line", { x1: L, y1: y + h - 8, x2: L + plotW, y2: y + h - 8, class: "svg-rule" });
  for (const [index, contact] of state.data.contacts.entries()) {
    if (!timeVisible(contact.t)) continue;
    const x = state.timeline.xFor(contact.t);
    const v = contact.impact ?? 0;
    const barH = Math.max(contact.impact === null ? 4 : 6, v * (h - 14));
    const active = state.activeNoteId === `contact:${index}`;
    const editable = Boolean(contact.edit?.editable);
    add(svg, "line", {
      x1: x,
      y1: y + h - 8,
      x2: x,
      y2: y + h - 8 - barH,
      stroke: contact.impact === null ? "#b8ab95" : impactColor(v),
      "stroke-width": 1.8,
      opacity: contact.impact === null ? 0.45 : 0.9,
    });
    add(svg, "circle", {
      cx: x,
      cy: y + h - 8 - barH,
      r: active ? 6.2 : contact.impact === null ? 2.2 : 2.8 + v * 2.8,
      fill: active ? "#a8442f" : contact.impact === null ? "#b8ab95" : impactColor(v),
      class: `svg-editable-impact${editable ? "" : " svg-readonly"}`,
      opacity: 0.95,
      "data-mark-kind": "contactImpact",
      "data-index": index,
      "data-lane-y": y,
      "data-lane-h": h,
    });
  }
}

function drawAxisLane(svg, axis, L, plotW, y, h) {
  const meta = AXIS_META[axis] || { label: axis, color: "#1f6b73" };
  add(svg, "text", { x: 12, y: y + 18, class: "svg-label" }, meta.label);
  add(svg, "rect", { x: L, y, width: plotW, height: h, fill: "#fff7e8", opacity: 0.72 });
  add(svg, "line", { x1: L, y1: y + h - 5, x2: L + plotW, y2: y + h - 5, class: "svg-rule" });
  add(svg, "line", { x1: L, y1: y + 5, x2: L + plotW, y2: y + 5, stroke: "#efe5d2", "stroke-width": 1 });
  const points = visibleAxisPoints(axis);
  const path = pathFromPoints(points, (t) => state.timeline.xFor(t), (v) => y + h - 5 - clamp(v, 0, 1) * (h - 10));
  add(svg, "path", {
    d: path,
    fill: "none",
    stroke: meta.color,
    "stroke-width": 2.2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  drawAxisKeyframes(svg, axis, y, h, meta.color);
}

function drawZoomLane(svg, L, plotW, y, h) {
  const zoom = cameraZoomData();
  if (!zoom) return;
  const meta = CAMERA_META.zoom;
  const range = cameraZoomRange();
  add(svg, "text", { x: 12, y: y + 18, class: "svg-label" }, meta.label);
  add(svg, "rect", { x: L, y, width: plotW, height: h, fill: "#f0f6f8", opacity: 0.86 });
  add(svg, "line", { x1: L, y1: y + h - 5, x2: L + plotW, y2: y + h - 5, class: "svg-rule" });
  add(svg, "line", { x1: L, y1: y + 5, x2: L + plotW, y2: y + 5, stroke: "#d6e3e7", "stroke-width": 1 });
  const points = visibleZoomPoints();
  const path = pathFromPoints(points, (t) => state.timeline.xFor(t), (v) => zoomY(v, y, h, range));
  add(svg, "path", {
    d: path,
    fill: "none",
    stroke: meta.color,
    "stroke-width": 2.2,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  drawZoomKeyframes(svg, y, h, meta.color, range);
  if (plotW > 130) {
    const smoothing = Number.isFinite(zoom.smoothingFrames) && zoom.smoothingFrames > 0
      ? ` sm ${zoom.smoothingFrames}f`
      : "";
    add(svg, "text", { x: L + plotW - 6, y: y + 18, class: "svg-small", "text-anchor": "end" }, `${fmt(range.min)}-${fmt(range.max)}${smoothing}`);
  }
}

function drawNoteLane(svg, L, plotW, y, h) {
  add(svg, "text", { x: 12, y: y + 18, class: "svg-label" }, "notes");
  add(svg, "line", { x1: L, y1: y + h / 2, x2: L + plotW, y2: y + h / 2, class: "svg-rule" });
  for (const note of state.notes) {
    if (note.scope === "range" && typeof note.t0 === "number" && typeof note.t1 === "number") {
      if (!timeIntersects(note.t0, note.t1)) continue;
      const x0 = state.timeline.xFor(Math.max(note.t0, state.timeline.viewStart));
      const x1 = state.timeline.xFor(Math.min(note.t1, state.timeline.viewEnd));
      add(svg, "rect", {
        x: x0,
        y: y + 8,
        width: Math.max(3, x1 - x0),
        height: h - 16,
        rx: 2,
        fill: note.id === state.activeNoteId ? "#a8442f" : "#2d5d8f",
        opacity: 0.78,
      });
      continue;
    }
    if (!timeVisible(note.t)) continue;
    const x = state.timeline.xFor(note.t);
    add(svg, "rect", {
      x: x - 3,
      y: y + 6,
      width: 6,
      height: h - 12,
      rx: 2,
      fill: note.id === state.activeNoteId ? "#a8442f" : "#2d5d8f",
      opacity: 0.88,
    });
  }
}

function drawSelection(svg, L, plotW, H) {
  const range = normalizedRange(state.selection);
  if (!range || !timeIntersects(range.t0, range.t1)) return;
  const x0 = state.timeline.xFor(Math.max(range.t0, state.timeline.viewStart));
  const x1 = state.timeline.xFor(Math.min(range.t1, state.timeline.viewEnd));
  add(svg, "rect", {
    x: x0,
    y: 0,
    width: Math.max(2, x1 - x0),
    height: H,
    class: "svg-selection",
  });
}

function drawAxisKeyframes(svg, axis, y, h, color) {
  const keyframes = (state.data.keyframes || []).filter((point) => point.axis === axis && timeVisible(point.t));
  for (const point of keyframes) {
    const x = state.timeline.xFor(point.t);
    const cy = y + h - 5 - clamp(point.v, 0, 1) * (h - 10);
    const active = state.activeNoteId === `keyframe:${point.axis}:${point.index}`;
    add(svg, "circle", {
      cx: x,
      cy,
      r: active ? 5.2 : 3.6,
      fill: active ? "#a8442f" : color,
      class: `svg-keyframe${point.edit?.editable ? "" : " svg-readonly"}`,
      opacity: active ? 1 : 0.92,
      "data-mark-kind": "axisKeyframe",
      "data-axis": point.axis,
      "data-index": point.index,
      "data-lane-y": y,
      "data-lane-h": h,
    });
  }
}

function drawZoomKeyframes(svg, y, h, color, range) {
  for (const point of cameraZoomKeyframes()) {
    if (!timeVisible(point.t)) continue;
    const x = state.timeline.xFor(point.t);
    const cy = zoomY(point.zoom, y, h, range);
    const active = state.activeNoteId === `keyframe:zoom:${point.index}`;
    add(svg, "circle", {
      cx: x,
      cy,
      r: active ? 5.2 : 3.8,
      fill: active ? "#a8442f" : color,
      class: `svg-keyframe svg-camera-keyframe${point.edit?.editable ? "" : " svg-readonly"}`,
      opacity: active ? 1 : 0.92,
      "data-mark-kind": "zoomKeyframe",
      "data-axis": "zoom",
      "data-index": point.index,
      "data-lane-y": y,
      "data-lane-h": h,
    });
  }
}

function visibleAxisPoints(axis) {
  const points = state.data?.axes?.[axis]?.points || [];
  if (!state.timeline || points.length === 0) return [];
  const out = [];
  const startV = axisAt(axis, state.timeline.viewStart);
  const endV = axisAt(axis, state.timeline.viewEnd);
  if (startV !== null) out.push([state.timeline.viewStart, startV]);
  for (const point of points) {
    if (point[0] > state.timeline.viewStart && point[0] < state.timeline.viewEnd) out.push(point);
  }
  if (endV !== null) out.push([state.timeline.viewEnd, endV]);
  return out;
}

function visibleZoomPoints() {
  const points = cameraZoomData()?.points || [];
  if (!state.timeline || points.length === 0) return [];
  const out = [];
  const startV = cameraZoomAt(state.timeline.viewStart);
  const endV = cameraZoomAt(state.timeline.viewEnd);
  if (startV !== null) out.push([state.timeline.viewStart, startV]);
  for (const point of points) {
    if (point[0] > state.timeline.viewStart && point[0] < state.timeline.viewEnd) out.push(point);
  }
  if (endV !== null) out.push([state.timeline.viewEnd, endV]);
  return out;
}

function pathFromPoints(points, xFor, yFor) {
  let d = "";
  let open = false;
  for (const [t, v] of points) {
    if (v === null) {
      open = false;
      continue;
    }
    const x = xFor(t);
    const y = yFor(v);
    d += open ? ` L ${x.toFixed(2)} ${y.toFixed(2)}` : ` M ${x.toFixed(2)} ${y.toFixed(2)}`;
    open = true;
  }
  return d;
}

function updatePlaybackUi() {
  if (!state.data) return;
  const t = specTime();
  state.cursorT = t;
  refs.timeNow.textContent = formatTime(t);
  refs.scrub.value = String(clamp(t / state.data.spec.duration, 0, 1));
  refs.play.textContent = isPlaying() ? "Pause" : "Play";
  const x = state.timeline?.xFor(t);
  if (x !== undefined) {
    const ph = document.getElementById("playhead");
    if (ph) {
      ph.setAttribute("x1", x);
      ph.setAttribute("x2", x);
    }
  }
  renderInspector();
}

function renderInspector() {
  const { data } = state;
  if (!data) return;
  const t = specTime();
  const contactHit = nearestContact(t);
  const gap = currentGap(t);
  const phase = currentPhase(t);
  const keyframeHit = nearestKeyframe(t);
  const zoomValue = cameraZoomAt(t);
  const zoomKeyframeHit = nearestCameraZoomKeyframe(t);
  refs.cursorTime.textContent = formatTime(t);
  refs.cursorGrid.innerHTML = [
    detail("contact", contactHit ? `#${contactHit.index} ${signed(contactHit.contact.t - t)}s` : "none"),
    detail("impact", contactHit?.contact.impact === null ? "untargeted" : fmt(contactHit?.contact.impact)),
    detail("gap", gap ? `#${gap.i} ${fmt(gap.duration)}s` : "none"),
    detail("phase", phase?.name || "none"),
    detail("keyframe", keyframeHit ? `${keyframeHit.point.axis} #${keyframeHit.point.index} ${signed(keyframeHit.point.t - t)}s` : "none"),
    detail("zoom", zoomValue === null ? "none" : fmt(zoomValue)),
    detail("zoom kf", zoomKeyframeHit ? `#${zoomKeyframeHit.point.index} ${signed(zoomKeyframeHit.point.t - t)}s` : "none"),
  ].join("");

  refs.axisReadouts.innerHTML = "";
  for (const axis of data.summary.activeAxes) {
    const value = axisAt(axis, t);
    const meta = AXIS_META[axis] || { label: axis, color: "#1f6b73" };
    const row = document.createElement("div");
    row.className = "axis-row";
    row.innerHTML = `
      <div class="label">${escapeHtml(meta.label)}</div>
      <div class="axis-track"><div class="axis-fill" style="background:${meta.color};width:${clamp(value ?? 0, 0, 1) * 100}%"></div></div>
      <div class="value">${value === null ? "-" : fmt(value)}</div>`;
    refs.axisReadouts.appendChild(row);
  }
  if (zoomValue !== null) {
    const range = cameraZoomRange();
    const meta = CAMERA_META.zoom;
    const row = document.createElement("div");
    const pct = clamp((zoomValue - range.min) / Math.max(1e-9, range.max - range.min), 0, 1) * 100;
    row.className = "axis-row";
    row.innerHTML = `
      <div class="label">${escapeHtml(meta.label)}</div>
      <div class="axis-track"><div class="axis-fill" style="background:${meta.color};width:${pct}%"></div></div>
      <div class="value">${fmt(zoomValue)}</div>`;
    refs.axisReadouts.appendChild(row);
  }
  renderAgentContext();
}

function detail(label, value) {
  return `<div class="detail"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value ?? "-"))}</div></div>`;
}

function renderEditAxisOptions() {
  refs.editAxis.innerHTML = "";
  const axes = state.data?.summary.activeAxes?.length ? state.data.summary.activeAxes : AXES;
  for (const axis of axes) {
    const opt = document.createElement("option");
    opt.value = axis;
    opt.textContent = axis;
    refs.editAxis.appendChild(opt);
  }
}

function renderEditor() {
  if (!state.data || !state.activeAnchor) return;
  const anchor = state.activeAnchor;
  const keyframe = anchor.scope === "keyframe" ? keyframeByAnchor(anchor) : null;
  const contact = anchor.scope === "contact" && typeof anchor.index === "number"
    ? state.data.contacts[anchor.index]
    : null;
  const edit = keyframe?.edit || contact?.edit || null;
  const editable = Boolean(edit?.editable);
  const isKeyframe = Boolean(keyframe);
  const isContact = Boolean(contact);
  const isZoom = keyframe?.axis === "zoom";

  refs.editorAnchor.textContent = anchor.title;
  refs.editTime.value = String(round(anchor.t ?? specTime(), 3));
  refs.editAxis.value = anchor.axis || keyframe?.axis || refs.editAxis.value || state.data.summary.activeAxes[0] || "";
  refs.editValue.value = keyframe ? String(round(keyframe.v, 3)) : "";
  refs.editEase.value = keyframe?.sourceEase || "";
  refs.editImpact.value = contact?.impact === null || contact?.impact === undefined ? "" : String(round(contact.impact, 3));
  if (isZoom) refs.editValue.removeAttribute("max");
  else refs.editValue.setAttribute("max", "1");

  refs.editAxis.disabled = true;
  refs.editValue.disabled = !(isKeyframe && editable);
  refs.editEase.disabled = !(isKeyframe && editable && !isZoom);
  refs.editImpact.disabled = !(isContact && editable);
  refs.editTime.disabled = !(isKeyframe && editable);
  refs.stageEdit.disabled = !editable;
  refs.editState.textContent = editable ? "editable" : (edit?.readOnlyReason || "select an editable keyframe or impact");
}

function renderEditsList() {
  refs.editList.innerHTML = "";
  refs.editList.hidden = true;
}

function renderHistoryControls() {
  const history = state.history;
  const undoLabel = history?.nextUndo?.label;
  const redoLabel = history?.nextRedo?.label;
  refs.undoEdit.disabled = !history?.canUndo;
  refs.redoEdit.disabled = !history?.canRedo;
  refs.undoEdit.title = undoLabel ? `Ctrl+Z - ${undoLabel}` : "Ctrl+Z";
  refs.redoEdit.title = redoLabel ? `Ctrl+Shift+Z / Ctrl+Y - ${redoLabel}` : "Ctrl+Shift+Z / Ctrl+Y";
}

function renderCalibration() {
  const cal = state.data?.calibration;
  const previousValue = refs.calibrationCandidate.value;
  refs.calibrationCandidate.innerHTML = "";
  refs.calibrationReport.innerHTML = "";
  refs.calibrationLogs.textContent = state.calibrationJob?.logs?.join("\n") || "";

  if (!cal?.available) {
    refs.calibrationState.textContent = "not configured";
    refs.calibrationSummary.textContent = "This spec has no calibration export.";
    refs.calibrationRun.disabled = true;
    refs.calibrationApply.disabled = true;
    refs.calibrationDisable.disabled = true;
    refs.calibrationCandidate.disabled = true;
    return;
  }

  const latest = cal.latestReport?.report || null;
  const ranked = Array.isArray(latest?.candidates) ? latest.candidates : [];
  const candidates = candidateOptions(cal, ranked);
  for (const candidate of candidates) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = candidateText(candidate, ranked);
    refs.calibrationCandidate.appendChild(option);
  }
  const activeSelected = cal.enabled && cal.selection?.selected ? cal.selection.selected : null;
  const latestBest = latest?.best?.id || ranked[0]?.id || null;
  const validIds = new Set(candidates.map((candidate) => candidate.id));
  refs.calibrationCandidate.value = validIds.has(activeSelected) ? activeSelected
    : validIds.has(latestBest) ? latestBest
    : validIds.has(previousValue) ? previousValue
    : "identity";

  const job = state.calibrationJob;
  const jobActive = job && (job.status === "queued" || job.status === "running");
  refs.calibrationRun.disabled = Boolean(jobActive);
  refs.calibrationApply.disabled = !refs.calibrationCandidate.value || Boolean(jobActive);
  refs.calibrationDisable.disabled = Boolean(jobActive) || !cal.enabled;
  refs.calibrationCandidate.disabled = Boolean(jobActive);
  refs.calibrationState.textContent = jobActive ? job.status : cal.enabled ? `enabled: ${cal.selection?.selected}` : "identity";
  refs.calibrationSummary.textContent = latest
    ? `latest ${latest.best?.label || latest.best?.id || "candidate"} score ${fmt(latest.best?.score)} (${signed(latest.best?.delta || 0)})`
    : "No calibration report yet.";
  renderCalibrationReport(latest, cal.latestReport?.path || null);
}

function candidateOptions(cal, ranked) {
  const map = new Map();
  for (const candidate of cal.candidates || []) map.set(candidate.id, candidate);
  for (const candidate of ranked || []) {
    if (!map.has(candidate.id)) {
      map.set(candidate.id, { id: candidate.id, label: candidate.label || candidate.id, description: candidate.description || null });
    }
  }
  if (!map.has("identity")) map.set("identity", { id: "identity", label: "identity", description: "No modifier." });
  return [...map.values()];
}

function candidateText(candidate, ranked) {
  const summary = ranked.find((row) => row.id === candidate.id);
  if (!summary) return candidate.label || candidate.id;
  return `${summary.rank}. ${candidate.label || candidate.id}  ${fmt(summary.score)} (${signed(summary.delta)})`;
}

function renderCalibrationReport(report, path) {
  if (!report) return;
  const rows = (Array.isArray(report.candidates) ? report.candidates : []).slice(0, 6);
  const tableRows = rows.map((row) => `
    <tr>
      <td>${escapeHtml(String(row.rank ?? ""))}</td>
      <td>${escapeHtml(row.label || row.id)}</td>
      <td>${fmt(row.score)}</td>
      <td>${signed(row.delta || 0)}</td>
      <td>${escapeHtml(`${row.passed ?? 0}/${row.total ?? 0}`)}</td>
      <td>${fmt(row.speed_error_mean)}</td>
      <td>${fmt(row.impact_error_mean)}</td>
      <td>${fmt(row.distortion?.mean_abs_delta)}</td>
    </tr>`).join("");
  const best = rows[0];
  const axisRows = (best?.axis_compare || []).map((axis) => `
    <tr>
      <td>${escapeHtml(axis.axis)}</td>
      <td>${fmt(axis.mean_abs_error_before)}</td>
      <td>${fmt(axis.mean_abs_error_after)}</td>
      <td>${signed(axis.target_shift_mean || 0)}</td>
      <td>${signed(axis.achieved_shift_mean || 0)}</td>
    </tr>`).join("");
  refs.calibrationReport.innerHTML = `
    <table class="calibration-table">
      <thead><tr><th>#</th><th>candidate</th><th>score</th><th>delta</th><th>pass</th><th>speed</th><th>impact</th><th>shift</th></tr></thead>
      <tbody>${tableRows || `<tr><td colspan="8">No candidates.</td></tr>`}</tbody>
    </table>
    <table class="calibration-table calibration-axis-table">
      <thead><tr><th>axis</th><th>err before</th><th>err after</th><th>target</th><th>achieved</th></tr></thead>
      <tbody>${axisRows || `<tr><td colspan="5">No axis detail.</td></tr>`}</tbody>
    </table>
    ${path ? `<a class="calibration-link" href="${escapeHtml(path)}" target="_blank" rel="noreferrer">open report JSON</a>` : ""}`;
}

async function runCalibration() {
  if (!state.data?.calibration?.available) return;
  const budget = Math.trunc(Number(refs.calibrationBudget.value));
  const seeds = refs.calibrationSeeds.value.trim();
  try {
    const res = await fetch("/api/spec-calibration/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, budget, seeds }),
    }).then(readJsonOk);
    state.calibrationJob = res.job;
    toast("Calibration started");
    renderCalibration();
    pollCalibrationJob();
  } catch (error) {
    toast(String(error));
  }
}

function pollCalibrationJob() {
  stopCalibrationPolling();
  if (!state.calibrationJob?.id) return;
  const tick = async () => {
    try {
      const res = await fetch(`/api/spec-calibration/jobs/${encodeURIComponent(state.calibrationJob.id)}`, { cache: "no-cache" }).then(readJsonOk);
      state.calibrationJob = res.job;
      renderCalibration();
      if (res.job.status === "queued" || res.job.status === "running") {
        state.calibrationPoll = setTimeout(tick, 1500);
      } else {
        await refreshCalibrationLatest();
        toast(res.job.status === "succeeded" ? "Calibration finished" : "Calibration failed");
      }
    } catch (error) {
      refs.calibrationState.textContent = "poll failed";
      refs.calibrationLogs.textContent += `\n${String(error)}`;
    }
  };
  state.calibrationPoll = setTimeout(tick, 500);
}

function stopCalibrationPolling() {
  if (state.calibrationPoll) clearTimeout(state.calibrationPoll);
  state.calibrationPoll = null;
}

async function refreshCalibrationLatest() {
  if (!state.data) return;
  const latest = await fetch(`/api/spec-calibration/latest?spec=${encodeURIComponent(state.data.spec.path)}`, { cache: "no-cache" }).then(readJsonOk);
  state.data.calibration.latestReport = latest.latest;
  renderCalibration();
}

async function applyCalibrationSelection() {
  if (!state.data?.calibration?.available) return;
  const selected = refs.calibrationCandidate.value || "identity";
  const latestPath = state.data.calibration.latestReport?.path || null;
  try {
    await fetch("/api/spec-calibration/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        spec: state.data.spec.path,
        selected,
        enabled: selected !== "identity",
        sourceReport: latestPath,
      }),
    }).then(readJsonOk);
    toast(selected === "identity" ? "Calibration set to identity" : "Calibration applied");
    await loadSpec(state.data.spec.path, false);
  } catch (error) {
    toast(String(error));
  }
}

async function disableCalibrationSelection() {
  if (!state.data?.calibration?.available) return;
  try {
    await fetch("/api/spec-calibration/selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, selected: state.data.calibration.selection?.selected || "identity", enabled: false }),
    }).then(readJsonOk);
    toast("Calibration disabled");
    await loadSpec(state.data.spec.path, false);
  } catch (error) {
    toast(String(error));
  }
}

function editDetail(edit) {
  if (edit.target === "keyframe") {
    return `${edit.axis || "axis"} #${edit.index ?? "-"} -> ${fmt(edit.value)}${edit.ease ? ` ${edit.ease}` : ""}`;
  }
  if (edit.target === "contact") {
    return `contact #${edit.index ?? "-"} impact ${fmt(edit.impact)}`;
  }
  if (edit.target === "range" && typeof edit.t0 === "number" && typeof edit.t1 === "number") {
    return `range ${formatTime(edit.t0)}-${formatTime(edit.t1)}`;
  }
  return edit.title || edit.target;
}

async function applyActiveEdit() {
  if (!state.data || !state.activeAnchor) return;
  const edit = buildApplyEdit();
  if (!edit) return;
  refs.editState.textContent = "applying";
  refs.stageEdit.disabled = true;
  const restore = {
    cursorT: typeof edit.t === "number" ? edit.t : specTime(),
    viewStart: state.viewStart,
    viewEnd: state.viewEnd,
    selectedScope: state.selectedScope,
  };
  try {
    const res = await fetch("/api/spec-apply-edit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, ...edit }),
    }).then(readJsonOk);
    state.history = res.history || state.history;
    renderHistoryControls();
    await loadSpec(state.data.spec.path, false, restore);
    toast("Applied edit");
  } catch (error) {
    renderEditor();
    toast(String(error));
  }
}

async function applyHistoryAction(action) {
  if (!state.data) return;
  const specPath = state.data.spec.path;
  const restore = {
    cursorT: specTime(),
    viewStart: state.viewStart,
    viewEnd: state.viewEnd,
    selectedScope: state.selectedScope,
  };
  refs.undoEdit.disabled = true;
  refs.redoEdit.disabled = true;
  try {
    await flushPendingNoteSave();
    const res = await fetch("/api/spec-history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: specPath, action }),
    }).then(readJsonOk);
    state.history = res.history || state.history;
    renderHistoryControls();
    if (!res.entry) {
      toast(action === "undo" ? "Nothing to undo" : "Nothing to redo");
      return;
    }
    await loadSpec(specPath, false, restore);
    toast(`${action === "undo" ? "Undid" : "Redid"} ${res.entry.label}`);
  } catch (error) {
    await refreshHistoryStatus();
    toast(String(error));
  }
}

async function refreshHistoryStatus() {
  if (!state.data) return;
  try {
    const res = await fetch(`/api/spec-history?spec=${encodeURIComponent(state.data.spec.path)}`, { cache: "no-cache" }).then(readJsonOk);
    state.history = res.history || null;
  } catch {
    state.history = null;
  }
  renderHistoryControls();
}

function buildApplyEdit() {
  const anchor = state.activeAnchor;
  if (!anchor) return null;
  const keyframe = anchor.scope === "keyframe" ? keyframeByAnchor(anchor) : null;
  const contact = anchor.scope === "contact" && typeof anchor.index === "number"
    ? state.data.contacts[anchor.index]
    : null;
  const edit = keyframe?.edit || contact?.edit || null;
  if (!edit?.editable) {
    toast(edit?.readOnlyReason || "Selection is not editable");
    return null;
  }
  if (edit.editKind === "axisKeyframe" || edit.editKind === "zoomKeyframe") {
    const value = Number(refs.editValue.value);
    const t = snapTime(Number(refs.editTime.value));
    return {
      id: edit.id,
      editKind: edit.editKind,
      t: Number.isFinite(t) ? round(t, 4) : anchor.t,
      value: Number.isFinite(value) ? value : null,
      ease: edit.editKind === "axisKeyframe" ? refs.editEase.value || null : null,
    };
  }
  if (edit.editKind === "contactImpact") {
    const impact = Number(refs.editImpact.value);
    return {
      id: edit.id,
      editKind: edit.editKind,
      impact: Number.isFinite(impact) ? clamp(impact, 0, 1) : null,
    };
  }
  return null;
}

function upsertLocalEdit(edit) {
  state.edits = state.edits.filter((item) => item.id !== edit.id);
  state.edits.push({
    ...edit,
    createdAt: edit.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  state.edits.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
}

async function clearStagedEdits() {
  if (!state.data) return;
  state.edits = [];
  renderEditsList();
  renderAgentContext();
  try {
    await fetch("/api/spec-edits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, clear: true }),
    }).then(readJsonOk);
    toast("Cleared edits");
  } catch (error) {
    toast(String(error));
  }
}

function selectAnchorAtCursor() {
  setActiveAnchor(anchorFor(state.selectedScope, specTime()));
}

function setActiveAnchor(anchor) {
  state.activeAnchor = anchor;
  state.activeNoteId = anchor.id;
  const note = state.notes.find((item) => item.id === anchor.id);
  state.activeTags = note?.tags ? [...note.tags] : [];
  refs.noteAnchor.textContent = anchor.title;
  refs.noteText.value = note?.text || "";
  renderTags();
  renderNotesList();
  renderEditor();
  renderTimeline();
  renderAgentContext();
}

function anchorFor(scope, t) {
  if (scope === "range") {
    const range = normalizedRange(state.selection) || normalizedRange({ t0: t - 0.5, t1: t + 0.5 });
    if (range) {
      const mid = round((range.t0 + range.t1) / 2, 4);
      return {
        id: `range:${Math.round(range.t0 * 1000)}:${Math.round(range.t1 * 1000)}`,
        t: mid,
        t0: range.t0,
        t1: range.t1,
        scope: "range",
        index: null,
        title: `range ${formatTime(range.t0)} to ${formatTime(range.t1)}`,
      };
    }
  }
  if (scope === "keyframe") {
    const hit = nearestKeyframe(t);
    if (hit) {
      const point = hit.point;
      return {
        id: `keyframe:${point.axis}:${point.index}`,
        t: point.t,
        scope: "keyframe",
        index: point.index,
        axis: point.axis,
        title: `keyframe ${point.axis} #${point.index} at ${formatTime(point.t)} - ${fmt(point.v)}${point.ease ? ` ${point.ease}` : ""}`,
      };
    }
  }
  if (scope === "contact") {
    const hit = nearestContact(t);
    if (hit) {
      return {
        id: `contact:${hit.index}`,
        t: hit.contact.t,
        scope: "contact",
        index: hit.index,
        title: `contact #${hit.index} at ${formatTime(hit.contact.t)} - impact ${hit.contact.impact === null ? "untargeted" : fmt(hit.contact.impact)}`,
      };
    }
  }
  if (scope === "gap") {
    const gap = currentGap(t);
    if (gap) {
      return {
        id: `gap:${gap.i}`,
        t: round((gap.t0 + gap.t1) / 2, 4),
        scope: "gap",
        index: gap.i,
        title: `gap #${gap.i} ${formatTime(gap.t0)} to ${formatTime(gap.t1)}`,
      };
    }
  }
  const momentT = round(t, 1);
  return {
    id: `moment:${Math.round(momentT * 1000)}`,
    t: momentT,
    scope: "moment",
    index: null,
    title: `moment ${formatTime(momentT)}`,
  };
}

function renderScopeTabs() {
  for (const button of refs.scopeTabs.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.scope === state.selectedScope);
  }
}

function renderTags() {
  refs.tagRow.innerHTML = "";
  for (const tag of NOTE_TAGS) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.tag = tag;
    button.textContent = tag;
    button.classList.toggle("on", state.activeTags.includes(tag));
    refs.tagRow.appendChild(button);
  }
}

function buildActiveNoteSnapshot() {
  if (!state.data || !state.activeAnchor) return null;
  return {
    ...state.activeAnchor,
    text: refs.noteText.value,
    tags: [...state.activeTags],
  };
}

function saveActiveNoteDebounced() {
  const note = buildActiveNoteSnapshot();
  if (!note) return;
  clearTimeout(state.saveTimer);
  state.pendingNoteSave = note;
  refs.saveState.textContent = "saving";
  upsertLocalNote(note);
  renderNotesList();
  renderTimeline();
  renderAgentContext();
  state.saveTimer = setTimeout(() => saveNoteSnapshot(note), 450);
}

async function flushPendingNoteSave() {
  if (!state.saveTimer && !state.pendingNoteSave) return;
  const note = state.pendingNoteSave;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  state.pendingNoteSave = null;
  if (note) await saveNoteSnapshot(note);
}

async function saveActiveNote() {
  const note = buildActiveNoteSnapshot();
  if (!note) return;
  await saveNoteSnapshot(note);
}

async function saveNoteSnapshot(note) {
  if (!state.data || !note) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  if (state.pendingNoteSave?.id === note.id) state.pendingNoteSave = null;
  upsertLocalNote(note);
  renderNotesList();
  renderTimeline();
  renderAgentContext();
  try {
    const res = await fetch("/api/spec-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, note }),
    }).then(readJsonOk);
    if (res.note) upsertLocalNote(res.note);
    else state.notes = state.notes.filter((item) => item.id !== note.id);
    refs.saveState.textContent = "saved " + new Date().toLocaleTimeString();
    renderNotesList();
    renderTimeline();
  } catch (error) {
    refs.saveState.textContent = "save failed";
    toast(String(error));
  }
}

async function deleteActiveNote() {
  if (!state.data || !state.activeNoteId) return;
  const id = state.activeNoteId;
  if (state.pendingNoteSave?.id === id) {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    state.pendingNoteSave = null;
  }
  state.notes = state.notes.filter((note) => note.id !== id);
  refs.noteText.value = "";
  state.activeTags = [];
  renderTags();
  renderNotesList();
  renderTimeline();
  renderAgentContext();
  try {
    const res = await fetch("/api/spec-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, id, note: null }),
    }).then(readJsonOk);
    state.history = res.history || state.history;
    renderHistoryControls();
    refs.saveState.textContent = "deleted";
  } catch (error) {
    refs.saveState.textContent = "delete failed";
    toast(String(error));
  }
}

async function clearAllNotes() {
  if (!state.data) return;
  if (!window.confirm(`Clear all notes for ${state.data.spec.label}?`)) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  state.pendingNoteSave = null;
  state.notes = [];
  refs.noteText.value = "";
  state.activeTags = [];
  renderTags();
  renderNotesList();
  renderTimeline();
  renderAgentContext();
  try {
    const res = await fetch("/api/spec-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, clear: true }),
    }).then(readJsonOk);
    state.notesPath = res.notesPath || state.notesPath;
    state.history = res.history || state.history;
    renderHistoryControls();
    refs.saveState.textContent = "cleared";
  } catch (error) {
    refs.saveState.textContent = "clear failed";
    toast(String(error));
  }
}

function upsertLocalNote(note) {
  const text = note.text || "";
  const tags = note.tags || [];
  state.notes = state.notes.filter((item) => item.id !== note.id);
  if (text.trim() || tags.length) {
    state.notes.push({
      id: note.id,
      t: note.t,
      scope: note.scope,
      index: note.index ?? null,
      t0: note.t0 ?? null,
      t1: note.t1 ?? null,
      axis: note.axis ?? null,
      title: note.title,
      text,
      tags,
      createdAt: note.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  state.notes.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
}

function renderNotesList() {
  refs.notePath.textContent = state.notesPath || "";
  refs.notesList.innerHTML = "";
  for (const note of state.notes) {
    const li = document.createElement("li");
    li.classList.toggle("active", note.id === state.activeNoteId);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.noteId = note.id;
    const timeLabel = note.scope === "range" && typeof note.t0 === "number" && typeof note.t1 === "number"
      ? `${formatTime(note.t0)}-${formatTime(note.t1)}`
      : formatTime(note.t);
    const scopeLabel = note.scope === "keyframe" && note.axis ? `${note.axis} keyframe` : note.scope;
    button.innerHTML = `
      <div class="note-line"><span>${escapeHtml(timeLabel)}</span><span>${escapeHtml(scopeLabel)}</span></div>
      <div class="note-text">${escapeHtml(note.text || note.tags.join(", "))}</div>`;
    li.appendChild(button);
    refs.notesList.appendChild(li);
  }
}

let lastAgentContextMs = 0;
function renderAgentContext() {
  if (!state.data) return;
  // This pane is a pretty-printed JSON debug dump. renderInspector calls it every
  // animation frame during playback; rebuilding the context and JSON.stringify-ing it
  // 60×/sec pins a core on dense specs and nobody reads it mid-scrub. Throttle to ~7Hz
  // while playing; paused/discrete updates always render immediately.
  if (state.simulatedPlaying || (hasAudio() && !refs.audio.paused)) {
    const now = performance.now();
    if (now - lastAgentContextMs < 140) return;
    lastAgentContextMs = now;
  }
  const t = specTime();
  const keyframeHit = nearestKeyframe(t);
  const zoomValue = cameraZoomAt(t);
  const zoomKeyframeHit = nearestCameraZoomKeyframe(t);
  const selection = normalizedRange(state.selection);
  const activeNote = state.notes.find((note) => note.id === state.activeNoteId) || (state.activeAnchor ? {
    ...state.activeAnchor,
    text: refs.noteText.value,
    tags: state.activeTags,
  } : null);
  const ctx = {
    spec: state.data.spec.path,
    at: {
      t: round(t, 3),
      time: formatTime(t),
      music: state.data.music ? {
        offset: musicOffset(state.data.music),
        audioTime: hasAudio() ? round(refs.audio.currentTime, 3) : null,
        specFromAudio: hasAudio() ? round(audioToSpecTime(refs.audio.currentTime, musicOffset(state.data.music)), 3) : null,
        clock: state.simulatedPlaying ? "spec" : hasAudio() && !refs.audio.paused ? "audio" : "paused",
      } : null,
      phase: currentPhase(t)?.name ?? null,
      contact: nearestContact(t)?.index ?? null,
      gap: currentGap(t)?.i ?? null,
      keyframe: keyframeHit ? {
        axis: keyframeHit.point.axis,
        index: keyframeHit.point.index,
        t: keyframeHit.point.t,
        value: keyframeHit.point.v,
        ease: keyframeHit.point.ease,
        dt: round(keyframeHit.point.t - t, 3),
      } : null,
      camera: zoomValue === null ? null : {
        zoom: zoomValue,
        nearestKeyframe: zoomKeyframeHit ? {
          index: zoomKeyframeHit.point.index,
          t: zoomKeyframeHit.point.t,
          value: zoomKeyframeHit.point.zoom,
          dt: round(zoomKeyframeHit.point.t - t, 3),
        } : null,
      },
      axes: Object.fromEntries(state.data.summary.activeAxes.map((axis) => [axis, axisAt(axis, t)])),
    },
    view: {
      t0: round(state.viewStart, 3),
      t1: round(state.viewEnd, 3),
      duration: round(state.viewEnd - state.viewStart, 3),
    },
    snap: {
      mode: state.snapMode,
    },
    selection: selection ? {
      t0: selection.t0,
      t1: selection.t1,
      duration: round(selection.t1 - selection.t0, 3),
    } : null,
    note: activeNote,
    stagedEdits: state.edits,
    nearbyContacts: state.data.contacts
      .map((contact, index) => ({ index, t: contact.t, dt: round(contact.t - t, 3), impact: contact.impact }))
      .filter((contact) => Math.abs(contact.dt) <= 2)
      .slice(0, 10),
  };
  refs.agentJson.textContent = JSON.stringify(ctx, null, 2);
}

function togglePlayback() {
  if (!state.data) return;
  if (isPlaying()) {
    pausePlayback();
    return;
  }
  if (hasAudio()) {
    const audioT = specToAudioTime(state.cursorT, musicOffset(state.data.music));
    if (audioTimeInRange(audioT, state.data.music)) {
      refs.audio.currentTime = audioT;
      refs.audio.play().catch((error) => toast(String(error)));
    } else {
      state.simulatedPlaying = true;
      updatePlaybackUi();
    }
  } else {
    state.simulatedPlaying = true;
    updatePlaybackUi();
  }
}

function pausePlayback() {
  state.simulatedPlaying = false;
  refs.audio.pause();
  updatePlaybackUi();
}

function isPlaying() {
  return state.simulatedPlaying || (hasAudio() ? !refs.audio.paused : false);
}

function hasAudio() {
  return Boolean(state.data?.music?.audioUrl && refs.audio.src);
}

function musicOffset(music = state.data?.music) {
  const offset = Number(music?.offset);
  return Number.isFinite(offset) ? offset : 0;
}

function audioToSpecTime(audioTime, offset = musicOffset()) {
  return audioTime + offset;
}

function specToAudioTime(specTimeValue, offset = musicOffset()) {
  return specTimeValue - offset;
}

function audioDurationForMusic(music = state.data?.music) {
  if (Number.isFinite(refs.audio.duration) && refs.audio.duration > 0) return refs.audio.duration;
  const metaDuration = Number(music?.spectrogram?.meta?.duration);
  return Number.isFinite(metaDuration) && metaDuration > 0 ? metaDuration : null;
}

function audioTimeInRange(audioTime, music = state.data?.music) {
  if (!Number.isFinite(audioTime) || audioTime < 0) return false;
  const duration = audioDurationForMusic(music);
  return duration === null || audioTime <= duration;
}

function specTime() {
  if (!state.data) return 0;
  const duration = state.data.spec.duration;
  if (hasAudio() && !refs.audio.paused && !refs.audio.ended) {
    return clamp(audioToSpecTime(refs.audio.currentTime, musicOffset(state.data.music)), 0, duration);
  }
  return clamp(state.cursorT, 0, duration);
}

function seekTo(t, opts = { select: true }) {
  if (!state.data) return;
  const wasPlaying = isPlaying();
  const next = clamp(t, 0, state.data.spec.duration);
  state.cursorT = next;
  if (hasAudio()) {
    const audioT = specToAudioTime(next, musicOffset(state.data.music));
    if (audioTimeInRange(audioT, state.data.music)) {
      state.simulatedPlaying = false;
      refs.audio.currentTime = audioT;
      if (wasPlaying && refs.audio.paused) refs.audio.play().catch((error) => toast(String(error)));
    } else {
      refs.audio.pause();
      state.simulatedPlaying = wasPlaying;
      refs.audio.currentTime = clamp(
        audioT,
        0,
        audioDurationForMusic(state.data.music) || Number.POSITIVE_INFINITY,
      );
    }
  }
  if (opts.resumeFollow !== false) resumeFollow();
  if (opts.reveal !== false) revealTime(next, { manual: false });
  updatePlaybackUi();
  if (opts.select) selectAnchorAtCursor();
}

function tick(now) {
  const dt = Math.max(0, (now - state.lastTickMs) / 1000);
  state.lastTickMs = now;
  if (state.data && state.simulatedPlaying) {
    state.cursorT += dt;
    if (state.cursorT >= state.data.spec.duration) {
      state.cursorT = state.data.spec.duration;
      state.simulatedPlaying = false;
    }
    if (state.simulatedPlaying && hasAudio()) {
      const audioT = specToAudioTime(state.cursorT, musicOffset(state.data.music));
      if (audioTimeInRange(audioT, state.data.music)) {
        state.simulatedPlaying = false;
        refs.audio.currentTime = audioT;
        refs.audio.play().catch((error) => toast(String(error)));
      }
    }
    followTime(state.cursorT);
    updatePlaybackUi();
  } else if (state.data && hasAudio() && !refs.audio.paused) {
    followTime(specTime());
    updatePlaybackUi();
  }
  requestAnimationFrame(tick);
}

function nearestContact(t) {
  if (!state.data?.contacts.length) return null;
  let best = null;
  for (const [index, contact] of state.data.contacts.entries()) {
    const distance = Math.abs(contact.t - t);
    if (!best || distance < best.distance) best = { contact, index, distance };
  }
  return best;
}

function currentGap(t) {
  const gaps = state.data?.gaps || [];
  for (const gap of gaps) {
    if (t >= gap.t0 && t <= gap.t1) return gap;
  }
  let best = null;
  for (const gap of gaps) {
    const mid = (gap.t0 + gap.t1) / 2;
    const distance = Math.abs(mid - t);
    if (!best || distance < best.distance) best = { gap, distance };
  }
  return best?.gap || null;
}

function currentPhase(t) {
  const phases = Array.isArray(state.data?.overlayMeta?.phases) ? state.data.overlayMeta.phases : [];
  return phases.find((phase) => typeof phase.t0 === "number" && typeof phase.t1 === "number" && t >= phase.t0 && t < phase.t1) || null;
}

function timeVisible(t) {
  if (!state.timeline) return true;
  return t >= state.timeline.viewStart && t <= state.timeline.viewEnd;
}

function timeIntersects(t0, t1) {
  if (!state.timeline) return true;
  return Math.max(t0, state.timeline.viewStart) <= Math.min(t1, state.timeline.viewEnd);
}

function normalizedRange(range) {
  if (!state.data || !range) return null;
  const t0 = Number(range.t0);
  const t1 = Number(range.t1);
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  const start = clamp(Math.min(t0, t1), 0, state.data.spec.duration);
  const end = clamp(Math.max(t0, t1), 0, state.data.spec.duration);
  return end > start ? { t0: round(start, 4), t1: round(end, 4) } : null;
}

function nearestKeyframe(t) {
  const points = state.data?.keyframes || [];
  let best = null;
  for (const point of points) {
    const distance = Math.abs(point.t - t);
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best;
}

function keyframeByAnchor(anchor) {
  if (anchor.axis === "zoom") {
    const point = cameraZoomKeyframes().find((point) => point.index === anchor.index);
    return point ? {
      ...point,
      axis: "zoom",
      v: point.zoom,
      ease: null,
      sourceEase: null,
    } : null;
  }
  return (state.data?.keyframes || []).find((point) =>
    point.axis === anchor.axis && point.index === anchor.index
  ) || null;
}

function axisAt(axis, t) {
  const points = state.data?.axes?.[axis]?.points;
  if (!points?.length) return null;
  let prev = null;
  for (const point of points) {
    if (point[1] === null) continue;
    if (point[0] >= t) {
      if (!prev) return point[1];
      const u = (t - prev[0]) / Math.max(1e-9, point[0] - prev[0]);
      return round(prev[1] + (point[1] - prev[1]) * clamp(u, 0, 1), 4);
    }
    prev = point;
  }
  return prev ? prev[1] : null;
}

function cameraZoomData() {
  return state.data?.camera?.zoom || null;
}

function cameraZoomKeyframes() {
  return cameraZoomData()?.keyframes || [];
}

function cameraZoomRange() {
  const zoom = cameraZoomData();
  const values = [
    Number(zoom?.min),
    Number(zoom?.max),
    ...cameraZoomKeyframes().map((point) => Number(point.zoom)),
  ].filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max: max > min ? max : min + Math.max(0.01, min * 0.02) };
}

function zoomY(value, y, h, range = cameraZoomRange()) {
  const span = Math.max(1e-9, range.max - range.min);
  const u = clamp((value - range.min) / span, 0, 1);
  return y + h - 5 - u * (h - 10);
}

function cameraZoomAt(t) {
  const points = cameraZoomData()?.points;
  if (!points?.length) return null;
  let prev = null;
  for (const point of points) {
    if (point[1] === null) continue;
    if (point[0] >= t) {
      if (!prev) return point[1];
      const u = (t - prev[0]) / Math.max(1e-9, point[0] - prev[0]);
      return round(prev[1] + (point[1] - prev[1]) * clamp(u, 0, 1), 4);
    }
    prev = point;
  }
  return prev ? prev[1] : null;
}

function nearestCameraZoomKeyframe(t) {
  let best = null;
  for (const point of cameraZoomKeyframes()) {
    const distance = Math.abs(point.t - t);
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best;
}

function setHover(x) {
  const hover = document.getElementById("hoverhead");
  if (!hover) return;
  if (x == null) {
    hover.setAttribute("opacity", "0");
    return;
  }
  hover.setAttribute("x1", x);
  hover.setAttribute("x2", x);
  hover.setAttribute("opacity", "1");
}

function svgXAtClient(svg, clientX, fallbackWidth) {
  return svgPointAtClient(svg, clientX, svg.getBoundingClientRect().top, fallbackWidth, 1).x;
}

function svgYAtClient(svg, clientY, fallbackHeight) {
  return svgPointAtClient(svg, svg.getBoundingClientRect().left, clientY, 1, fallbackHeight).y;
}

function svgPointAtClient(svg, clientX, clientY, fallbackWidth, fallbackHeight) {
  const ctm = svg.getScreenCTM?.();
  if (ctm) {
    return new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  }
  const rect = svg.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * fallbackWidth,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * fallbackHeight,
  };
}

function add(parent, tag, attrs = {}, text = null) {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  if (text !== null) el.textContent = text;
  parent.appendChild(el);
  return el;
}

function chooseTickStep(duration) {
  if (duration <= 2) return 0.25;
  if (duration <= 5) return 0.5;
  if (duration <= 15) return 1;
  if (duration <= 40) return 2;
  if (duration <= 90) return 5;
  if (duration <= 180) return 10;
  return 20;
}

function impactColor(value) {
  const v = clamp(value, 0, 1);
  if (v < 0.5) return mix("#1f6b73", "#b57d1d", v / 0.5);
  return mix("#b57d1d", "#a8442f", (v - 0.5) / 0.5);
}

function mix(a, b, t) {
  const ca = hex(a);
  const cb = hex(b);
  const out = ca.map((value, index) => Math.round(value + (cb[index] - value) * t));
  return `rgb(${out[0]},${out[1]},${out[2]})`;
}

function hex(value) {
  return [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
}

function formatTime(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function fmt(value) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "-";
}

function signed(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function toast(message) {
  refs.toast.textContent = message;
  refs.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    refs.toast.hidden = true;
  }, 2200);
}

function showFatal(error) {
  document.body.innerHTML = `<pre class="empty-state">${escapeHtml(String(error?.stack || error))}</pre>`;
}
