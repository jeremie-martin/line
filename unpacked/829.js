Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = S(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = E(require("./27.js"));
var s = require("./80.js");
var l = require("./8.js");
var u = require("./7.js");
var c = require("./151.js");
var d = require("./29.js");
var f = require("./113.js");
var p = E(require("./22.js"));
var h = S(require("./170.js"));
var m = E(require("./830.js"));
var y = S(require("./1004.js"));
var g = require("./35.js");
var v = require("./39.js");
var b = require("./260.js");
var _ = require("./209.js");
var w = S(require("./315.js"));
var x = require("./26.js");
require("./171.js");
function E(e) {
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
}
function S(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const T = {
  New: {
    name: "New",
    Icon: p.File,
    action: () => (e, t) => {
      if ((0, l.getTrackIsDirty)(t())) {
        if (!window.confirm("Are you sure you want to make a new track? You have unsaved changes.")) {
          return;
        }
      }
      e((0, u.closeSidebar)());
      e((0, u.newTrack)());
      if (!(0, l.getInEditor)(t())) {
        window.history.pushState("", document.title, "/");
        e((0, u.enterEditor)());
      }
    }
  },
  Edit: {
    name: "Edit",
    Icon: p.Pencil,
    action: () => e => {
      e((0, u.editCopy)());
      e((0, u.closeSidebar)());
      e((0, u.enterEditor)());
      e((0, f.setEditorCameraToStart)());
      window.history.pushState("", document.title, "/");
    }
  },
  Load: {
    name: "Load",
    Icon: p.Load,
    trigger: "triggers.open",
    selected: e => (0, l.getInTrackLoader)(e)
  },
  Save: {
    name: "Save",
    Icon: p.Save,
    trigger: "triggers.save",
    action: () => (e, t) => {
      if ((0, l.getTrackIsEmpty)(t())) {
        e((0, d.showNotification)("There is nothing to save!"));
      } else {
        e((0, u.openTrackSaver)());
      }
    },
    selected: e => (0, l.getInTrackSaver)(e),
    disabled: e => (0, c.getTrackSaverInProgress)(e)
  },
  Info: {
    name: "Info",
    Icon: p.Information,
    action: () => (0, u.setSidebarPage)(s.Pages.Sidebar.Info),
    selected: e => (0, l.getSidebarPage)(e) === s.Pages.Sidebar.Info
  },
  VideoExport: {
    name: "Video Export",
    Icon: p.Video,
    selected: e => (0, l.getInVideoExporter)(e),
    action: u.openVideoExporter
  },
  Settings: {
    name: "Settings",
    Icon: p.Settings,
    action: () => (0, u.setSidebarPage)(s.Pages.Sidebar.Settings),
    selected: e => (0, l.getSidebarPage)(e) === s.Pages.Sidebar.Settings
  },
  Help: {
    name: "Help",
    Icon: p.HelpCircle,
    action: () => (0, u.setSidebarPage)(s.Pages.Sidebar.Help),
    selected: e => (0, l.getSidebarPage)(e) === s.Pages.Sidebar.Help
  },
  Mods: {
    name: "Mods",
    Icon: p.Script,
    action: () => (0, u.setSidebarPage)(s.Pages.Sidebar.Mods),
    selected: e => (0, l.getSidebarPage)(e) === s.Pages.Sidebar.Mods
  },
  Select: {
    Icon: p.Cursor,
    trigger: "triggers.selectTool",
    selected: e => (0, l.getSelectedTool)(e) === a.SELECT_TOOL,
    hideWhenSmall: true
  },
  Pencil: {
    Icon: p.Pencil,
    trigger: "triggers.pencilTool",
    selected: e => (0, l.getSelectedTool)(e) === a.PENCIL_TOOL
  },
  Line: {
    Icon: p.Line,
    trigger: "triggers.lineTool",
    selected: e => (0, l.getSelectedTool)(e) === a.LINE_TOOL
  },
  Eraser: {
    Icon: p.Eraser,
    trigger: "triggers.eraserTool",
    selected: e => (0, l.getSelectedTool)(e) === a.ERASER_TOOL
  },
  Pan: {
    Icon: p.Pan,
    trigger: "triggers.panTool",
    selected: e => (0, l.getSelectedTool)(e) === a.PAN_TOOL
  },
  Zoom: {
    Icon: p.Magnify,
    trigger: "triggers.zoomTool",
    selected: e => (0, l.getSelectedTool)(e) === a.ZOOM_TOOL
  },
  ZoomSlider: {
    Icon: p.Magnify,
    modifier: "modifiers.zoom",
    disableRipple: true
  },
  ZoomSliderUpArrow: {
    Icon: p.ChevronUp,
    disabled: () => true
  },
  ZoomSliderDownArrow: {
    Icon: p.ChevronDown,
    disabled: () => true
  },
  ZoomSliderPlus: {
    Icon: p.MagnifyPlus,
    disabled: () => true
  },
  ZoomSliderMinus: {
    Icon: p.MagnifyMinus,
    disabled: () => true
  },
  Rewind: {
    Icon: p.Rewind,
    modifier: "modifiers.rewind"
  },
  Play: {
    Icon: p.Play,
    trigger: "triggers.play",
    selected: e => (0, l.getPlayerRunning)(e)
  },
  Pause: {
    Icon: p.Pause,
    trigger: "triggers.pause",
    selected: e => !(0, l.getPlayerRunning)(e)
  },
  PlayPause: {
    Icon: p.Play,
    trigger: "triggers.playPause",
    selected: e => (0, l.getPlayerRunning)(e),
    selectedIcon: p.Pause
  },
  Stop: {
    Icon: p.Stop,
    trigger: "triggers.stop"
  },
  FastForward: {
    Icon: p.FastForward,
    modifier: "modifiers.fastForward"
  },
  Flag: {
    Icon: p.FlagVariant,
    trigger: "triggers.flag",
    selected: e => (0, l.getPlayerFlagActive)(e)
  },
  SlowMotion: {
    Icon: p.SlowMotion,
    trigger: "triggers.toggleSlowMotion",
    selected: e => (0, l.getPlayerSlowMotion)(e)
  },
  OnionSkin: {
    Icon: p.OnionSkin,
    trigger: "triggers.toggleOnionSkin",
    selected: e => (0, l.getOnionSkinActive)(e)
  },
  Undo: {
    Icon: p.Undo,
    modifier: "modifiers.undo",
    disabled: e => !(0, l.getSimulatorHasUndo)(e)
  },
  Redo: {
    Icon: p.Redo,
    modifier: "modifiers.redo",
    disabled: e => !(0, l.getSimulatorHasRedo)(e)
  },
  Magnet: {
    Icon: p.Magnet,
    action: () => (0, v.toggleModifierCommand)("modifiers.disablePointSnap"),
    selected: e => !(0, g.getModifier)(e, "modifiers.disablePointSnap")
  },
  AngleSnap: {
    Icon: p.AngleSnap,
    action: () => (0, v.toggleModifierCommand)("modifiers.angleSnap"),
    selected: e => (0, g.getModifier)(e, "modifiers.angleSnap")
  },
  AngleLock: {
    Icon: p.AngleLock,
    action: () => (0, v.toggleModifierCommand)("modifiers.angleLock"),
    selected: e => (0, g.getModifier)(e, "modifiers.angleLock")
  },
  LineFlip: {
    Icon: p.LineFlip,
    action: () => (0, v.toggleModifierCommand)("modifiers.flipLine"),
    selected: e => (0, g.getModifier)(e, "modifiers.flipLine")
  },
  Copy: {
    Icon: p.Copy,
    trigger: "triggers.select.copy",
    disabled: e => !(0, b.hasSelection)(e)
  },
  Paste: {
    Icon: p.Paste,
    trigger: "triggers.select.paste",
    disabled: e => !(0, b.hasClipboard)(e)
  },
  Delete: {
    Icon: p.Delete,
    trigger: "triggers.removeLastLine",
    disabled: e => !(0, b.hasSelection)(e)
  },
  Brush: {
    Icon: p.Brush,
    action: () => (0, v.toggleModifierCommand)("modifiers.smoothPencil"),
    selected: e => (0, g.getModifier)(e, "modifiers.smoothPencil")
  },
  Hint: {
    Icon: p.Lightbulb,
    action: _.showHint,
    pulsating: true,
    tooltip: e => e.hint.queue.length > 0 && e.hint.queue[0].tooltip
  },
  Upgrade: {
    name: "Upgrade",
    Icon: p.Shopping,
    color: "secondary",
    pulsating: true,
    action: () => (0, x.dispatchToDevice)("requestUpgrade")
  }
};
p.Menu;
T.Save;
T.Load;
T.New;
T.Settings;
T.Help;
T.Info;
p.Menu;
T.Save;
T.Load;
T.New;
T.Settings;
T.Help;
T.Upgrade;
const k = {
  [s.Pages.Main.Editor]: {
    menu: {
      collapsible: true,
      items: [T.New, T.Load, T.Save, T.VideoExport, T.Settings, T.Help, T.Info, T.Mods]
    },
    toolbar: {
      items: [T.Pencil, T.Line, T.Eraser, T.Select, ...[T.Pan, T.Zoom]]
    },
    history: {
      items: [T.Undo, T.Redo]
    },
    toolOptions: {
      [a.PENCIL_TOOL]: [T.LineFlip, T.Magnet, T.Brush],
      [a.LINE_TOOL]: [T.LineFlip, T.Magnet, T.AngleSnap],
      [a.SELECT_TOOL]: [T.Magnet, T.AngleLock, T.Copy, T.Paste, T.Delete]
    },
    lineCount: true,
    transport: {
      advancedTimeline: true,
      items: [T.Rewind, T.Play, T.Pause, T.Stop, T.FastForward, T.Flag, T.SlowMotion, T.OnionSkin]
    },
    layers: true
  },
  [s.Pages.Main.Viewer]: {
    menu: {
      collapsible: false,
      items: [T.Info, T.New]
    },
    toolbar: {
      items: [T.Pan, T.Zoom]
    },
    lineCount: false,
    transport: {
      advancedTimeline: false,
      items: [T.Play, T.Pause, T.SlowMotion]
    }
  },
  [s.Pages.Main.EditableViewer]: {
    menu: {
      collapsible: false,
      items: [T.Info, T.Edit, T.New]
    },
    toolbar: {
      items: [T.Pan, T.Zoom]
    },
    lineCount: false,
    transport: {
      advancedTimeline: false,
      items: [T.Play, T.Pause, T.SlowMotion]
    }
  }
};
const O = (0, o.createStructuredSelector)({
  inTrialMode: e => e.license.trial,
  showPhysicsStats: e => e.renderer.skeleton,
  settings: e => e.settings,
  zoomSliderActive: g.getZoomSliderActive,
  dimensions: l.getEditorDimensions,
  controlsActive: l.getControlsActive,
  running: l.getPlayerRunning,
  lineTypePickerActive: l.getLineTypePickerActive,
  selectedTool: l.getSelectedTool,
  widgets: e => k[(0, l.getMainPage)(e)],
  numHints: e => e.hint.queue.length,
  hintVisible: e => e.hint.visible,
  modsEnabled: l.getModsEnabled,
  enabledSettings: l.getEnabledSettings,
  onModSidebar: e => (0, l.getSidebarPage)(e) === s.Pages.Sidebar.Mods
});
const P = {
  closeSidebar: u.closeSidebar
};
exports.default = (0, i.connect)(O, P)(class extends r.default.Component {
  constructor(e) {
    super(e);
    this.state = {
      menuOpen: true,
      layerOpen: false
    };
    this.onMenuToggle = () => {
      if (this.state.menuOpen) {
        this.props.closeSidebar();
      }
      this.setState(e => ({
        menuOpen: !e.menuOpen
      }));
    };
    this.onLayerToggle = () => {
      this.setState(({
        layerOpen: e
      }) => ({
        layerOpen: !e
      }));
    };
  }
  render() {
    var e = this.props;
    e.inTrialMode;
    let t = e.showPhysicsStats;
    e.zoomSliderActive;
    e.dimensions;
    let n = e.running;
    let i = e.controlsActive;
    let o = e.lineTypePickerActive;
    let s = e.selectedTool;
    var l = e.widgets;
    let u;
    let c = l.menu;
    let d = l.toolbar;
    let f = l.transport;
    let p = l.layers;
    e.numHints;
    e.hintVisible;
    let g = e.modsEnabled;
    let v = e.enabledSettings;
    let b = t && r.default.createElement(w.default, null);
    u = !n && p ? r.default.createElement(m.LayerWidget, {
      open: this.state.layerOpen,
      onToggle: this.onLayerToggle
    }, b) : r.default.createElement("div", {
      style: {
        position: "absolute",
        top: 0,
        right: 0
      }
    }, b);
    return r.default.createElement(h.default, null, i && r.default.createElement(m.TransportWidget, f), u, !n && r.default.createElement(m.ToolbarWidget, {
      items: d.items
    }, r.default.createElement(h.default, null, s === a.PENCIL_TOOL && r.default.createElement(m.ToolbarWidget, {
      items: [T.Brush],
      align: "right",
      anchor: "centerLeft",
      noMargin: true
    }), o && r.default.createElement(m.LinePropPickerWidget, null))), r.default.createElement(y.default, {
      visible: !n,
      headerChildren: this.props.onModSidebar && null
    }), !n && r.default.createElement(m.MenuWidget, {
      collapsible: c.collapsible,
      items: c.items.filter(e => e.name !== "Mods" || !!g),
      open: this.state.menuOpen,
      onToggle: this.onMenuToggle
    }), !n && g && v.length > 0 && r.default.createElement(m.ModWidget, null));
  }
});
module.exports = exports.default;