Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getModsEnabled = exports.getHasOverlay = exports.getInVideoExporter = exports.getInTrackLoader = exports.getInTrackSaver = exports.getInViewer = exports.getInEditor = exports.getPageRoute = exports.getMainPage = exports.getSidebarPage = exports.getViews = undefined;
var r = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./80.js"));
const i = exports.getViews = e => e.views;
exports.getSidebarPage = e => i(e)[r.Sidebar];
exports.getMainPage = e => i(e)[r.Main];
exports.getPageRoute = e => r.viewsToPath(e.views);
exports.getInEditor = e => e.views[r.Main] === r.Pages.Main.Editor;
exports.getInViewer = e => e.views[r.Main] === r.Pages.Main.Viewer || e.views[r.Main] === r.Pages.Main.EditableViewer;
exports.getInTrackSaver = e => e.views[r.TrackSaver] === r.Pages.TrackSaver.Save;
exports.getInTrackLoader = e => e.views[r.TrackLoader] === r.Pages.TrackLoader.Load;
exports.getInVideoExporter = e => e.views[r.VideoExporter] === r.Pages.VideoExporter.Export;
exports.getHasOverlay = e => e.views[r.Entry] || e.views[r.TrackLoader] || e.views[r.TrackSaver] || e.views[r.VideoExporter] || e.views[r.ReleaseNotes] || e.views[r.About];
exports.getModsEnabled = e => e.settings["views.modsEnabled"];