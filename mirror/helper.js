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

  function getWebGLInfo(canvas) {
    const c = canvas || document.createElement("canvas");
    const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
    if (!gl) return { ok: false };
    const dbg = gl.getExtension && gl.getExtension("WEBGL_debug_renderer_info");
    return {
      ok: true,
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
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

  function hashString(h, value) {
    const s = String(value);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function lineNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(3) : "NaN";
  }

  function plainLine(line) {
    const src = line && typeof line.toJSON === "function" ? line.toJSON() : line;
    return {
      id: src && src.id,
      type: src && src.type,
      x1: src && src.x1,
      y1: src && src.y1,
      x2: src && src.x2,
      y2: src && src.y2,
      flipped: !!(src && src.flipped),
      leftExtended: !!(src && src.leftExtended),
      rightExtended: !!(src && src.rightExtended),
      layer: src && src.layer == null ? 0 : src && src.layer,
    };
  }

  function trackFingerprintFromLines(lines) {
    const normalized = (lines || []).map(plainLine).sort(function (a, b) {
      const ai = Number(a.id);
      const bi = Number(b.id);
      if (ai !== bi) return ai - bi;
      return String(a.type).localeCompare(String(b.type));
    });
    let h = 2166136261;
    for (const line of normalized) {
      h = hashString(h, [
        line.id,
        line.type,
        lineNumber(line.x1),
        lineNumber(line.y1),
        lineNumber(line.x2),
        lineNumber(line.y2),
        line.flipped ? 1 : 0,
        line.leftExtended ? 1 : 0,
        line.rightExtended ? 1 : 0,
        line.layer,
      ].join(","));
      h = hashString(h, ";");
    }
    return {
      lineCount: normalized.length,
      lineHash: (h >>> 0).toString(36),
    };
  }

  function trackFingerprint(trackJson) {
    const track = typeof trackJson === "string" ? JSON.parse(trackJson) : (trackJson || {});
    return Object.assign(trackFingerprintFromLines(track.lines || []), {
      label: track.label || "",
    });
  }

  function loadedTrackFingerprint() {
    const state = getStore().getState();
    const lines = window.Selectors && typeof window.Selectors.getSimulatorLines === "function"
      ? window.Selectors.getSimulatorLines()
      : [];
    return Object.assign(trackFingerprintFromLines(lines), {
      label: state.trackData && state.trackData.label || "",
    });
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

    waitForTrackLoaded: async function (trackJson, opts) {
      const expected = trackFingerprint(trackJson);
      const loaded = await waitFor(function () {
        const actual = loadedTrackFingerprint();
        return actual.lineCount === expected.lineCount && actual.lineHash === expected.lineHash
          ? actual
          : null;
      }, opts || { timeoutMs: 120000, intervalMs: 100 });
      console.log("[__lr] track loaded", loaded);
      return loaded;
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

    waitForVideoExporterRenderSurface: async function (opts) {
      const expected = opts && opts.resolution;
      return waitFor(function () {
        const inst = getVideoExporter();
        if (!inst) return null;
        if (inst.props && inst.props.hardwareAcceleration === false) {
          const info = getWebGLInfo();
          if (!info.ok) {
            throw new Error("[__lr] WebGL unavailable in this Chromium session; VideoExporter cannot mount a render canvas");
          }
          return null;
        }
        if (expected) {
          if (inst.state.resolutionWidth !== expected.width || inst.state.resolutionHeight !== expected.height) {
            return null;
          }
        }
        const canvas = inst.canvas;
        if (!canvas || typeof canvas.getContext !== "function") return null;
        if (expected && (canvas.width !== expected.width || canvas.height !== expected.height)) return null;
        const info = getWebGLInfo(canvas);
        if (!info.ok) {
          throw new Error("[__lr] VideoExporter render canvas has no WebGL context");
        }
        return inst;
      }, opts || { timeoutMs: 30000, intervalMs: 100 });
    },

    // ---- The render trigger ----
    render: async function (opts) {
      const inst = getVideoExporter();
      if (!inst) throw new Error("[__lr] VideoExporter not mounted; call openVideoExporter() first");
      if (inst.state.status !== "Config") {
        throw new Error("[__lr] expected status=Config, got " + inst.state.status);
      }
      if (!inst.canvas || typeof inst.canvas.getContext !== "function") {
        throw new Error("[__lr] VideoExporter render canvas not mounted; call waitForVideoExporterRenderSurface() first");
      }
      const info = getWebGLInfo(inst.canvas);
      if (!info.ok) {
        throw new Error("[__lr] VideoExporter render canvas has no WebGL context");
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

      if (cfg.track) {
        this.loadTrack(cfg.track);
        await this.waitForTrackLoaded(cfg.track);
      } else {
        await delay(800);
      }

      if (cfg.zoom !== undefined && cfg.zoom !== null) this.setPlaybackZoom(cfg.zoom);

      this.openVideoExporter();
      await this.waitForVideoExporterReady();

      let expectedResolution = null;
      if (resolution === "720p") {
        expectedResolution = { width: 1280, height: 720 };
        this.setResolution({ preset: "720p", width: 1280, height: 720 });
      } else if (resolution === "1080p") {
        expectedResolution = { width: 1920, height: 1080 };
        this.setResolution({ preset: "1080p", width: 1920, height: 1080 });
      } else if (typeof resolution === "object") {
        expectedResolution = { width: resolution.width, height: resolution.height };
        this.setResolution(Object.assign({ preset: "Custom" }, resolution));
      }
      this.setHighQuality(hq);
      this.setStartFrom(startFrom);
      if (cfg.encoderSettings) this.setEncoderSettings(cfg.encoderSettings);

      if (expectedResolution) {
        await this.waitForVideoExporterRenderSurface({ resolution: expectedResolution, timeoutMs: 30000, intervalMs: 100 });
      } else {
        await this.waitForVideoExporterRenderSurface({ timeoutMs: 30000, intervalMs: 100 });
      }
      await delay(100);
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
