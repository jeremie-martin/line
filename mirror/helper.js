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

  // H1: guard against re-eval (devtools snippet, SPA back-nav, double-include).
  // Without this, the Object.defineProperty below throws on the second pass.
  if (window.__lr) {
    console.log("[__lr] already installed, skipping re-init");
    return;
  }

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
      // Status state machine in the bundle:
      //   Loading -> Config -> Rendering -> Postrender -> (Config via reset)
      //   Loading -> LoadError  (terminal: h264-mp4-encoder script failed to load)
      // Auto-reset Postrender to Config: clicking RENDER while in Postrender
      // dispatches a state reset (per VideoExporter.onRenderButtonClick).
      let attemptedReset = false;
      return waitFor(function () {
        const inst = getVideoExporter();
        if (!inst) return null;
        const status = inst.state.status;
        if (status === "Config") return inst;
        if (status === "Postrender" && !attemptedReset) {
          attemptedReset = true;
          console.log("[__lr] auto-resetting Postrender -> Config");
          inst.onRenderButtonClick();
          return null;
        }
        // H4: surface terminal/blocking states explicitly instead of timing out
        if (status === "LoadError") {
          throw new Error("[__lr] VideoExporter status=LoadError — h264-mp4-encoder script failed to load (check unpkg.com / network / CSP)");
        }
        if (status === "Rendering") {
          throw new Error("[__lr] VideoExporter status=Rendering — a previous render is still in progress");
        }
        // status === "Loading" — keep polling
        return null;
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
      if (value === "Beginning") {
        inst.setState({ startFrom: "Beginning", index: 0 });
      } else if (value === "Checkpoint") {
        // H2: use ?? (not ||) so a legitimate flagIndex of 0 isn't collapsed
        // with "no flag set", and error out when no flag exists.
        const flagIndex = inst.props.flagIndex;
        if (flagIndex == null) {
          throw new Error("[__lr] setStartFrom('Checkpoint') but no flag is set in the current track");
        }
        inst.setState({ startFrom: "Checkpoint", index: flagIndex });
      } else {
        throw new Error("[__lr] setStartFrom: value must be 'Beginning' or 'Checkpoint', got " + JSON.stringify(value));
      }
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

      // H5: detect stuck-render. The bundle's render IIFE is unawaited, so an
      // encoder failure leaves status="Rendering" with no progress. Track
      // state.index across polls and bail if it doesn't advance for stallMs.
      const timeoutMs = (opts && opts.timeoutMs) || 600000;
      const stallMs = (opts && opts.stallMs) || 15000;
      const intervalMs = 250;
      const start = Date.now();
      let lastIndex = inst.state.index;
      let lastProgressAt = Date.now();

      while (Date.now() - start < timeoutMs) {
        await delay(intervalMs);
        const status = inst.state.status;

        if (status === "Postrender" && inst.state.videoUrl) {
          return inst.state.videoUrl;
        }
        if (status === "LoadError") {
          throw new Error("[__lr] render failed: status=LoadError (h264 encoder gone)");
        }
        if (status === "Rendering") {
          if (inst.state.index !== lastIndex) {
            lastIndex = inst.state.index;
            lastProgressAt = Date.now();
          } else if (Date.now() - lastProgressAt > stallMs) {
            throw new Error("[__lr] render stuck at frame " + lastIndex + " for " + ((Date.now() - lastProgressAt) / 1000).toFixed(1) + "s (encoder probably threw inside the unawaited render IIFE)");
          }
        } else if (status !== "Postrender") {
          throw new Error("[__lr] unexpected status during render: " + status);
        }
      }
      throw new Error("[__lr] render timed out after " + timeoutMs + "ms (last status=" + inst.state.status + ", last frame=" + lastIndex + ")");
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

      console.log("[__lr] exportVideo start", { resolution: resolution, hq: hq, zoom: cfg.zoom });

      // If the modal is already mounted in Postrender, close it so we restart
      // with a clean component (avoids stale onSave / cameraFollower state).
      const existing = getVideoExporter();
      if (existing && existing.state.status === "Postrender") {
        console.log("[__lr] closing existing Postrender modal");
        this.closeVideoExporter();
        await delay(400);
      }

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
      console.log("[__lr] starting render");
      const url = await this.render({ timeoutMs: cfg.timeoutMs });
      console.log("[__lr] render complete");

      if (cfg.download !== false) {
        this.triggerDownload(url, cfg.filename || "lr-render.mp4");
      }
      return url;
    },
  };

  // Non-writable to catch accidental overwrites; configurable:true so a power
  // user can delete + re-eval the helper from devtools (the guard at the top
  // of this IIFE handles the normal re-eval case).
  Object.defineProperty(window, "__lr", { value: api, writable: false, configurable: true });
  console.log("[__lr] helper installed");
})();
