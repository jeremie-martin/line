Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.closeAboutPage = exports.openAboutPage = exports.closeReleaseNotes = exports.openReleaseNotes = exports.closeVideoExporter = exports.openVideoExporter = exports.openSidebarSharePage = exports.closeTrackSaver = exports.openTrackSaver = exports.switchFromTrackLoaderToEditor = exports.closeTrackLoader = exports.openTrackLoader = exports.openInfoSidebar = exports.openHelpSidebar = exports.openSettingsSidebar = exports.enterEditor = exports.closeLoadScreen = exports.enterEditableViewer = exports.enterViewer = exports.closeSidebar = exports.setSidebarPage = exports.setViews = exports.openTutorial = exports.OPEN_TUTORIAL = exports.SET_VIEWS = undefined;
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
const i = r.Pages;
const o = exports.SET_VIEWS = "SET_VIEWS";
const a = exports.OPEN_TUTORIAL = "OPEN_TUTORIAL";
exports.openTutorial = e => ({
  type: a,
  payload: e
});
const s = exports.setViews = (e, t, n = false) => ({
  type: o,
  payload: t,
  meta: {
    name: e,
    auto: n
  }
});
exports.setSidebarPage = e => s("SET_SIDEBAR_PAGE", {
  [r.Sidebar]: e
});
exports.closeSidebar = e => s("CLOSE_SIDEBAR", {
  [r.Sidebar]: null
}, e);
exports.enterViewer = e => s("ENTER_VIEWER", {
  [r.Main]: i.Main.Viewer,
  [r.Entry]: i.Entry.Loading
}, e);
exports.enterEditableViewer = e => s("ENTER_EDITABLE_VIEWER", {
  [r.Main]: i.Main.EditableViewer,
  [r.Entry]: i.Entry.Loading
}, e);
exports.closeLoadScreen = e => s("CLOSE_LOAD_SCREEN", {
  [r.Entry]: null
}, e);
exports.enterEditor = () => s("ENTER_EDITOR", {
  [r.Main]: i.Main.Editor,
  [r.Entry]: null,
  [r.TrackLoader]: null
});
exports.openSettingsSidebar = e => s("OPEN_SETTING_SIDEBAR", {
  [r.Sidebar]: i.Sidebar.Settings
}, e);
exports.openHelpSidebar = e => s("OPEN_HELP_SIDEBAR", {
  [r.Sidebar]: i.Sidebar.Help
}, e);
exports.openInfoSidebar = e => s("OPEN_INFO_SIDEBAR", {
  [r.Sidebar]: i.Sidebar.Info
}, e);
exports.openTrackLoader = () => s("OPEN_TRACK_LOADER", {
  [r.Sidebar]: null,
  [r.TrackLoader]: i.TrackLoader.Load
});
exports.closeTrackLoader = () => s("CLOSE_TRACK_LOADER", {
  [r.TrackLoader]: null
});
exports.switchFromTrackLoaderToEditor = () => s("SWITCH_FROM_TRACK_LOADER_TO_EDITOR", {
  [r.Main]: i.Main.Editor,
  [r.TrackLoader]: null,
  [r.Entry]: null
});
exports.openTrackSaver = () => s("OPEN_TRACK_SAVER", {
  [r.Sidebar]: null,
  [r.TrackSaver]: i.TrackSaver.Save
});
exports.closeTrackSaver = () => s("CLOSE_TRACK_SAVER", {
  [r.TrackSaver]: null
});
exports.openSidebarSharePage = () => s("OPEN_SIDEBAR_SHARE_PAGE", {
  [r.Sidebar]: i.Sidebar.Share
});
exports.openVideoExporter = () => s("OPEN_VIDEO_EXPORTER", {
  [r.Sidebar]: null,
  [r.VideoExporter]: i.VideoExporter.Export
});
exports.closeVideoExporter = () => s("CLOSE_VIDEO_EXPORTER", {
  [r.VideoExporter]: null
});
exports.openReleaseNotes = () => s("OPEN_RELEASE_NOTES", {
  [r.ReleaseNotes]: i.ReleaseNotes.Notes
});
exports.closeReleaseNotes = () => s("CLOSE_RELEASE_NOTES", {
  [r.ReleaseNotes]: null
});
exports.openAboutPage = () => s("OPEN_ABOUT_PAGE", {
  [r.About]: i.About.Notes
});
exports.closeAboutPage = () => s("CLOSE_ABOUT_PAGE", {
  [r.About]: null
});