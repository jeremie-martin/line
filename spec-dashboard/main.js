import { createMusic, displayTime } from "../shared/playback.js";
import { sourceEvents, vocalFrame } from "./music-evidence.js";

const NS = "http://www.w3.org/2000/svg";

const AXES = ["air", "speed", "amplitude", "impact"];
const AXIS_META = {
  air: { label: "air", color: "#1f6b73" },
  speed: { label: "speed", color: "#a8442f" },
  amplitude: { label: "amplitude", color: "#b57d1d" },
  impact: { label: "impact", color: "#a8442f" },
};
const NOTE_TAGS = ["mark", "strong", "voice", "sync", "impact", "zoom", "speed", "air", "amplitude", "music", "flat", "too much"];

const refs = {
  picker: document.getElementById("spec-picker"),
  pickerMark: document.getElementById("picker-mark"),
  pickerLabel: document.getElementById("picker-label"),
  pickerReading: document.getElementById("picker-reading"),
  pickerPanel: document.getElementById("picker-panel"),
  pickerList: document.getElementById("picker-list"),
  setSwitch: document.getElementById("set-switch"),
  reviewSummary: document.getElementById("review-summary"),
  verdict: document.getElementById("verdict"),
  verdictChanged: document.getElementById("verdict-changed"),
  changes: document.getElementById("changes"),
  changesToggle: document.getElementById("changes-toggle"),
  changesPanel: document.getElementById("changes-panel"),
  reload: document.getElementById("reload-spec"),
  subtitle: document.getElementById("spec-subtitle"),
  play: document.getElementById("play"),
  timeNow: document.getElementById("time-now"),
  timeTotal: document.getElementById("time-total"),
  scrub: document.getElementById("scrub"),
  musicMeta: document.getElementById("music-meta"),
  summary: document.getElementById("summary-row"),
  timeline: document.getElementById("timeline"),
  timelineWrap: document.getElementById("timeline-wrap"),
  rangeBar: document.getElementById("range-bar"),
  rangeLength: document.getElementById("range-length"),
  rangeLoop: document.getElementById("range-loop"),
  rangeNote: document.getElementById("range-note"),
  rangeClear: document.getElementById("range-clear"),
  help: document.getElementById("help"),
  helpToggle: document.getElementById("help-toggle"),
  helpPanel: document.getElementById("help-panel"),
  evidenceWarning: document.getElementById("evidence-warning"),
  zoomOut: document.getElementById("zoom-out"),
  zoomIn: document.getElementById("zoom-in"),
  zoomSelection: document.getElementById("zoom-selection"),
  zoomReset: document.getElementById("zoom-reset"),
  followPlayhead: document.getElementById("follow-playhead"),
  viewWindow: document.getElementById("view-window"),
  snapMode: document.getElementById("snap-mode"),
  snapSelection: document.getElementById("snap-selection"),
  toggleBeats: document.getElementById("toggle-beats"),
  toggleClicks: document.getElementById("toggle-clicks"),
  clickVolume: document.getElementById("click-volume"),
  toggleMusic: document.getElementById("toggle-music"),
  musicVolume: document.getElementById("music-volume"),
  togglePhases: document.getElementById("toggle-phases"),
  toggleNotes: document.getElementById("toggle-notes"),
  cursorTime: document.getElementById("cursor-time"),
  cursorSummary: document.getElementById("cursor-summary"),
  cursorDetails: document.getElementById("cursor-details"),
  cursorGrid: document.getElementById("cursor-grid"),
  axisReadouts: document.getElementById("axis-readouts"),
  scopeTabs: document.getElementById("scope-tabs"),
  noteAnchor: document.getElementById("note-anchor"),
  notesTitle: document.getElementById("notes-title"),
  noteText: document.getElementById("note-text"),
  tagRow: document.getElementById("tag-row"),
  saveState: document.getElementById("save-state"),
  deleteNote: document.getElementById("delete-note"),
  clearNotes: document.getElementById("clear-notes"),
  notesList: document.getElementById("notes-list"),
  toast: document.getElementById("toast"),
  hear: document.getElementById("hear"),
  toggleVideo: document.getElementById("toggle-video"),
  video: document.getElementById("video-player"),
  videoState: document.getElementById("video-state"),
  makeVideo: document.getElementById("make-video"),
  watchLoop: document.getElementById("watch-loop"),
  loopFromStart: document.getElementById("loop-from-start"),
  notesMarks: document.getElementById("notes-marks"),
  earlierToggle: document.getElementById("earlier-toggle"),
  toggleEarlier: document.getElementById("toggle-earlier"),
  earlierLabel: document.getElementById("earlier-label"),
  earlierRef: document.getElementById("earlier-ref"),
  earlierHead: document.getElementById("earlier-head"),
  earlierText: document.getElementById("earlier-text"),
  noteAgain: document.getElementById("note-again"),
};

const state = {
  /** Every reading (a spec file) with where the owner stands on it, as /api/spec-review reports them. */
  readings: [],
  /** The group the menu shows: "production" (the songs short_*) or "library". */
  set: "production",
  /** The spec being loaded, until its view arrives. */
  loadingPath: null,
  data: null,
  notes: [],
  notesPath: null,
  analysis: null,
  timeline: null,
  cursorT: 0,
  playbackRate: 1,
  viewStart: 0,
  viewEnd: 0,
  /** The selected range {t0, t1}, or null. */
  selection: null,
  /** Playback loops over the selected range. */
  looping: false,
  pointerDrag: null,
  snapMode: "beat",
  selectedScope: "moment",
  activeAnchor: null,
  activeNoteId: null,
  /** A note on an earlier version, selected to read: quoted, never edited (the server keeps it as it is). */
  earlierNote: null,
  activeTags: [],
  saveTimer: null,
  pendingNoteSave: null,
  followPlayhead: true,
  followSuspended: false,
  /** What is heard: "mix" or one of the song's stems (music.stems). */
  stem: "mix",
  /** The spec's video and the video job, as /api/spec-video reports them. */
  video: null,
  videoJob: null,
  /** "Watch the loop": the video plays by itself, with its own sound, looping; the dashboard's clock follows it. */
  loopMode: false,
};

// A newer spec's music supersedes an older one still downloading, and a play
// still waiting on the audio context counts as playing for the controls (toggle,
// seek, rate): both are tracked by the shared music (music.load, music.requested).
const music = createMusic(), onScreen = displayTime();
/** Landing clicks: scheduled oscillators, how far ahead they are scheduled, and their gain. */
const clicks = { until: -Infinity, pending: new Set(), out: null };

// Listening preferences (clicks on/off, click and music volume, music muted), whether the video is shown and whether
// notes on earlier versions are shown survive reloads in this browser; storage may be unavailable, and then the defaults apply.
const LISTENING_KEY = "spec-dashboard.listening";
const listening = { clicks: true, clickVolume: 0.8, musicVolume: 1, musicMuted: false, videoOpen: true, earlierNotes: false };
try {
  Object.assign(listening, JSON.parse(localStorage.getItem(LISTENING_KEY) || "{}"));
} catch { /* defaults */ }
function setListening(change) {
  Object.assign(listening, change);
  try {
    localStorage.setItem(LISTENING_KEY, JSON.stringify(listening));
  } catch { /* not remembered */ }
  renderListening();
}
function renderListening() {
  refs.toggleClicks.classList.toggle("on", listening.clicks);
  refs.toggleClicks.setAttribute("aria-pressed", String(listening.clicks));
  refs.toggleClicks.firstChild.textContent = listening.clicks ? "Clicks on " : "Clicks off ";
  refs.clickVolume.value = listening.clickVolume;
  refs.toggleMusic.classList.toggle("on", !listening.musicMuted);
  refs.toggleMusic.setAttribute("aria-pressed", String(!listening.musicMuted));
  refs.toggleMusic.textContent = listening.musicMuted ? "Music muted" : "Music on";
  refs.musicVolume.value = listening.musicVolume;
  music.volume = listening.musicMuted ? 0 : listening.musicVolume;
  refs.video.volume = music.volume;
  refs.toggleEarlier.checked = listening.earlierNotes;
  if (clicks.out) clicks.out.gain.value = listening.clicks ? listening.clickVolume : 0;
  if (!listening.clicks) clearClicks();
  refs.video.hidden = !state.video || !listening.videoOpen;
  refs.toggleVideo.textContent = listening.videoOpen ? "Hide" : "Show";
  refs.toggleVideo.setAttribute("aria-expanded", String(listening.videoOpen));
  if (!listening.videoOpen) {
    if (state.loopMode) leaveLoop();
    refs.video.pause();
  } else syncVideo();
}
// The menu's group (production set or library) is remembered in this browser.
const SET_KEY = "spec-dashboard.set";
try {
  if (localStorage.getItem(SET_KEY) === "library") state.set = "library";
} catch { /* the production set */ }
const RATE_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

init().catch((error) => showFatal(error));

async function init() {
  wireEvents();
  await loadSpecList();
  requestAnimationFrame(tick);
}

function wireEvents() {
  const rate = document.getElementById("listening-rate");
  const setRate = (value) => {
    const t = specTime(), playing = music.requested;
    state.playbackRate = Math.max(.2, Math.min(2, Number(value)));
    rate.value = state.playbackRate;
    document.getElementById("listening-rate-value").textContent = `${Number(state.playbackRate.toFixed(2))}×`;
    if (playing) startPlayback(t);
  };
  /** The next usual speed step up (`dir` 1) or down (-1) from the current speed. */
  const stepRate = (dir) => {
    const current = state.playbackRate;
    const next = dir > 0 ? RATE_STEPS.find((r) => r > current + 1e-6) : RATE_STEPS.findLast((r) => r < current - 1e-6);
    if (next !== undefined) setRate(next);
  };
  rate.addEventListener("input", () => setRate(rate.value));
  document.getElementById("listening-rate-reset").onclick = () => setRate(1);
  for (const button of document.querySelectorAll("[data-quick-mark]")) {
    button.onclick = () => quickMark(button.dataset.quickMark);
  }
  renderListening();
  refs.toggleClicks.addEventListener("click", () => setListening({ clicks: !listening.clicks }));
  refs.clickVolume.addEventListener("input", () => setListening({ clickVolume: Number(refs.clickVolume.value), clicks: true }));
  refs.toggleMusic.addEventListener("click", () => setListening({ musicMuted: !listening.musicMuted }));
  refs.musicVolume.addEventListener("input", () => setListening({ musicVolume: Number(refs.musicVolume.value), musicMuted: false }));
  refs.hear.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-hear]");
    if (button && !button.disabled) hear(button.dataset.hear);
  });
  refs.toggleVideo.addEventListener("click", () => setListening({ videoOpen: !listening.videoOpen }));
  refs.makeVideo.addEventListener("click", () => makeVideo());
  refs.watchLoop.addEventListener("click", () => state.loopMode ? leaveLoop() : watchLoop());
  refs.loopFromStart.addEventListener("click", () => watchLoop(true));
  refs.toggleEarlier.addEventListener("change", () => {
    setListening({ earlierNotes: refs.toggleEarlier.checked });
    renderNotesList();
    renderTimeline();
  });
  refs.noteAgain.addEventListener("click", () => noteAgain());
  for (const type of ["loadedmetadata", "seeked"]) refs.video.addEventListener(type, () => syncVideo());
  refs.picker.addEventListener("click", () => openPicker(refs.pickerPanel.hidden));
  refs.pickerList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-path]");
    if (!button) return;
    openPicker(false);
    if (button.dataset.path !== currentPath()) loadSpec(button.dataset.path, true);
  });
  refs.setSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-set]");
    if (!button) return;
    state.set = button.dataset.set;
    try {
      localStorage.setItem(SET_KEY, state.set);
    } catch { /* not remembered */ }
    renderReview();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!refs.pickerPanel.hidden && !event.target.closest(".picker")) openPicker(false);
    if (!refs.helpPanel.hidden && !event.target.closest(".help")) openHelp(false);
    if (!refs.changesPanel.hidden && !event.target.closest(".changes")) openChanges(false);
  });
  refs.changesToggle.addEventListener("click", () => openChanges(refs.changesPanel.hidden));
  refs.changesPanel.addEventListener("click", (event) => {
    const point = event.target.closest("button[data-from]");
    if (!point) return;
    openChanges(false);
    selectChange({ from: Number(point.dataset.from), to: point.dataset.to === "" ? null : Number(point.dataset.to) });
  });
  refs.verdict.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-verdict]");
    if (button) setVerdict(button.dataset.verdict);
  });
  // A spec edited in another window shows as changed when the dashboard is back in front.
  window.addEventListener("focus", () => loadReadings());
  refs.reload.addEventListener("click", () => {
    loadReadings();
    loadSpec(currentPath(), false, {
      cursorT: specTime(),
      viewStart: state.viewStart,
      viewEnd: state.viewEnd,
      selectedScope: state.selectedScope,
    });
  });
  refs.play.addEventListener("click", togglePlayback);
  refs.scrub.addEventListener("input", () => {
    if (!state.data) return;
    seekTo(Number(refs.scrub.value) * state.data.spec.duration);
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
  refs.timeline.addEventListener("mouseleave", () => {
    if (!state.pointerDrag) setHover(null);
    showNoteCard(null);
  });
  // The timeline is drawn at the size it is shown: redrawn when its space changes.
  new ResizeObserver(() => {
    cancelAnimationFrame(renderTimeline.resize);
    renderTimeline.resize = requestAnimationFrame(() => renderTimeline());
  }).observe(refs.timelineWrap);
  refs.rangeLoop.addEventListener("click", () => toggleLoop());
  refs.rangeNote.addEventListener("click", () => noteSelection());
  refs.rangeClear.addEventListener("click", () => clearTransientSelection());
  refs.helpToggle.addEventListener("click", () => openHelp(refs.helpPanel.hidden));
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
  refs.notesList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-note-index]");
    if (!button) return;
    const note = state.notes[Number(button.dataset.noteIndex)];
    if (!note) return;
    if (!note.current) return selectEarlierNote(note);
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
  refs.cursorDetails.addEventListener("toggle", () => renderInspector());
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (isEditableElement(document.activeElement) || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.defaultPrevented) return;
    // Auto-repeat would add duplicate marks or toggle playback repeatedly; held arrows keep seeking.
    const mark = {m: "mark", s: "strong", v: "voice", i: "impact"}[key];
    if (mark) {
      event.preventDefault();
      if (!event.repeat) quickMark(mark);
      return;
    }
    // 1 2 3 give a verdict, by the key's character or its place on the top row (layouts that shift digits)
    const verdict = VERDICT_KEYS[event.key] ?? VERDICT_KEYS[event.code];
    if (verdict) {
      event.preventDefault();
      if (!event.repeat) setVerdict(verdict);
      return;
    }
    if (key === "n" || key === "p" || key === "u") {
      event.preventDefault();
      if (!event.repeat) goToReading(key === "u" ? "review" : key === "n" ? 1 : -1);
      return;
    }
    if (event.key === "Escape" && !refs.pickerPanel.hidden) {
      openPicker(false);
      refs.picker.focus();
      return;
    }
    if (event.key === "Escape" && !refs.helpPanel.hidden) {
      openHelp(false);
      return;
    }
    if (event.key === "Escape" && !refs.changesPanel.hidden) {
      openChanges(false);
      return;
    }
    if (event.key === "Escape" && state.pointerDrag) {
      event.preventDefault();
      cancelTimelineDrag(state.pointerDrag);
      return;
    }
    if (event.key === "Escape" && (state.selection || state.looping)) {
      event.preventDefault();
      clearTransientSelection();
      return;
    }
    if (key === "l") {
      event.preventDefault();
      if (!event.repeat) toggleLoop();
      return;
    }
    // Keys a focused control handles itself (a button's Space, a slider's arrows) are
    // taken over, so the shortcuts work wherever the focus was left.
    const seek = { ArrowLeft: -1, ArrowRight: 1, ",": -0.1, ".": 0.1 }[event.key];
    if (event.key === " ") {
      event.preventDefault();
      if (!event.repeat) togglePlayback();
    } else if (seek !== undefined) {
      event.preventDefault();
      seekTo(specTime() + seek * (event.shiftKey && event.key.startsWith("Arrow") ? 5 : 1));
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      seekTo(event.key === "Home" ? 0 : state.data?.spec.duration ?? 0);
    } else if (event.key === "<" || event.key === ">") {
      event.preventDefault();
      stepRate(event.key === ">" ? 1 : -1);
    } else if (key === "c") {
      event.preventDefault();
      if (!event.repeat) setListening({ clicks: !listening.clicks });
    }
  });
}

async function loadSpecList() {
  await loadReadings({ strict: true });
  // A reading opened by its address opens whichever group the menu shows.
  const requested = state.readings.find((reading) => reading.path === new URLSearchParams(location.search).get("spec"));
  const first = requested || shownReadings()[0] || state.readings[0];
  if (!first) throw new Error("no specs found");
  await loadSpec(first.path, !requested);
}

// The menu: the readings of the production set (or the library), and where the owner stands on each:
// his verdict (scripts/gallery/spec_review_api.ts), whether its song has notes of his, whether it has a video.
const VERDICTS = { love: "Love", good: "Good", "needs-work": "Needs work" };
const VERDICT_KEYS = { 1: "love", 2: "good", 3: "needs-work", Digit1: "love", Digit2: "good", Digit3: "needs-work" };

async function loadReadings({ strict = false } = {}) {
  try {
    const body = await fetch("/api/spec-review", { cache: "no-cache" }).then(readJsonOk);
    state.readings = body.readings || [];
    renderReview();
  } catch (error) {
    if (strict) throw error;
  }
}

const shownReadings = () => state.readings.filter((reading) => reading.set === state.set);
const currentPath = () => state.data?.spec.path ?? state.loadingPath ?? new URLSearchParams(location.search).get("spec");
const currentReading = () => state.readings.find((reading) => reading.path === currentPath());
/** "none", "changed" (a verdict given before the spec last changed), or the verdict. */
const reviewOf = (reading) => !reading?.verdict ? "none" : reading.changed ? "changed" : reading.verdict;
const markClass = (reading) => ["mark", reading?.verdict, reading?.changed && "changed"].filter(Boolean).join(" ");
const REVIEW_WORDS = { none: "not reviewed", changed: "changed since your verdict", love: "love", good: "good", "needs-work": "needs work" };
const multiple = (reading) => state.readings.some((other) => other.song === reading.song && other.path !== reading.path);
const songLabel = (reading) => [reading.title, reading.artist].filter(Boolean).join(" · ");
/** "Believer · Imagine Dragons", then the reading's name when the song has more than one. */
const readingLabel = (reading) => multiple(reading) ? `${songLabel(reading)} — ${reading.reading}` : songLabel(reading);

function openPicker(open) {
  refs.pickerPanel.hidden = !open;
  refs.picker.setAttribute("aria-expanded", String(open));
  if (open) {
    refs.pickerList.querySelector(".reading.current")?.scrollIntoView({ block: "nearest" });
    loadReadings();
  }
}

/** The "?" panel: keys, the spec's figures, the music and what the vocal evidence is. */
function openHelp(open) {
  refs.helpPanel.hidden = !open;
  refs.helpToggle.setAttribute("aria-expanded", String(open));
  refs.helpToggle.classList.toggle("on", open);
}

function renderReview() {
  const shown = shownReadings(), current = currentReading();
  const reviewed = shown.filter((reading) => reading.verdict && !reading.changed).length;
  const changed = shown.filter((reading) => reading.changed).length;
  refs.reviewSummary.textContent = `${reviewed} of ${shown.length} readings reviewed${changed ? ` · ${changed} changed` : ""}`;
  refs.reviewSummary.title = `In the ${state.set === "production" ? "production set" : "library"}. U goes to the next one to review.`;
  refs.pickerLabel.textContent = current ? songLabel(current) : currentPath() ?? "";
  refs.pickerReading.textContent = current && multiple(current) ? current.reading : "";
  refs.pickerMark.className = markClass(current);
  for (const button of refs.setSwitch.querySelectorAll("button[data-set]")) {
    button.classList.toggle("active", button.dataset.set === state.set);
  }
  const songs = new Map();
  for (const reading of shown) songs.set(reading.song, [...(songs.get(reading.song) ?? []), reading]);
  refs.pickerList.innerHTML = [...songs.values()].map((readings) => {
    const [main] = readings, here = readings.some((reading) => reading.path === current?.path);
    const chips = readings.map((reading) => {
      const video = reading.video === "current" ? "a video of this version" : reading.video === "old" ? "a video of an earlier version" : "no video";
      const title = `${reading.reading}: ${REVIEW_WORDS[reviewOf(reading)]}, ${video}`;
      return `<button type="button" class="reading${reading.path === current?.path ? " current" : ""}" data-path="${escapeHtml(reading.path)}" title="${escapeHtml(title)}">`
        + `<span class="${markClass(reading)}"></span>${escapeHtml(reading.reading)}`
        + `<span class="video-mark ${reading.video ?? "none"}">&#9654;</span></button>`;
    }).join("");
    const notes = main.notes ? `<span class="notes-count" title="Your notes on this song">${main.notes} note${main.notes === 1 ? "" : "s"}</span>` : "";
    return `<li class="song-row${here ? " current" : ""}"><button type="button" class="song-name" data-path="${escapeHtml(main.path)}">`
      + `<b>${escapeHtml(main.title)}</b>${main.artist ? ` <span>${escapeHtml(main.artist)}</span>` : ""}</button>`
      + `${notes}<span class="readings">${chips}</span></li>`;
  }).join("");
  renderVerdict();
}

// His free words on the reading as a whole: shown for the current reading, saved a moment after he stops writing and when he
// leaves the field (scripts/gallery/spec_review_api.ts keeps them with his verdict, and the version they were written on).
// Words written on an earlier version are quoted above the field, read only, one line each (a click shows all of it); the
// field holds only his words on the version as it stands.
const readingNote = { field: document.getElementById("reading-note"), state: document.getElementById("reading-note-state"),
  earlier: document.getElementById("earlier-words"), timer: 0, path: null };
function renderReadingNote() {
  const reading = currentReading(), earlier = reading?.earlierNotes ?? [];
  readingNote.field.disabled = !reading;
  if (reading && (readingNote.path !== reading.path || document.activeElement !== readingNote.field)) {
    readingNote.path = reading.path; readingNote.field.value = reading.note ?? ""; readingNote.state.textContent = "";
  }
  readingNote.earlier.hidden = !earlier.length;
  readingNote.earlier.innerHTML = earlier.map((words) => `<li title="${escapeHtml(words.note.trim())}">`
    + `<span class="earlier-words-when">Earlier, ${escapeHtml(noteDate({ updatedAt: words.at }))}:</span> ${escapeHtml(words.note.trim())}</li>`).join("");
  readingNote.field.placeholder = earlier.length
    ? "Your words on this version. Saved as you write."
    : "Anything about this specification as a whole. Saved as you write.";
}
readingNote.earlier.addEventListener("click", (event) => event.target.closest("li")?.classList.toggle("open"));
async function saveReadingNote() {
  clearTimeout(readingNote.timer);
  const path = readingNote.path, note = readingNote.field.value, reading = state.readings.find((r) => r.path === path);
  if (!reading || (reading.note ?? "") === note) return;
  try {
    const body = await fetch("/api/spec-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spec: path, note }) }).then(readJsonOk);
    state.readings = state.readings.map((other) => other.path === body.reading.path ? body.reading : other);
    readingNote.state.textContent = `Saved ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    readingNote.state.textContent = `Not saved: ${error.message ?? error}`;
  }
}
readingNote.field.addEventListener("input", () => { readingNote.state.textContent = "…"; clearTimeout(readingNote.timer); readingNote.timer = setTimeout(saveReadingNote, 800); });
readingNote.field.addEventListener("blur", saveReadingNote);

function renderVerdict() {
  renderReadingNote();
  const reading = currentReading();
  for (const button of refs.verdict.querySelectorAll("button[data-verdict]")) {
    const chosen = reading?.verdict === button.dataset.verdict;
    button.disabled = !reading;
    button.classList.toggle("chosen", chosen && !reading.changed);
    button.classList.toggle("was", chosen && reading.changed);
    button.setAttribute("aria-pressed", String(chosen && !reading.changed));
  }
  refs.verdictChanged.hidden = !reading?.changed;
  renderChanges();
}

// The author's notes on what changed in a reading (productions/<song>/revisions.json, from tools/music/revision.ts): the
// one on the version as it stands opens from beside his verdict, earlier ones under it, collapsed; its points are drawn
// on the timeline's changes lane. They are read, never edited here.
const currentRevision = () => currentReading()?.revisions?.filter((revision) => revision.current).at(-1) ?? null;
const pointTime = (point) => point.to == null ? formatTime(point.from) : `${formatTime(point.from)}–${formatTime(point.to)}`;

function renderChanges() {
  const revisions = currentReading()?.revisions ?? [], now = currentRevision();
  refs.changes.hidden = !revisions.length;
  refs.changesToggle.classList.toggle("fresh", Boolean(now));
  refs.changesToggle.title = now ? `What ${now.by} changed in this version, and why` : "No note on this version; the earlier ones";
  if (!revisions.length) {
    openChanges(false);
    return;
  }
  const earlier = revisions.filter((revision) => revision !== now).reverse();
  refs.changesPanel.innerHTML = (now ? revisionHtml(now) : `<p class="change-none">No note on this version yet.</p>`)
    + (earlier.length ? `<details class="change-earlier"${now ? "" : " open"}><summary>Earlier ${earlier.length === 1 ? "note" : `notes (${earlier.length})`}</summary>`
      + `${earlier.map(revisionHtml).join("")}</details>` : "");
}

function revisionHtml(revision) {
  const points = (revision.points ?? []).map((point) => `<li><button type="button" data-from="${point.from}" data-to="${point.to ?? ""}"`
    + ` title="${point.to == null ? "Go to this moment" : "Select this range"}"><span class="change-time">${escapeHtml(pointTime(point))}</span>`
    + `${escapeHtml(point.text)}</button></li>`).join("");
  return `<section class="change"><p class="change-head"><b>${escapeHtml(revision.by)}</b> · ${escapeHtml(noteDate({ updatedAt: revision.at }, true))}`
    + `${revision.current ? (revision.stale ? " · the latest note; the files changed again since" : " · this version") : ""}</p><p class="change-summary">${escapeHtml(revision.summary)}</p>`
    + `${points ? `<ol class="change-points">${points}</ol>` : ""}</section>`;
}

function openChanges(open) {
  refs.changesPanel.hidden = !open;
  refs.changesToggle.setAttribute("aria-expanded", String(open));
  refs.changesToggle.classList.toggle("on", open);
}

/** A point of a note on what changed: a range is selected (and shown), a moment gets the cursor. */
function selectChange(point) {
  if (!state.data || !Number.isFinite(point.from)) return;
  if (point.to == null || !(point.to > point.from)) {
    clearTransientSelection();
    seekTo(point.from);
    return;
  }
  const range = { t0: point.from, t1: point.to };
  if (range.t0 < state.viewStart || range.t1 > state.viewEnd) {
    const pad = (range.t1 - range.t0) / 2;
    setView(range.t0 - pad, range.t1 + pad);
  }
  applySelection(range);
  drawSelection();
}

/** Gives the current reading `verdict`; the same verdict again clears it, unless the spec changed since (then it confirms it). */
async function setVerdict(verdict) {
  const reading = currentReading();
  if (!reading) return;
  const next = reading.verdict === verdict && !reading.changed ? null : verdict;
  try {
    const body = await fetch("/api/spec-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: reading.path, verdict: next }),
    }).then(readJsonOk);
    state.readings = state.readings.map((other) => other.path === body.reading.path ? body.reading : other);
    renderReview();
    toast(next ? `${VERDICTS[next]}: ${readingLabel(reading)}` : "Verdict cleared");
  } catch (error) {
    toast(`Verdict not saved: ${error.message ?? error}`);
  }
}

/** The next (`step` 1) or previous (-1) reading of the menu, or with "review" the next one without a current verdict. */
function goToReading(step) {
  const shown = shownReadings(), at = shown.findIndex((reading) => reading.path === currentPath());
  if (!shown.length) return;
  let target;
  if (step === "review") {
    target = [...shown.slice(at + 1), ...shown.slice(0, at + 1)].find((reading) => ["none", "changed"].includes(reviewOf(reading)));
    if (!target) return toast("Every reading has your verdict");
  } else {
    target = shown[at < 0 ? 0 : (at + step + shown.length) % shown.length];
  }
  if (target.path !== currentPath()) loadSpec(target.path, true);
}

async function loadSpec(specPath, pushUrl, restore = null) {
  await flushPendingNoteSave();
  if (state.loopMode) leaveLoop();
  pausePlayback();
  state.loadingPath = specPath;
  const reading = state.readings.find((item) => item.path === specPath);
  refs.subtitle.textContent = "Loading " + (reading ? readingLabel(reading) : specPath);
  refs.saveState.textContent = "";
  refs.timeline.innerHTML = "";
  state.data = null;
  state.notes = [];
  state.notesPath = null;
  state.analysis = null;
  state.activeAnchor = null;
  state.activeNoteId = null;
  state.earlierNote = null;
  state.activeTags = [];
  state.viewStart = 0;
  state.viewEnd = 0;
  state.selection = null;
  state.looping = false;
  state.pointerDrag = null;
  refs.rangeBar.hidden = true;
  refs.evidenceWarning.hidden = true;
  state.video = null;
  refs.video.hidden = true;
  refs.video.removeAttribute("src");
  if (restore?.selectedScope) state.selectedScope = restore.selectedScope;
  renderReview();

  const [view, notes] = await Promise.all([
    fetch(`/api/spec-view?spec=${encodeURIComponent(specPath)}&samples=1400`, { cache: "no-cache" }).then(readJsonOk),
    fetch(`/api/spec-notes?spec=${encodeURIComponent(specPath)}`, { cache: "no-cache" }).then(readJsonOk),
  ]);
  state.data = view;
  state.notes = notes.notes || [];
  state.notesPath = notes.notesPath || null;
  state.cursorT = clamp(Number(restore?.cursorT ?? 0), 0, view.spec.duration);
  state.viewStart = clamp(Number(restore?.viewStart ?? 0), 0, view.spec.duration);
  state.viewEnd = clamp(Number(restore?.viewEnd ?? view.spec.duration), state.viewStart + 1e-6, view.spec.duration);
  music.clear();
  if (!view.music?.stems?.[state.stem]) state.stem = "mix";
  renderHear();
  if (musicUrl()) loadMusic(musicUrl());
  loadVideoStatus();
  state.analysis = await loadAnalysis(view.music);
  // A beat grid is only a tempo hypothesis; where measured events exist, notes snap to them.
  if (state.analysis?.onsets.some((event) => event.source) && state.snapMode === "beat") {
    state.snapMode = "event";
    refs.snapMode.value = "event";
  }

  if (pushUrl) {
    const params = new URLSearchParams(location.search);
    params.set("spec", specPath);
    window.history.replaceState(null, "", `${location.pathname}?${params.toString()}`);
  }

  renderAll();
  seekTo(state.cursorT, { select: true, reveal: false, resumeFollow: false });
}

async function loadMusic(url) {
  try {
    if (await music.load(url)) updatePlaybackUi();
  } catch {
    refs.musicMeta.textContent = "Audio failed to load";
  }
}

/** The recording heard: the mix, or the chosen stem. */
function musicUrl() {
  const m = state.data?.music;
  return state.stem === "mix" ? m?.audioUrl : m?.stems?.[state.stem];
}

function renderHear() {
  const stems = state.data?.music?.stems ?? {};
  refs.hear.hidden = Object.keys(stems).length === 0;
  for (const button of refs.hear.querySelectorAll("button[data-hear]")) {
    const name = button.dataset.hear;
    button.disabled = name !== "mix" && !stems[name];
    button.classList.toggle("on", name === state.stem);
    button.setAttribute("aria-pressed", String(name === state.stem));
  }
}

/** Swaps the recording heard (the mix or one stem) at the same position, speed and play state. The
 * previous recording plays on until the new one is decoded. */
async function hear(stem) {
  if (!state.data || stem === state.stem) return;
  state.stem = stem;
  renderHear();
  try {
    if (await music.load(musicUrl()) && music.requested) startPlayback(specTime());
  } catch {
    toast(`${stem} failed to load`);
  }
}

async function readJsonOk(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function loadAnalysis(music) {
  if (!music) return null;
  const load = (url) => url ? fetch(url, { cache: "no-cache" }).then(readJsonOk).catch(() => null) : null;
  const [raw, measured, vocal] = await Promise.all([load(music.beatsUrl), load(music.eventsUrl), load(music.vocalEvidenceUrl)]);
  const analysis = normalizeAnalysis(raw ?? {});
  // The y-axis ceilings do not depend on the view: computed once per song.
  const ceiling = (field) => vocal[field].reduce((top, v) => v === null ? top : Math.max(top, v), 1);
  analysis.vocal = vocal && {...vocal, ceilings: {rms: ceiling('rms'), spectralChange: ceiling('spectralChange')}};
  const note = document.getElementById('vocal-evidence-note');
  const evidenceError = music.vocalEvidenceError || (music.vocalEvidenceUrl && !vocal ? 'Vocal evidence could not be loaded. Reload before using these measurements.' : null);
  note.textContent = evidenceError || (vocal
    ? 'Vocal evidence: estimated separated stem, possibly multiple voices or instrument leakage. RMS and spectral change are measurements; dots are unfiltered detector candidates, not words or impact suggestions. Window centers are not exact onset times. Hover for values; zoom to inspect.'
    : 'No continuous vocal evidence generated for this song. Instrument events below retain each source’s own timing.');
  note.classList.toggle('error', Boolean(evidenceError));
  refs.evidenceWarning.hidden = !evidenceError;
  refs.evidenceWarning.textContent = evidenceError ? 'Vocal evidence unusable' : '';
  refs.evidenceWarning.title = evidenceError || '';
  // Keep every instrument at its own time, including quieter overlapping vocals.
  if (measured?.events) {
    analysis.onsets = sourceEvents(measured.events);
  }
  return analysis;
}

function normalizeAnalysis(raw) {
  const time = (t) => round(Number(t), 4);
  const beats = numericTimes(raw.beats ?? raw.beat_times ?? raw.beat_grid?.beats).map(time);
  const downbeats = numericTimes(raw.downbeats ?? raw.beat_grid?.downbeats).map(time);
  const onsetSource = raw.drum_onsets ?? raw.onsets_drums ?? raw.onsets_mix ?? raw.onsets ?? [];
  const onsets = numericEvents(onsetSource).map((event) => ({
    t: time(event.t),
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
  // A slider or checkbox keeps focus after use, but takes no text: shortcuts still apply.
  if (tag === "INPUT" && (element.type === "range" || element.type === "checkbox")) return false;
  return tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT";
}

function snapCandidates(mode = state.snapMode) {
  if (mode === "event") return (state.analysis?.onsets || []).filter((event) => event.source).map((event) => event.t);
  if (mode === "beat") {
    const beats = state.analysis ? [...state.analysis.beats, ...state.analysis.downbeats] : [];
    return beats.length ? beats : (state.data?.contacts || []).map((contact) => contact.t);
  }
  if (mode === "contact") return (state.data?.contacts || []).map((contact) => contact.t);
  if (mode === "keyframe") return (state.data?.keyframes || []).map((point) => point.t);
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

/** How close to the pointer, in screen pixels, a snap target pulls the edge of a range being dragged. */
const EDGE_SNAP_PX = 10;

/** `t` moved to the nearest snap target when that target is within EDGE_SNAP_PX of it on screen, else `t` itself
 * (always itself with `free`, Shift held): an edge follows the pointer and never jumps to a distant target. */
function snapEdge(t, free) {
  if (free || !state.timeline || state.snapMode === "off") return t;
  const snapped = snapTime(t);
  return Math.abs(state.timeline.rawXFor(snapped) - state.timeline.rawXFor(t)) <= EDGE_SNAP_PX ? snapped : t;
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
  applySelection(snapped);
}

/** Makes `range` the selection and the note's anchor; a paused cursor outside it moves to its start. */
function applySelection(range) {
  state.selection = range;
  state.selectedScope = "range";
  renderScopeTabs();
  const t = specTime();
  if (!isPlaying() && (t < range.t0 || t > range.t1)) seekTo(range.t0, { select: false, reveal: false });
  setActiveAnchor(anchorFor("range", range.t0));
}

function clearTransientSelection() {
  clearNativeSelection();
  state.looping = false;
  if (!state.selection && state.selectedScope !== "range") {
    drawSelection();
    return;
  }
  state.selection = null;
  if (state.selectedScope === "range") {
    state.selectedScope = "moment";
    renderScopeTabs();
  }
  renderTimeline();
}

/** Loops playback over the selected range (L), at the current speed; again stops looping (playback goes on). */
function toggleLoop() {
  const range = normalizedRange(state.selection);
  if (!range) {
    state.looping = false;
    toast("Select a range first: drag across the timeline");
    return;
  }
  state.looping = !state.looping;
  if (state.looping) {
    const t = specTime();
    if (!music.requested || t < range.t0 || t >= range.t1) {
      state.cursorT = range.t0;
      startPlayback(range.t0);
    }
  }
  drawSelection();
}

/** The note editor on the selected range, ready to write. */
function noteSelection() {
  const range = normalizedRange(state.selection);
  if (!range) return;
  state.selectedScope = "range";
  renderScopeTabs();
  setActiveAnchor(anchorFor("range", range.t0));
  refs.noteText.focus();
}

// The timeline's pointer: a press and release in place sets the cursor (snapped, Shift free) or, on a contact or
// keyframe, picks it; a press and drag anywhere selects a range; a drag on an edge of the range moves that edge.
function onTimelinePointerDown(event) {
  if (!state.timeline || event.button !== 0) return;
  refs.timeline.focus?.({ preventScroll: true });
  event.preventDefault();
  clearNativeSelection();
  const edge = event.target.closest?.("[data-range-edge]");
  const range = normalizedRange(state.selection);
  const common = { pointerId: event.pointerId, clientX: event.clientX, moved: false, before: state.selection };
  if (edge && range) {
    // the other edge stays where it is
    state.pointerDrag = { ...common, mode: "edge", fixed: edge.dataset.rangeEdge === "t0" ? range.t1 : range.t0 };
  } else {
    const startT = snapEdge(state.timeline.tAtClient(event.clientX), event.shiftKey);
    state.pointerDrag = { ...common, mode: "press", startT, mark: event.target.closest?.("[data-mark-kind]") ?? null };
  }
  refs.timeline.setPointerCapture?.(event.pointerId);
  refs.rangeBar.hidden = true;
}

function onTimelinePointerMove(event) {
  if (!state.timeline) return;
  setHover(state.timeline.xAtClient(event.clientX));
  showNoteCard(state.pointerDrag ? null : event.target.closest?.("[data-note-index], [data-change-index]"), event);
  const drag = state.pointerDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  event.preventDefault();
  if (!drag.moved && Math.abs(event.clientX - drag.clientX) < 4) return;
  drag.moved = true;
  const t = snapEdge(state.timeline.tAtClient(event.clientX), event.shiftKey);
  state.selection = { t0: drag.mode === "edge" ? drag.fixed : drag.startT, t1: t };
  drawSelection();
}

function onTimelinePointerUp(event) {
  const drag = state.pointerDrag;
  if (!state.timeline || !drag || drag.pointerId !== event.pointerId) return;
  refs.timeline.releasePointerCapture?.(event.pointerId);
  state.pointerDrag = null;
  event.preventDefault();
  clearNativeSelection();
  if (!drag.moved) {
    if (drag.mark) pickMark(drag.mark);
    else clickTimeline(state.timeline.tAtClient(event.clientX), event.shiftKey);
    return;
  }
  const range = normalizedRange(state.selection);
  if (!range || range.t1 - range.t0 < 0.02) {
    state.selection = drag.before;
    drawSelection();
    return;
  }
  applySelection(range);
}

function cancelTimelineDrag(event) {
  const drag = state.pointerDrag;
  if (drag?.pointerId !== event.pointerId) return;
  state.pointerDrag = null;
  if (drag.moved) state.selection = drag.before;
  drawSelection();
}

/** A click on the timeline at `rawT`: the cursor goes there (snapped unless `free`); a click outside the range clears it. */
function clickTimeline(rawT, free) {
  const range = normalizedRange(state.selection);
  if (!range || rawT < range.t0 || rawT > range.t1) clearTransientSelection();
  else drawSelection();
  seekTo(free ? rawT : snapTime(rawT));
}

/** A click on a contact's impact or an axis keyframe: the cursor goes to it and the note editor takes it; on an earlier
 * note: the Notes panel quotes it. */
function pickMark(mark) {
  if (mark.dataset.markKind === "earlierNote") return selectEarlierNote(state.notes[Number(mark.dataset.noteIndex)]);
  if (mark.dataset.markKind === "change") return selectChange(currentRevision()?.points?.[Number(mark.dataset.changeIndex)] ?? {});
  const anchor = anchorForMarkElement(mark);
  if (!anchor) return drawSelection();
  state.selectedScope = anchor.scope;
  renderScopeTabs();
  seekTo(anchor.t, { select: false, reveal: true });
  setActiveAnchor(anchor);
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
  refs.followPlayhead.classList.toggle("on", state.followPlayhead && !state.followSuspended);
}

function renderAll() {
  renderHeader();
  renderTimeline();
  renderScopeTabs();
  renderTags();
  renderNotesList();
  renderInspector();
  selectAnchorAtCursor();
}

function renderHeader() {
  const { data } = state;
  if (!data) return;
  refs.subtitle.textContent = `${formatTime(data.spec.duration)} · ${data.summary.contacts} contacts`;
  refs.subtitle.title = data.spec.path;
  refs.timeTotal.textContent = "/ " + formatTime(data.spec.duration);
  refs.musicMeta.textContent = data.music
    ? [data.music.title, data.music.artist, data.music.tempo].filter(Boolean).join(" - ") || data.music.audio
    : "No audio linked";
  const s = data.summary;
  refs.summary.innerHTML = [
    metric("duration", formatTime(data.spec.duration)),
    metric("contacts", s.contacts),
    metric("keyframes", s.keyframes || 0),
    metric("impact", s.impactTargets ? `${fmt(s.minImpact)}-${fmt(s.maxImpact)}` : "none"),
    metric("gap", `${fmt(s.shortestGap)}-${fmt(s.longestGap)}s`),
    metric("axes", s.activeAxes.join(", ") || "none"),
  ].join("");
  updateViewUi();
}

function metric(label, value) {
  return `<span class="metric">${escapeHtml(label)} <b>${escapeHtml(String(value))}</b></span>`;
}

/** Lane heights (px) filling `room`: each lane between its least and its usual height; room beyond the usual
 * heights goes to the spectrogram and the impact lane. `lanes` maps a name to [least, usual]. */
function laneHeights(lanes, room) {
  const names = Object.keys(lanes);
  const least = names.reduce((sum, name) => sum + lanes[name][0], 0);
  const usual = names.reduce((sum, name) => sum + lanes[name][1], 0);
  const out = {};
  if (room >= usual) {
    for (const name of names) out[name] = lanes[name][1];
    const extra = room - usual;
    out.spectro += Math.floor(extra * 0.55);
    out.impact += Math.floor(extra * 0.45);
  } else {
    const f = clamp((room - least) / Math.max(1, usual - least), 0, 1);
    for (const name of names) out[name] = Math.floor(lanes[name][0] + f * (lanes[name][1] - lanes[name][0]));
  }
  return out;
}

function renderTimeline() {
  const { data } = state;
  if (!data) return;
  const svg = refs.timeline;
  svg.innerHTML = "";

  const axisNames = AXES.filter((axis) => data.axes[axis]);
  // Drawn at the size it is shown, one unit a pixel: it fills its panel.
  const W = Math.max(320, Math.floor(refs.timelineWrap.clientWidth));
  const boxH = Math.floor(refs.timelineWrap.clientHeight);
  const L = 72;
  const R = 14;
  const plotW = W - L - R;
  const top = 20;
  // the song's drop, when it has one: a row of its own under the times
  const dropH = data.drop ? 14 : 0;
  const spectroY = top + 26 + dropH;
  const bottom = 40; // the range's bar sits here
  const hasEvents = Boolean(state.analysis?.onsets.length), hasVocal = Boolean(state.analysis?.vocal);
  const notesH = refs.toggleNotes.checked ? 34 : 0;
  // the places the author's note on this version points to, under the notes
  const changesH = currentRevision()?.points?.length ? 18 : 0;
  const axisGap = 8;
  const lanes = { spectro: [56, 108], impact: [48, 66] };
  if (hasEvents) lanes.events = [60, 104];
  if (hasVocal) lanes.vocal = [120, 164];
  for (const axis of axisNames) lanes[axis] = [30, 48];
  const fixed = spectroY + 10 + (hasEvents ? 10 : 0) + 18 + 18 + axisNames.length * axisGap + notesH + changesH + bottom;
  const h = laneHeights(lanes, boxH - fixed);
  const spectroH = h.spectro;
  const eventsH = h.events ?? 0;
  const eventsY = spectroY + spectroH + 10;
  const vocalH = h.vocal ?? 0;
  const vocalY = eventsY + eventsH + (hasEvents ? 10 : 0);
  const impactH = h.impact;
  const impactY = vocalY + vocalH + 18;
  const axesY = impactY + impactH + 18;
  const H = Math.max(boxH, axesY + axisNames.reduce((sum, axis) => sum + h[axis] + axisGap, 0) + notesH + changesH + bottom);
  const viewStart = clamp(state.viewStart, 0, data.spec.duration);
  const viewEnd = clamp(state.viewEnd || data.spec.duration, viewStart + 1e-6, data.spec.duration);
  const visibleSpan = Math.max(1e-6, viewEnd - viewStart);

  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
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
  if (dropH) drawDrop(svg, top + 3, dropH - 3);
  drawSpectrogram(svg, L, plotW, spectroY, spectroH);
  drawBeatLayer(svg, L, plotW, spectroY, spectroH, H);
  if (eventsH) drawEventLane(svg, L, plotW, eventsY, eventsH);
  if (vocalH) drawVocalEvidence(svg, L, plotW, vocalY, vocalH);
  drawContacts(svg, L, plotW, spectroY, H);
  drawImpactLane(svg, L, plotW, impactY, impactH);

  let y = axesY;
  for (const axis of axisNames) {
    drawAxisLane(svg, axis, L, plotW, y, h[axis]);
    y += h[axis] + axisGap;
  }
  if (refs.toggleNotes.checked) drawNoteLane(svg, L, plotW, y, notesH);
  if (changesH) drawChangeLane(svg, L, plotW, y + notesH, changesH);
  state.timeline.selectionLayer = add(svg, "g", { id: "selection-layer" });

  const playX = state.timeline.xFor(specTime());
  add(svg, "line", { id: "playhead", class: "svg-playhead", x1: playX, y1: 0, x2: playX, y2: H });
  add(svg, "line", { id: "hoverhead", class: "svg-hover", x1: -10, y1: 0, x2: -10, y2: H, opacity: 0 });
  drawSelection();
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
    if (x + 44 <= state.timeline.right + 14) add(svg, "text", { x: x + 3, y: y - 8, class: "svg-small" }, formatTime(t));
  }
}

/** The song's drop (scripts/video/drops.ts, placed by hand): a light band, labelled, its times on hover. */
function drawDrop(svg, y, h) {
  const [t0, t1] = state.data.drop;
  add(svg, "text", { x: 12, y: y + h - 2, class: "svg-small" }, "drop");
  if (!timeIntersects(t0, t1)) return;
  const x0 = state.timeline.xFor(t0), x1 = state.timeline.xFor(t1);
  const band = add(svg, "g", { "data-drop": `${t0}-${t1}` });
  add(band, "rect", { x: x0, y, width: Math.max(2, x1 - x0), height: h, rx: 2, class: "svg-drop" });
  if (x1 - x0 > 120) add(band, "text", { x: x0 + 5, y: y + h - 2.5, class: "svg-drop-label" }, `drop ${t0.toFixed(2)}–${t1.toFixed(2)} s`);
  else if (x1 - x0 > 34) add(band, "text", { x: x0 + 4, y: y + h - 2.5, class: "svg-drop-label" }, "drop");
  add(band, "title", {}, `drop ${t0.toFixed(2)}–${t1.toFixed(2)} s (placed by hand; the film snaps each end to the strongest hit near it)`);
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
  const imageT0 = 0, imageT1 = metaDuration;
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
}

// Separate sources: no winner selection and no viewport-dependent rescaling.
function drawEventLane(svg, L, plotW, y, h) {
  const duration = state.data.spec.duration;
  add(svg, "rect", { x: L, y, width: plotW, height: h, fill: "#f4efe6", opacity: 0.6 });
  const sourceColors = { drums: "#e0574a", bass: "#5b8fd1", vocals: "#f0a04b", other: "#5fbf8f" };
  const measured = state.analysis.onsets.some((event) => event.source);
  const visible = state.analysis.onsets.filter((event) => event.t >= 0 && event.t <= duration && timeVisible(event.t));
  const sources = measured ? ['drums', 'bass', 'vocals', 'other'] : ['onsets'];
  const laneH = h / sources.length;
  const maxStrength = Math.max(1, ...state.analysis.onsets.map(event => event.strength || 0));
  sources.forEach((source, i) => add(svg, 'text', {x: 12, y: y + i * laneH + 15, class: 'svg-small'}, source));
  for (const event of visible) {
    const x = state.timeline.xFor(event.t);
    const height = Math.max(2, Math.min(laneH - 3, (event.strength / maxStrength) * (laneH - 3)));
    const row = measured ? Math.max(0, sources.indexOf(event.source)) : 0;
    const mark = add(svg, "rect", {
      x: x - 1,
      y: y + (row + 1) * laneH - height,
      width: 2,
      height,
      fill: sourceColors[event.source] ?? "#f6c85f",
      opacity: measured ? 0.85 : 0.34,
      "data-event-source": event.source ?? "onsets",
    });
    add(mark, 'title', {}, `${event.source || 'onset'} at ${event.t.toFixed(3)} s · rise ${event.strength} · peak ${event.peak ?? 'not recorded'}; detector estimate, not a word boundary`);
  }
}

function drawVocalEvidence(svg, L, plotW, y, h) {
  const e = state.analysis.vocal, dt = e.hopSamples / e.sampleRate;
  const first = Math.max(0, Math.floor(state.viewStart / dt));
  const last = Math.min(e.rms.length - 1, Math.ceil(state.viewEnd / dt));
  // two traces, then three rows of candidate dots
  const dotStep = clamp(h * 0.1, 12, 17), dotsY = y + h - 3 * dotStep + 4;
  const rowH = (dotsY - y - 8) / 2, traceH = rowH - 10;
  for (const [row, field, label, color] of [[0, 'rms', 'vocal RMS', '#a86820'], [1, 'spectralChange', 'change', '#77529c']]) {
    const top = y + row * rowH, height = traceH;
    const ceiling = e.ceilings[field];
    add(svg, 'text', {x: 3, y: top + 16, class: 'svg-small'}, label);
    add(svg, 'text', {x: 3, y: top + 30, class: 'svg-small'}, `0–${ceiling.toFixed(2)}`);
    add(svg, 'line', {x1:L,x2:L+plotW,y1:top+height,y2:top+height,class:'svg-rule'});
    let path = '', pen = false;
    for (let i = first; i <= last; i++) {
      const v = e[field][i];
      if (v === null) {pen = false; continue;}
      path += `${pen ? 'L' : 'M'}${state.timeline.xFor(i * dt).toFixed(2)},${(top + height - (v / ceiling) * height).toFixed(2)} `;
      pen = true;
    }
    add(svg, 'path', {d:path,fill:'none',stroke:color,'stroke-width':1.2,'data-evidence-series':field});
  }
  const kinds = ['spectral-onset', 'pitched-estimate', 'unpitched-estimate'];
  ['onset est.', 'tonal est.', 'noisy est.'].forEach((label, i) => add(svg,'text',{x:3,y:dotsY+4+i*dotStep,class:'svg-small'},label));
  for (const c of e.candidates) {
    if (!timeVisible(c.t)) continue;
    const dot = add(svg,'circle',{cx:state.timeline.xFor(c.t),cy:dotsY+kinds.indexOf(c.kind)*dotStep,r:2.8,fill:'#6b737b','data-vocal-candidate':c.kind});
    const landmarks = c.landmarks;
    const timing = landmarks ? ` · RMS minimum ${landmarks.precedingMinimumT.toFixed(3)} s${landmarks.minimumAtClipStart ? ' (clip-start fallback)' : ''} · steepest rise ${landmarks.steepestRiseT === null ? 'unavailable' : landmarks.steepestRiseT.toFixed(3) + ' s'}; measurement landmarks, not onset bounds` : '';
    if (landmarks) dot.dataset.acousticLandmarks = 'true';
    add(dot,'title',{},`${c.kind} at ${c.t.toFixed(3)} s (audio)${timing}${c.pitch ? ` · pitch estimate ${c.pitch}` : ''}${c.flatness !== undefined ? ` · flatness ${c.flatness}` : ''}${c.rise_db !== undefined ? ` · rise ${c.rise_db} dB` : ''} · not a word label`);
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
      class: "svg-readonly",
      opacity: 0.95,
      "data-mark-kind": "contactImpact",
      "data-index": index,
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

/** Whether `note` is the one selected: a current note by the editor's anchor, an earlier one when quoted. */
const isActiveNote = (note) => note.current ? !state.earlierNote && note.id === state.activeNoteId : note === state.earlierNote;

// The notes lane: notes on this version filled; notes on earlier versions under them, pale, or outlined (dashed) when
// "Earlier notes" is on. Hovering any note shows its words; a click on an earlier one quotes it in the Notes panel.
function drawNoteLane(svg, L, plotW, y, h) {
  add(svg, "text", { x: 12, y: y + 18, class: "svg-label" }, "notes");
  add(svg, "line", { x1: L, y1: y + h / 2, x2: L + plotW, y2: y + h / 2, class: "svg-rule" });
  // an earlier note: pale; outlined when shown; rust when quoted
  const earlier = (active) => active ? { fill: "#a8442f", opacity: 0.9 }
    : listening.earlierNotes ? { fill: "#fffdfa", "fill-opacity": 0.7, stroke: "#2d5d8f", "stroke-width": 1.2, "stroke-dasharray": "3 2", opacity: 1 }
    : null;
  // earlier notes first: the current ones are drawn over them
  const order = [...state.notes.keys()].sort((a, b) => Number(state.notes[a].current) - Number(state.notes[b].current));
  for (const index of order) {
    const note = state.notes[index], active = isActiveNote(note);
    const marked = note.current ? { "data-note-index": index }
      : { "data-note-index": index, "data-mark-kind": "earlierNote", class: "svg-note-earlier", ...earlier(active) };
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
        fill: note.current && active ? "#a8442f" : "#2d5d8f",
        opacity: note.current ? 0.78 : 0.22,
        ...marked,
      });
      continue;
    }
    if (!timeVisible(note.t)) continue;
    const x = state.timeline.xFor(note.t);
    // a strong mark: the same mark, wider, the lane's full height and darker
    const strong = note.tags?.includes("strong");
    add(svg, "rect", {
      x: x - (strong ? 5 : 3),
      y: y + (strong ? 2 : 6),
      width: strong ? 10 : 6,
      height: h - (strong ? 4 : 12),
      rx: 2,
      fill: note.current && active ? "#a8442f" : strong ? "#173a5e" : "#2d5d8f",
      opacity: note.current ? (strong ? 1 : 0.88) : 0.28,
      "data-note-tag": strong ? "strong" : "note",
      ...marked,
    });
  }
}

// The changes lane: the points of the author's note on this version (What changed), a range as a bar, a moment as a
// tick. Not notes: hovered they show their words, clicked they select their place.
function drawChangeLane(svg, L, plotW, y, h) {
  add(svg, "text", { x: 12, y: y + 12, class: "svg-label" }, "changes");
  currentRevision().points.forEach((point, index) => {
    const marked = { "data-change-index": index, "data-mark-kind": "change", class: "svg-change", rx: 1.5 };
    if (point.to != null && point.to > point.from) {
      if (!timeIntersects(point.from, point.to)) return;
      const x0 = state.timeline.xFor(Math.max(point.from, state.timeline.viewStart));
      const x1 = state.timeline.xFor(Math.min(point.to, state.timeline.viewEnd));
      add(svg, "rect", { x: x0, y: y + 5, width: Math.max(3, x1 - x0), height: h - 10, ...marked });
    } else if (timeVisible(point.from)) {
      add(svg, "rect", { x: state.timeline.xFor(point.from) - 1.5, y: y + 2, width: 3, height: h - 4, ...marked });
    }
  });
}

/** Redraws only the selected range (its band, its two edges with their handles) and places its bar. */
function drawSelection() {
  const tl = state.timeline, layer = tl?.selectionLayer;
  if (!layer) return;
  layer.replaceChildren();
  const range = normalizedRange(state.selection);
  const shown = Boolean(range && timeIntersects(range.t0, range.t1));
  if (shown) {
    const x0 = tl.rawXFor(range.t0), x1 = tl.rawXFor(range.t1);
    const left = clamp(x0, tl.left, tl.right), right = clamp(x1, tl.left, tl.right);
    add(layer, "rect", { x: left, y: 0, width: Math.max(1, right - left), height: tl.height, class: `svg-selection${state.looping ? " looping" : ""}` });
    for (const [edge, x] of [["t0", x0], ["t1", x1]]) {
      if (x < tl.left - 0.5 || x > tl.right + 0.5) continue;
      add(layer, "line", { x1: x, y1: 0, x2: x, y2: tl.height, class: "svg-range-edge" });
      add(layer, "rect", { x: x - 4, y: 22, width: 8, height: 20, rx: 2, class: "svg-range-grip" });
      add(layer, "rect", { x: x - 6, y: 0, width: 12, height: tl.height, class: "svg-range-handle", "data-range-edge": edge });
    }
  }
  placeRangeBar(shown && !state.pointerDrag ? range : null);
  updateViewUi();
}

/** The range's bar (loop, zoom, snap, note, clear) under the middle of the range's visible part. */
function placeRangeBar(range) {
  const bar = refs.rangeBar;
  bar.hidden = !range;
  refs.rangeLoop.classList.toggle("on", state.looping);
  refs.rangeLoop.setAttribute("aria-pressed", String(state.looping));
  if (!range) return;
  refs.rangeLength.textContent = `${formatTime(range.t0)}–${formatTime(range.t1)} · ${(range.t1 - range.t0).toFixed(2)} s`;
  const tl = state.timeline;
  const mid = (tl.xFor(range.t0) + tl.xFor(range.t1)) / 2;
  const half = bar.offsetWidth / 2, room = refs.timelineWrap.clientWidth;
  bar.style.left = `${clamp(mid - half, 4, Math.max(4, room - 2 * half - 4))}px`;
  bar.style.top = `${refs.timelineWrap.scrollTop + Math.min(tl.height, refs.timelineWrap.clientHeight) - bar.offsetHeight - 6}px`;
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
      class: "svg-keyframe svg-readonly",
      opacity: active ? 1 : 0.92,
      "data-mark-kind": "axisKeyframe",
      "data-axis": point.axis,
      "data-index": point.index,
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

function updatePlaybackUi(t = specTime()) {
  if (!state.data) return;
  state.cursorT = t;
  refs.timeNow.textContent = formatTime(t);
  refs.scrub.value = String(clamp(t / state.data.spec.duration, 0, 1));
  const playing = state.loopMode ? !refs.video.paused : isPlaying();
  refs.play.textContent = playing ? "Pause" : "Play";
  refs.play.classList.toggle("playing", playing);
  const x = state.timeline?.xFor(t);
  if (x !== undefined) {
    const ph = document.getElementById("playhead");
    if (ph) {
      ph.setAttribute("x1", x);
      ph.setAttribute("x2", x);
    }
  }
  syncVideo(t);
  renderInspector(t);
}

function renderInspector(t = specTime()) {
  const { data } = state;
  if (!data) return;
  const contactHit = nearestContact(t);
  const gap = currentGap(t);
  const phase = currentPhase(t);
  const keyframeHit = nearestKeyframe(t);
  refs.cursorTime.textContent = formatTime(t);
  // One line: the nearest contact, its impact, the phase; the rest when opened.
  const impact = contactHit ? contactHit.contact.impact === null ? "untargeted" : fmt(contactHit.contact.impact) : null;
  refs.cursorSummary.textContent = [
    contactHit ? `contact #${contactHit.index} ${signed(contactHit.contact.t - t)} s` : "no contact",
    impact && `impact ${impact}`,
    phase?.name,
  ].filter(Boolean).join(" · ");
  if (!refs.cursorDetails.open) return;
  const vocal = vocalFrame(state.analysis?.vocal, t);
  // One assignment per call: this runs on every animation frame during playback.
  refs.cursorGrid.innerHTML = [
    detail("contact", contactHit ? `#${contactHit.index} ${signed(contactHit.contact.t - t)}s` : "none"),
    detail("impact", contactHit?.contact.impact === null ? "untargeted" : fmt(contactHit?.contact.impact)),
    detail("gap", gap ? `#${gap.i} ${fmt(gap.duration)}s` : "none"),
    detail("phase", phase?.name || "none"),
    detail("keyframe", keyframeHit ? `${keyframeHit.point.axis} #${keyframeHit.point.index} ${signed(keyframeHit.point.t - t)}s` : "none"),
    ...(vocal ? [detail('vocal window', `${vocal.t.toFixed(3)}s (audio)`), detail('vocal RMS', vocal.rms.toFixed(4)),
      detail('spectral change', vocal.change === null ? 'unavailable' : vocal.change.toFixed(4))] : []),
    ...(vocal?.bandFlux ? [detail('band change · dB/frame', vocal.bandFlux.map(b => `${b.filterCenterHz[0]}–${b.filterCenterHz[1]} Hz: ${b.value === null ? 'unavailable' : b.value.toFixed(2)}`).join(' · '))] : []),
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
}

function detail(label, value) {
  return `<div class="detail"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(String(value ?? "-"))}</div></div>`;
}

function selectAnchorAtCursor() {
  setActiveAnchor(anchorFor(state.selectedScope, specTime()));
}

function setActiveAnchor(anchor) {
  state.activeAnchor = anchor;
  state.activeNoteId = anchor.id;
  state.earlierNote = null;
  renderEarlier();
  // the editor holds a note on this version only: a note on an earlier one is never written over
  const note = state.notes.find((item) => item.id === anchor.id && item.current);
  state.activeTags = note?.tags ? [...note.tags] : [];
  refs.noteAnchor.textContent = anchor.title;
  refs.noteText.value = note?.text || "";
  renderTags();
  renderNotesList();
  renderTimeline();
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
  const momentT = round(t, 2);
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

/** Quick marks use the heard song time during playback, or the selected anchor
 * when paused. They are ordinary persisted notes, never edits to the spec. */
async function quickMark(kind) {
  if (!state.data) return;
  const t = specTime();
  const anchor = !isPlaying() && state.activeAnchor && Math.abs(state.activeAnchor.t - t) < .011
    ? {...state.activeAnchor} : anchorFor("moment", t);
  await flushPendingNoteSave();
  state.selectedScope = anchor.scope;
  renderScopeTabs();
  setActiveAnchor(anchor);
  // mark and strong are two levels of one mark: a moment holds one of them.
  const other = { mark: "strong", strong: "mark" }[kind];
  state.activeTags = [...new Set([...state.activeTags.filter((tag) => tag !== other), kind])];
  renderTags();
  toast(`${{ mark: "Marked", strong: "Strong", voice: "Voice", impact: "Impact" }[kind]} at ${formatTime(anchor.t)}`);
  await saveActiveNote();
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
  if (!state.data || !state.activeNoteId || state.earlierNote) return;
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
  try {
    const res = await fetch("/api/spec-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, id, note: null }),
    }).then(readJsonOk);
    refs.saveState.textContent = "deleted";
  } catch (error) {
    refs.saveState.textContent = "delete failed";
    toast(String(error));
  }
}

async function clearAllNotes() {
  if (!state.data) return;
  if (!window.confirm(`Clear your notes on this version of ${state.data.spec.label}? Notes on earlier versions are kept.`)) return;
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  state.pendingNoteSave = null;
  state.notes = state.notes.filter((note) => !note.current);
  refs.noteText.value = "";
  state.activeTags = [];
  renderTags();
  renderNotesList();
  renderTimeline();
  try {
    const res = await fetch("/api/spec-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path, clear: true }),
    }).then(readJsonOk);
    state.notesPath = res.notesPath || state.notesPath;
    refs.saveState.textContent = "cleared";
  } catch (error) {
    refs.saveState.textContent = "clear failed";
    toast(String(error));
  }
}

function upsertLocalNote(note) {
  const text = note.text || "";
  const tags = note.tags || [];
  // an earlier version's note is not written over: it stays (the server keeps it under an id of its own)
  state.notes = state.notes.map((item) => item.id === note.id && !item.current ? { ...item, id: `${item.id}~earlier` } : item)
    .filter((item) => item.id !== note.id);
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
      current: true,
    });
  }
  state.notes.sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
}

/** Where a note is: its time (a range's two), and its kind. */
function noteWhere(note) {
  const time = note.scope === "range" && typeof note.t0 === "number" && typeof note.t1 === "number"
    ? `${formatTime(note.t0)}-${formatTime(note.t1)}`
    : formatTime(note.t);
  return { time, scope: note.scope === "keyframe" && note.axis ? `${note.axis} keyframe` : note.scope };
}
/** When a note was last written, as a short date (`long`: with the year and hour). */
function noteDate(note, long = false) {
  const date = new Date(note.updatedAt || note.createdAt);
  if (Number.isNaN(date.getTime())) return "undated";
  return date.toLocaleString(undefined, long ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
}

function renderNotesList() {
  refs.notesTitle.title = state.notesPath ? `Kept in ${state.notesPath}` : "";
  refs.notesList.innerHTML = "";
  // the list is for what he wrote on this version: a mark without words is on the timeline's notes lane, and only counted
  // here; notes on earlier versions are kept, pale on the timeline, and all listed (marks included) with "Earlier notes"
  const words = (note) => (note.text || "").trim();
  const now = state.notes.filter((note) => note.current), earlier = state.notes.length - now.length;
  const marks = now.filter((note) => !words(note)).length;
  refs.notesMarks.textContent = `${now.length} open` + (marks ? ` (${marks} mark${marks === 1 ? "" : "s"} without words, on the timeline)` : "");
  refs.earlierToggle.hidden = !earlier;
  refs.earlierLabel.textContent = `Earlier notes (${earlier})`;
  refs.notesList.parentElement.classList.toggle("earlier-on", listening.earlierNotes && earlier > 0);
  const listed = state.notes.map((note, index) => ({ note, index }))
    .filter(({ note }) => isActiveNote(note) || (note.current ? words(note) : listening.earlierNotes));
  for (const { note, index } of listed) {
    const li = document.createElement("li");
    li.classList.toggle("active", isActiveNote(note));
    li.classList.toggle("earlier", !note.current);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.noteIndex = index;
    const where = noteWhere(note), label = note.current ? where.scope : `${where.scope} · ${noteDate(note)}`;
    button.title = `${where.time} · ${where.scope}${note.current ? "" : ` · earlier version, ${noteDate(note, true)}`}`
      + `\n${note.text || ""}${note.tags.length ? `\n${note.tags.join(", ")}` : ""}`;
    button.innerHTML = `<span class="note-time">${escapeHtml(where.time)}</span>`
      + `<span class="note-text">${escapeHtml(words(note) || note.tags.join(", ") || "mark")}</span>`
      + `<span class="note-scope">${escapeHtml(label)}</span>`;
    li.appendChild(button);
    refs.notesList.appendChild(li);
  }
  if (state.earlierNote) refs.notesList.querySelector("li.active")?.scrollIntoView({ block: "nearest" });
}

// A note on an earlier version is read, not edited: the panel quotes it with its date, and "Note this again on this
// version" starts a current note at the same place with its words (the server keeps the earlier one as it is).
function selectEarlierNote(note) {
  if (!note || note.current) return;
  flushPendingNoteSave();
  state.earlierNote = note;
  state.activeAnchor = null;
  state.activeNoteId = null;
  state.activeTags = [];
  seekTo(note.t, { select: false, reveal: true });
  renderEarlier();
  renderNotesList();
  renderTimeline();
}

function renderEarlier() {
  const note = state.earlierNote;
  refs.earlierRef.hidden = !note;
  // read, not edited: no editor, tags, Delete or Clear while it is quoted
  refs.noteText.hidden = refs.tagRow.hidden = refs.saveState.parentElement.hidden = Boolean(note);
  if (!note) return;
  const where = noteWhere(note);
  refs.noteAnchor.textContent = `${where.scope} ${where.time} · a note on an earlier version`;
  refs.earlierHead.textContent = [`Written ${noteDate(note, true)}`, note.tags.join(", ")].filter(Boolean).join(" · ");
  refs.earlierText.textContent = (note.text || "").trim() || "(a mark without words)";
}

async function noteAgain() {
  const old = state.earlierNote;
  if (!old || !state.data) return;
  if (old.scope === "range" && typeof old.t0 === "number" && typeof old.t1 === "number") state.selection = { t0: old.t0, t1: old.t1 };
  state.selectedScope = old.scope;
  renderScopeTabs();
  // the same place in this version: the moment, the range, or the contact, gap or keyframe nearest its time
  setActiveAnchor(anchorFor(old.scope, old.t));
  const words = (old.text || "").trim(), mine = refs.noteText.value.trim();
  refs.noteText.value = mine && words ? `${mine}\n${words}` : mine || words;
  state.activeTags = [...new Set([...state.activeTags, ...(old.tags || [])])];
  renderTags();
  await saveActiveNote();
  await reloadNotes();
  refs.noteText.focus();
  toast(`Noted again on this version, at ${formatTime(state.activeAnchor?.t ?? old.t)}`);
}

/** The notes as the server keeps them (after a note again, the earlier one under the id the server gave it). */
async function reloadNotes() {
  const spec = state.data?.spec.path;
  try {
    const body = await fetch(`/api/spec-notes?spec=${encodeURIComponent(spec)}`, { cache: "no-cache" }).then(readJsonOk);
    if (spec !== state.data?.spec.path) return;
    state.notes = body.notes || [];
    renderNotesList();
    renderTimeline();
  } catch { /* the local notes stay */ }
}

/** The words of the note (or the point of what changed) under the pointer on the timeline, in a card above it (`mark` null
 * hides it). */
function showNoteCard(mark, event) {
  const card = document.getElementById("note-card"), note = mark && state.notes[Number(mark.dataset.noteIndex)];
  const revision = mark?.dataset.changeIndex !== undefined ? currentRevision() : null, point = revision?.points?.[Number(mark.dataset.changeIndex)];
  if (!note && !point) {
    card.hidden = true;
    return;
  }
  if (point) {
    card.innerHTML = `<div class="note-card-head">${escapeHtml(pointTime(point))} · <b>what ${escapeHtml(revision.by)} changed</b></div>`
      + `<div class="note-card-text">${escapeHtml(point.text)}</div>`
      + `<div class="note-card-hint">${point.to == null ? "click to go there" : "click to select it"}</div>`;
    placeNoteCard(card, event);
    return;
  }
  const where = noteWhere(note);
  card.innerHTML = `<div class="note-card-head">${escapeHtml(`${where.time} · ${where.scope}`)}`
    + `${note.current ? "" : ` · <b>earlier version, ${escapeHtml(noteDate(note, true))}</b>`}</div>`
    + (note.tags.length ? `<div class="note-card-tags">${escapeHtml(note.tags.join(", "))}</div>` : "")
    + `<div class="note-card-text">${escapeHtml((note.text || "").trim() || "(no words)")}</div>`
    + (note.current ? "" : `<div class="note-card-hint">click to quote it in the Notes panel</div>`);
  placeNoteCard(card, event);
}

function placeNoteCard(card, event) {
  card.hidden = false;
  const wrap = refs.timelineWrap.getBoundingClientRect();
  const x = event.clientX - wrap.left, y = event.clientY - wrap.top + refs.timelineWrap.scrollTop;
  card.style.left = `${clamp(x - card.offsetWidth / 2, 4, wrap.width - card.offsetWidth - 4)}px`;
  card.style.top = `${Math.max(4, y - card.offsetHeight - 14)}px`;
}

// The music and the cursor share one clock, the audio hardware's (shared/playback.js):
// the cursor sits at the position heard, also where the spec runs past the music.
function togglePlayback() {
  if (!state.data) return;
  if (state.loopMode) {
    if (refs.video.paused) refs.video.play().catch(() => {});
    else refs.video.pause();
    return updatePlaybackUi();
  }
  if (music.requested) pausePlayback();
  else startPlayback(state.cursorT);
}

function startPlayback(t) {
  if (state.loopMode) leaveLoop();
  clearClicks();
  music.play(t, state.playbackRate)
    .then(() => updatePlaybackUi(), (error) => toast(String(error)));
}

function pausePlayback() {
  clearClicks();
  if (isPlaying()) state.cursorT = specTime();
  music.pause();
  updatePlaybackUi(state.cursorT);
}

/** Audio is running: the clock to read the position from. */
function isPlaying() {
  return music.playing;
}


function audioDurationForMusic(spec = state.data?.music) {
  if (music.duration) return music.duration;
  const metaDuration = Number(spec?.spectrogram?.meta?.duration);
  return Number.isFinite(metaDuration) && metaDuration > 0 ? metaDuration : null;
}

/** Spec time heard at performance time `ms` (now by default); the cursor when paused. */
function specTime(ms = performance.now()) {
  if (!state.data) return 0;
  const t = isPlaying() ? music.position(ms) : state.cursorT;
  return clamp(t, 0, state.data.spec.duration);
}

function seekTo(t, opts = { select: true }) {
  if (!state.data) return;
  const next = clamp(t, 0, state.data.spec.duration);
  state.cursorT = next;
  if (state.loopMode && refs.video.readyState >= 1) refs.video.currentTime = clamp(next - state.video.from, 0, refs.video.duration);
  if (music.requested) startPlayback(next);
  if (opts.resumeFollow !== false) resumeFollow();
  if (opts.reveal !== false) revealTime(next, { manual: false });
  updatePlaybackUi(next);
  if (opts.select) selectAnchorAtCursor();
}

// The ride's video: one per spec file, made by the server on request (scripts/gallery/spec_video_api.ts).
// It is muted and follows the dashboard's own clock: position, speed, seeks and pauses.
async function loadVideoStatus() {
  const spec = state.data?.spec.path;
  if (!spec) return;
  try {
    const status = await fetch(`/api/spec-video?spec=${encodeURIComponent(spec)}`, { cache: "no-cache" }).then(readJsonOk);
    if (spec !== state.data?.spec.path) return;
    const finished = state.videoJob && isMaking(state.videoJob) && !isMaking(status.job);
    if (status.video?.url !== state.video?.url || status.video?.madeAt !== state.video?.madeAt) {
      refs.video.src = status.video ? `${status.video.url}?v=${encodeURIComponent(status.video.madeAt)}` : "";
      if (!status.video) refs.video.removeAttribute("src");
    }
    state.video = status.video;
    state.videoJob = status.job;
    renderVideo();
    if (finished && status.job.spec === spec) toast(status.job.phase === "done" ? "Video made" : "Video failed");
    if (finished) loadReadings();
  } catch (error) {
    refs.videoState.textContent = `Video status unavailable: ${error.message}`;
  }
  clearTimeout(loadVideoStatus.timer);
  if (isMaking(state.videoJob)) loadVideoStatus.timer = setTimeout(loadVideoStatus, 2000);
}

const isMaking = (job) => job?.phase === "compiling" || job?.phase === "rendering";

function renderVideo() {
  const { video, videoJob: job } = state, spec = state.data?.spec.path;
  const mine = job?.spec === spec ? job : null;
  refs.video.hidden = !video || !listening.videoOpen;
  refs.toggleVideo.hidden = !video;
  refs.makeVideo.disabled = isMaking(job);
  refs.makeVideo.hidden = state.loopMode;
  refs.makeVideo.textContent = isMaking(mine) ? "Making the video" : video ? "Make it again" : "Make the video";
  refs.makeVideo.title = isMaking(job) && !mine ? `A video is being made for ${job.spec}` : "Compile this spec and render its ride (a few minutes)";
  const lines = [];
  if (video) {
    const made = new Date(video.madeAt).toLocaleString();
    lines.push(video.current ? `Made from this version, ${made}.` : `The spec changed since this video was made (${made}).`);
    lines.push(`${video.theme}, zoom ${video.zoom ?? "steady"}`);
  } else {
    lines.push("No video of this spec yet.");
  }
  if (state.loopMode) {
    lines.length = 0;
    lines.push("The finished film, looping with its own sound.", "Space plays or pauses.");
  }
  refs.watchLoop.hidden = !video;
  refs.watchLoop.textContent = state.loopMode ? "Back to the spec" : "Watch the loop";
  refs.watchLoop.classList.toggle("on", state.loopMode);
  refs.watchLoop.setAttribute("aria-pressed", String(state.loopMode));
  refs.loopFromStart.hidden = !state.loopMode;
  if (isMaking(mine)) {
    const seconds = Math.round((Date.now() - Date.parse(mine.startedAt)) / 1000);
    lines.push(`${mine.phase === "compiling" ? "Compiling" : "Rendering"}, ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} so far. Look: ${mine.look}.`);
    if (mine.line) lines.push(mine.line);
  } else if (mine?.phase === "error") {
    lines.push(`The last attempt failed:\n${mine.error}`);
  }
  refs.videoState.textContent = lines.join("\n");
  refs.videoState.title = lines.join("\n");
  refs.videoState.classList.toggle("stale", Boolean(video && !video.current));
  refs.videoState.classList.toggle("error", mine?.phase === "error");
}

async function makeVideo() {
  if (!state.data) return;
  refs.makeVideo.disabled = true;
  try {
    const res = await fetch("/api/spec-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spec: state.data.spec.path }),
    }).then(readJsonOk);
    state.videoJob = res.job;
  } catch (error) {
    toast(String(error.message ?? error));
  }
  loadVideoStatus();
}

// "Watch the loop": the finished film plays by itself, at its own speed, with its own sound (the looping recording, the
// camera's end, the blend into its start), looping. It starts LOOP_LEAD seconds before its end, so the join comes at once
// (`fromStart`: the whole film). The dashboard's own playback and clicks stop; its cursor follows the film. "Back to the
// spec" mutes it and slaves it to the dashboard's clock again.
const LOOP_LEAD = 5;
function watchLoop(fromStart = false) {
  const v = refs.video;
  if (!state.video || v.readyState < 1) return toast("The video is not loaded yet");
  pausePlayback();
  state.looping = false;
  drawSelection();
  if (!listening.videoOpen) setListening({ videoOpen: true });
  state.loopMode = true;
  v.loop = true;
  v.muted = false;
  v.volume = listening.musicMuted ? 0 : listening.musicVolume;
  v.playbackRate = 1;
  v.currentTime = fromStart ? 0 : Math.max(0, v.duration - LOOP_LEAD);
  v.play().catch((error) => toast(String(error.message ?? error)));
  renderVideo();
  updatePlaybackUi();
}

function leaveLoop() {
  const v = refs.video;
  state.loopMode = false;
  v.loop = false;
  v.muted = true;
  v.pause();
  if (state.data && state.video) state.cursorT = clamp(state.video.from + v.currentTime, 0, state.data.spec.duration);
  renderVideo();
  updatePlaybackUi(state.cursorT);
}

/** Puts the video at spec time `t`: playing with the music at its speed, or paused on the frame. */
function syncVideo(t = specTime()) {
  const v = refs.video;
  if (state.loopMode || !state.video || !listening.videoOpen || v.readyState < 1) return;
  const at = clamp(t - state.video.from, 0, v.duration || 0), running = isPlaying() && at < v.duration;
  if (v.playbackRate !== state.playbackRate) v.playbackRate = state.playbackRate;
  if (running) {
    if (!v.seeking && Math.abs(v.currentTime - at) > 0.12) v.currentTime = at;
    if (v.paused) v.play().catch(() => {});
  } else {
    if (!v.paused) v.pause();
    if (!v.seeking && Math.abs(v.currentTime - at) > 0.005) v.currentTime = at;
  }
}

// Each frame shows the cursor at the spec time heard when the frame is on screen.
function tick(ts) {
  const loop = state.data && isPlaying() && state.looping && normalizedRange(state.selection);
  // Watching the loop: the cursor follows the film where it is inside the spec's time
  if (state.loopMode && state.data) {
    const t = clamp(state.video.from + refs.video.currentTime, 0, state.data.spec.duration);
    if (!refs.video.paused) followTime(t);
    updatePlaybackUi(t);
  // Looping: back to the range's start as soon as its end is rendered (or when playback is well before it).
  } else if (loop && (music.rendered() >= loop.t1 || music.rendered() < loop.t0 - 0.5)) {
    state.cursorT = loop.t0;
    startPlayback(loop.t0);
    updatePlaybackUi(loop.t0);
  } else if (state.data && isPlaying()) {
    const t = specTime(onScreen(ts));
    if (t >= state.data.spec.duration) {
      state.cursorT = state.data.spec.duration;
      clearClicks();
      music.pause();
    }
    scheduleClicks();
    followTime(t);
    updatePlaybackUi(t);
  }
  requestAnimationFrame(tick);
}

// A click at every landing while the music plays, louder for stronger requested
// impact, so a landing that misses the music, or music with no landing, is audible
// rather than only visible. Clicks are scheduled on the music's own clock, slightly
// ahead of the sound being rendered, so each lands on its spec time in the music.
// Turning clicks off silences them at once: their gain drops to 0 and those already
// scheduled are stopped.
function clearClicks() {
  for (const osc of clicks.pending) osc.stop();
  clicks.pending.clear();
  clicks.until = -Infinity;
}
function scheduleClicks() {
  if (!isPlaying() || !listening.clicks) return;
  const ctx = music.context;
  if (clicks.out?.context !== ctx) {
    clicks.out = ctx.createGain();
    clicks.out.gain.value = listening.clickVolume;
    clicks.out.connect(ctx.destination);
  }
  // no click past a loop's end: the loop starts over there
  const loop = state.looping && normalizedRange(state.selection);
  const now = music.rendered(), horizon = Math.min(now + 0.15 * state.playbackRate, loop ? loop.t1 - 1e-4 : Infinity);
  if (!(clicks.until >= now - 0.05 && clicks.until <= horizon)) clicks.until = now; // after a seek
  for (const contact of state.data.contacts) {
    if (contact.t <= clicks.until || contact.t > horizon) continue;
    const at = music.when(contact.t);
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    clicks.pending.add(osc);
    osc.onended = () => {clicks.pending.delete(osc); osc.disconnect(); gain.disconnect();};
    osc.frequency.value = 1800;
    gain.gain.setValueAtTime(0.15 + 0.6 * Math.sqrt(contact.impact ?? 0.5), at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
    osc.connect(gain).connect(clicks.out);
    osc.start(at);
    osc.stop(at + 0.035);
  }
  clicks.until = horizon;
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
