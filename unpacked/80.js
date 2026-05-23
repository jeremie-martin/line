Object.defineProperty(exports, "__esModule", {
  value: true
});
const r = exports.Main = "Main";
const i = exports.Sidebar = "Sidebar";
const o = exports.Entry = "Entry";
const a = exports.TrackLoader = "TrackLoader";
const s = exports.TrackSaver = "TrackSaver";
const l = exports.VideoExporter = "VideoExporter";
const u = exports.ReleaseNotes = "ReleaseNotes";
const c = exports.About = "About";
const d = [r, i, o, a, s, u, c];
exports.viewsToPath = e => d.reduce((t, n) => e[n] ? `${t}/${e[n]}` : t, "");
exports.Pages = {
  [r]: {
    Editor: "editor",
    Viewer: "viewer",
    EditableViewer: "editable-viewer"
  },
  [i]: {
    Share: "share",
    Info: "info",
    Settings: "settings",
    Help: "help",
    Mods: "mods"
  },
  [o]: {
    Launch: "launch",
    Loading: "loading"
  },
  [a]: {
    Load: "load"
  },
  [s]: {
    Save: "save"
  },
  [l]: {
    Export: "export"
  },
  [u]: {
    Notes: "notes"
  },
  [c]: {
    Notes: "notes"
  }
};