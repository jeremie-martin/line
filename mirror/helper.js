/**
 * window.__lr — convenience API on top of linerider.com's bundle.
 *
 * Loaded after main.js. Combines two access paths:
 *   - Redux dispatches for global state (views, playback zoom, track load)
 *   - Live React fiber walk to reach VideoExporter component-local state
 *     (resolution, HQ toggle, render trigger)
 *
 * Designed to be invoked from Playwright via page.evaluate() or directly
 * from DevTools when developing in a real browser at http://localhost:8765/.
 *
 * Action shapes and component fields were reverse-engineered from
 * webcrack output (see ../unpacked/). Versioned against bundle v2153.0.
 */
(function () {
  "use strict";

  const REACT_KEY_PREFIXES = [
    "__reactInternalInstance$", // React 16
    "__reactFiber$",            // React 17/18
    "__reactContainer$",        // React 17/18 root
  ];

  function getStore() {
    if (!window.store) throw new Error("[__lr] window.store not yet available");
    return window.store;
  }

  function findReactRoot() {
    const all = document.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      for (const k of Object.keys(el)) {
        for (const pref of REACT_KEY_PREFIXES) {
          if (k.startsWith(pref)) {
            let fiber = el[k];
            // Climb to top
            let safety = 0;
            while (fiber.return && safety++ < 500) fiber = fiber.return;
            return fiber;
          }
        }
      }
    }
    return null;
  }

  function findClassComponent(predicate) {
    const root = findReactRoot();
    if (!root) return null;
    const stack = [root];
    while (stack.length) {
      const fiber = stack.pop();
      if (!fiber) continue;
      const node = fiber.stateNode;
      if (
        node && typeof node === "object" &&
        node.state && node.props && typeof node.setState === "function"
      ) {
        if (predicate(node)) return node;
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
  }

  function getVideoExporter() {
    return findClassComponent(function (node) {
      const s = node.state;
      return (
        "resolutionOption" in s &&
        "resolutionWidth" in s &&
        "resolutionHeight" in s &&
        "hq" in s
      );
    });
  }

  function delay(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function waitFor(predicate, opts) {
    const timeoutMs = (opts && opts.timeoutMs) || 60000;
    const intervalMs = (opts && opts.intervalMs) || 200;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = predicate();
      if (v) return v;
      await delay(intervalMs);
    }
    throw new Error("[__lr] waitFor timed out after " + timeoutMs + "ms");
  }

  const api = {
    // ---- Redux-only operations ----
    enterEditor: function () {
      getStore().dispatch({
        type: "SET_VIEWS",
        payload: { Main: "editor", Entry: null, TrackLoader: null },
        meta: { name: "ENTER_EDITOR", auto: false },
      });
    },

    loadTrack: function (trackJson) {
      const s = typeof trackJson === "string" ? trackJson : JSON.stringify(trackJson);
      if (typeof window.loadTrackFromString !== "function") {
        throw new Error("[__lr] window.loadTrackFromString not yet available");
      }
      window.loadTrackFromString(s);
    },

    setPlaybackZoom: function (zoom) {
      getStore().dispatch({ type: "SET_PLAYBACK_ZOOM", payload: zoom });
    },

    openVideoExporter: function () {
      getStore().dispatch({
        type: "SET_VIEWS",
        payload: { Sidebar: null, VideoExporter: "export" },
        meta: { name: "OPEN_VIDEO_EXPORTER", auto: false },
      });
    },

    closeVideoExporter: function () {
      getStore().dispatch({
        type: "SET_VIEWS",
        payload: { VideoExporter: null },
        meta: { name: "CLOSE_VIDEO_EXPORTER", auto: false },
      });
    },

    getState: function () {
      return getStore().getState();
    },

    // ---- VideoExporter component-local state (via fiber walk) ----
    waitForVideoExporterReady: async function (opts) {
      return waitFor(function () {
        const inst = getVideoExporter();
        return inst && inst.state.status === "Config" ? inst : null;
      }, opts || { timeoutMs: 30000 });
    },

    setResolution: function (spec) {
      const inst = getVideoExporter();
      if (!inst) throw new Error("[__lr] VideoExporter not mounted; call openVideoExporter() first");
      const update = {};
      if (spec.preset) update.resolutionOption = spec.preset;
      if (spec.width !== undefined) update.resolutionWidth = spec.width;
      if (spec.height !== undefined) update.resolutionHeight = spec.height;
      inst.setState(update);
    },

    setHighQuality: function (hq) {
      const inst = getVideoExporter();
      if (!inst) throw new Error("[__lr] VideoExporter not mounted");
      inst.setState({ hq: !!hq });
    },

    setStartFrom: function (value) {
      // "Beginning" or "Checkpoint"
      const inst = getVideoExporter();
      if (!inst) throw new Error("[__lr] VideoExporter not mounted");
      const flagIndex = inst.props.flagIndex || 0;
      inst.setState({ startFrom: value, index: value === "Checkpoint" ? flagIndex : 0 });
    },

    setEncoderSettings: function (settings) {
      // settings: { kbps?, speed?, quantizationParameter?, groupOfPictures? }
      if (!window.encoderSettings) window.encoderSettings = {};
      Object.assign(window.encoderSettings, settings || {});
    },

    // ---- The render trigger ----
    render: async function (opts) {
      const inst = getVideoExporter();
      if (!inst) throw new Error("[__lr] VideoExporter not mounted; call openVideoExporter() first");
      if (inst.state.status !== "Config") {
        throw new Error("[__lr] expected status=Config, got " + inst.state.status);
      }
      inst.onRenderButtonClick();
      const timeoutMs = (opts && opts.timeoutMs) || 600000;
      await waitFor(function () {
        return inst.state.status === "Postrender" && inst.state.videoUrl ? true : false;
      }, { timeoutMs: timeoutMs, intervalMs: 250 });
      return inst.state.videoUrl;
    },

    // Trigger a real browser download of a blob: URL (so Playwright's
    // page.on('download') can capture it). Returns immediately.
    triggerDownload: function (url, filename) {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "lr-render.mp4";
      document.body.appendChild(a);
      a.click();
      a.remove();
    },

    // ---- High-level convenience: do the full export in one call ----
    exportVideo: async function (opts) {
      const cfg = opts || {};
      const resolution = cfg.resolution || "720p";
      const hq = !!cfg.hq;
      const startFrom = cfg.startFrom || "Beginning";

      this.enterEditor();
      await delay(800);

      if (cfg.track) this.loadTrack(cfg.track);
      await delay(800);

      if (cfg.zoom !== undefined && cfg.zoom !== null) this.setPlaybackZoom(cfg.zoom);

      this.openVideoExporter();
      await this.waitForVideoExporterReady();

      if (resolution === "720p") {
        this.setResolution({ preset: "720p", width: 1280, height: 720 });
      } else if (resolution === "1080p") {
        this.setResolution({ preset: "1080p", width: 1920, height: 1080 });
      } else if (typeof resolution === "object") {
        this.setResolution(Object.assign({ preset: "Custom" }, resolution));
      }
      this.setHighQuality(hq);
      this.setStartFrom(startFrom);
      if (cfg.encoderSettings) this.setEncoderSettings(cfg.encoderSettings);

      await delay(200);
      const url = await this.render({ timeoutMs: cfg.timeoutMs });

      if (cfg.download !== false) {
        this.triggerDownload(url, cfg.filename || "lr-render.mp4");
      }
      return url;
    },
  };

  Object.defineProperty(window, "__lr", { value: api, writable: false, configurable: false });
  console.log("[__lr] helper installed");
})();
