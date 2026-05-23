Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = m(require("./0.js"));
var i = require("./15.js");
var o = m(require("./2.js"));
var a = m(require("./5.js"));
var s = m(require("./68.js"));
var l = h(require("./22.js"));
var u = require("./171.js");
var c = require("./8.js");
var d = require("./17.js");
var f = h(require("./7.js"));
var p = require("./142.js");
function h(e) {
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
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const y = e => (...t) => n => {
  n(e(...t));
  n(f.commitTrackChanges());
};
const g = y(f.addLayer);
const v = y(f.removeLayer);
const b = y(f.moveLayer);
const _ = y(f.copyLayer);
const w = y(f.renameLayer);
const x = f.setLayerActive;
const E = f.setLayerVisible;
const S = f.setLayerEditable;
const T = y(f.addFolder);
const k = y(f.removeFolder);
const O = y(f.moveFolder);
const P = y(f.renameFolder);
const C = f.setFolderVisible;
const I = f.setFolderEditable;
const M = f.expandFolder;
const L = f.collapseFolder;
const R = (0, i.connect)(null, {
  setLayerActive: x,
  setLayerVisible: E,
  setFolderVisible: C,
  setLayerEditable: S,
  setFolderEditable: I,
  renameLayer: w,
  addLayer: g,
  moveLayer: b,
  copyLayer: _
})((0, o.default)({
  root: {
    alignItems: "center",
    display: "flex",
    height: "30px",
    justifyContent: "space-between",
    padding: 2,
    userSelect: "none",
    "&:hover": {
      backgroundColor: "#eee"
    }
  },
  active: {
    backgroundColor: "#ddd",
    "&:hover": {
      backgroundColor: "#ddd"
    }
  },
  folderHead: {
    border: "2px solid #ccc",
    borderRadius: "5px 5px 0px 0px",
    borderBottom: "none",
    "&:hover": {
      backgroundColor: "#fff"
    }
  },
  insideFolder: {
    borderLeft: "2px solid #ccc",
    borderRight: "2px solid #ccc"
  },
  folderTail: {
    borderBottom: "2px solid #ccc"
  },
  color: {
    width: 24,
    height: 20
  },
  iconButton: {
    width: 24,
    height: 24,
    fontSize: 16
  },
  text: {
    width: 100,
    marginLeft: 6
  },
  actionContainer: {
    alignItems: "center",
    display: "flex"
  }
})(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.isLayer = this.props.layer.type === p.LayerTypes.LAYER;
  }
  render() {
    var e = this.props;
    const t = e.classes;
    const n = e.layer;
    const i = e.index;
    const o = e.active;
    const s = (e, t) => {
      if (this.isLayer) {
        this.props.setLayerEditable(n.id, t);
      } else {
        this.props.setFolderEditable(n.id, t);
      }
      e.stopPropagation();
      e.currentTarget.blur();
    };
    let c;
    let d = n.name;
    if (this.isLayer && /^#[0-9a-fA-F]{6}/.test(d)) {
      c = d.slice(0, 7);
      d = d.slice(7);
    }
    d ||= `New ${n.type == p.LayerTypes.FOLDER ? "Folder" : "Layer"}`;
    const f = this.props.layers.findIndex(e => e.id === n.folderId);
    const h = !this.isLayer;
    const m = this.isLayer && n.folderId !== -1;
    let y = !this.isLayer && (n.size === 0 || this.props.collapsed[n.id]);
    if (m) {
      y = y || f - this.props.layers.get(f).size === i;
    }
    return r.default.createElement("div", {
      className: (0, a.default)(t.root, o && t.active, h && t.folderHead, m && t.insideFolder, y && t.folderTail),
      onClick: () => {
        if (this.isLayer) {
          this.props.setLayerActive(n.id);
        }
      }
    }, c && r.default.createElement("input", {
      type: "color",
      className: t.color,
      value: c,
      onChange: e => this.props.renameLayer(n.id, e.target.value + d)
    }), !this.isLayer && r.default.createElement(u.Typography, {
      onClick: () => this.props.toggleCollapsed(n.id)
    }, this.props.collapsed[n.id] ? r.default.createElement(l.ChevronUp.Button, {
      className: t.iconButton
    }) : r.default.createElement(l.ChevronDown.Button, {
      className: t.iconButton
    })), r.default.createElement(u.Typography, {
      noWrap: true,
      className: t.text
    }, d), r.default.createElement("div", {
      className: t.actionContainer
    }, i > 0 && this.isLayer ? r.default.createElement(l.Copy.Button, {
      classes: {
        root: t.iconButton
      },
      onClick: () => this.props.copyLayer(n.id)
    }) : r.default.createElement(l.Copy.Button, {
      classes: {
        root: t.iconButton
      },
      disabled: true
    }), r.default.createElement("input", {
      id: "Check" + n.id,
      type: "checkbox",
      checked: n.visible,
      onClick: e => {
        e.stopPropagation();
        e.currentTarget.blur();
      },
      onChange: () => {
        if (this.isLayer) {
          this.props.setLayerVisible(n.id, !n.visible);
        } else {
          this.props.setFolderVisible(n.id, !n.visible);
        }
      }
    }), !n.editable && r.default.createElement(l.Lock.Button, {
      classes: {
        root: t.iconButton
      },
      style: {
        color: "#0075FF"
      },
      onClick: e => s(e, true)
    }), n.editable && r.default.createElement(l.Unlock.Button, {
      classes: {
        root: t.iconButton
      },
      style: {
        color: "gray"
      },
      onClick: e => s(e, false)
    })));
  }
}));
const A = (0, i.connect)(null, {
  removeLayer: v,
  removeFolder: k,
  renameLayer: w,
  renameFolder: P
})((0, o.default)({
  root: {
    display: "flex",
    justifyContent: "end",
    padding: 2,
    userSelect: "none",
    height: "30px"
  },
  folderHead: {
    border: "2px solid #ccc",
    borderRadius: "5px 5px 0px 0px",
    borderBottom: "none",
    "&:hover": {
      backgroundColor: "#fff"
    }
  },
  insideFolder: {
    borderLeft: "2px solid #ccc",
    borderRight: "2px solid #ccc"
  },
  folderTail: {
    borderBottom: "2px solid #ccc"
  },
  textInput: {
    width: 120
  },
  iconButton: {
    width: 24,
    height: 24,
    fontSize: 16
  },
  draggableIconButton: {
    width: 24,
    height: 24,
    fontSize: 16,
    cursor: "grab"
  }
})(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.isLayer = this.props.layer.type === p.LayerTypes.LAYER;
    this.onRef = e => {
      this.ref = e;
    };
    this.onBlur = (e = "") => {
      if (this.isLayer) {
        this.props.renameLayer(this.props.layer.id, e + this.ref.value);
      } else {
        this.props.renameFolder(this.props.layer.id, this.ref.value);
      }
    };
    this.onKeyUp = e => {
      if (e.key === "Enter" || e.key === "Escape") {
        this.ref.blur();
      }
    };
  }
  render() {
    var e = this.props;
    const t = e.classes;
    const n = e.layer;
    const i = e.index;
    const o = e.dragIndex;
    const s = e.dropIndex;
    const u = n.id === 0;
    let c;
    if (s == i && s > 0) {
      c = {
        borderBottom: s < o && "2px solid black",
        borderTop: s > o && "2px solid black"
      };
    }
    let d;
    let f = n.name;
    if (this.isLayer && /^#[0-9a-fA-F]{6}/.test(f)) {
      d = f.slice(0, 7);
      f = f.slice(7);
    }
    const h = this.props.layers.findIndex(e => e.id === n.folderId);
    const m = !this.isLayer;
    const y = this.isLayer && n.folderId !== -1;
    let g = !this.isLayer && (n.size === 0 || this.props.collapsed[n.id]);
    if (y) {
      g = g || h - this.props.layers.get(h).size === i;
    }
    return r.default.createElement("div", {
      onDragEnter: e => e.preventDefault(),
      onDragOver: this.props.onDragOver,
      onDragEnd: this.props.onDragEnd,
      style: c,
      className: (0, a.default)(t.root, m && t.folderHead, y && t.insideFolder, g && t.folderTail)
    }, r.default.createElement("b", null, n.id), r.default.createElement(l.VerticalDrag.Button, {
      classes: {
        root: t.draggableIconButton
      },
      disabled: u,
      draggable: true,
      onDragStart: this.props.onDragStart
    }), r.default.createElement("input", {
      id: "Text" + n.id,
      ref: this.onRef,
      onBlur: () => this.onBlur(d),
      onKeyUp: this.onKeyUp,
      className: t.textInput,
      type: "text",
      defaultValue: f || "",
      disabled: u,
      placeholder: `New ${n.type == p.LayerTypes.FOLDER ? "Folder" : "Layer"}`
    }), r.default.createElement(l.Minus.Button, {
      classes: {
        root: t.iconButton
      },
      disabled: u,
      onClick: () => {
        if (this.isLayer) {
          this.props.removeLayer(n.id);
        } else {
          this.props.removeFolder(n.id);
        }
      }
    }));
  }
}));
exports.default = (0, i.connect)((0, d.createStructuredSelector)({
  layers: c.getTrackLayers,
  activeLayerId: c.getTrackActiveLayerId,
  collapsedFolders: c.getCollapsedFolders
}), {
  addLayer: g,
  addFolder: T,
  moveLayer: b,
  moveFolder: O,
  expandFolder: M,
  collapseFolder: L
})((0, o.default)({
  root: {},
  list: {
    marginLeft: 6,
    marginRight: 6,
    marginBottom: 6,
    maxHeight: "calc(100vh - 450px);",
    overflowY: "scroll"
  },
  title: {
    alignItems: "center",
    display: "flex",
    justifyContent: "flex-end"
  },
  iconButton: {
    width: 24,
    height: 24,
    margin: 3
  }
})(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.state = {
      collapsed: [],
      editing: false,
      dragIndex: -1,
      dropIndex: -1
    };
    this.toggleCollapsed = e => {
      const t = [...this.state.collapsed];
      if (t[e] === undefined) {
        t[e] = true;
      } else {
        delete t[e];
      }
      if (this.props.collapsedFolders.has(e)) {
        this.props.expandFolder(e);
      } else {
        this.props.collapseFolder(e);
      }
      this.setState({
        collapsed: t
      });
    };
    this.handleDragStart = e => {
      this.setState({
        dragIndex: e,
        dropIndex: e
      });
    };
    this.handleDragOver = (e, t) => {
      if (t > 0) {
        e.preventDefault();
      }
      const n = [...this.props.layers];
      if (n[this.state.dragIndex].type !== p.LayerTypes.FOLDER) {
        this.setState({
          dropIndex: t
        });
        return;
      }
      const r = n.findIndex((e, n) => n >= t && e.type === p.LayerTypes.FOLDER);
      if (r === -1) {
        this.setState({
          dropIndex: t
        });
        return;
      }
      const i = r - n[r].size;
      const o = r;
      if (this.state.dragIndex < t && i <= t && t < o) {
        this.setState({
          dropIndex: -1
        });
      } else if (this.state.dragIndex > t && i < t && t <= o) {
        this.setState({
          dropIndex: -1
        });
      } else {
        this.setState({
          dropIndex: t
        });
      }
    };
    this.handleDragEnd = () => {
      var e = this.state;
      const t = e.dragIndex;
      const n = e.dropIndex;
      if (t > 0 && n > 0 && n !== t) {
        const e = [...this.props.layers][t];
        if (e.type === p.LayerTypes.LAYER) {
          this.props.moveLayer(e.id, n);
        } else {
          this.props.moveFolder(e.id, n);
        }
      }
      this.setState({
        dragIndex: -1,
        dropIndex: -1
      });
    };
    this.onToggleOpen = () => {
      if (!!this.props.open && this.state.editing) {
        this.setState({
          editing: false
        });
      }
      this.props.onToggle();
    };
    this.onToggleEdit = () => {
      this.setState(({
        editing: e
      }) => ({
        editing: !e
      }));
    };
  }
  componentDidMount() {
    const e = [...this.state.collapsed];
    for (let t of [...this.props.collapsedFolders]) {
      e[t] = true;
    }
    this.setState({
      collapsed: e
    });
  }
  render() {
    var e = this.props;
    let t = e.open;
    let n = e.classes;
    let i = e.children;
    let o = e.layers;
    let a = e.activeLayerId;
    const c = this.state.editing;
    return r.default.createElement(s.default, {
      anchor: "topRight",
      vertical: true
    }, r.default.createElement("div", {
      className: n.root
    }, r.default.createElement("div", {
      className: n.title
    }, c && r.default.createElement(l.FolderPlus.Button, {
      className: n.iconButton,
      onClick: () => this.props.addFolder()
    }), c && r.default.createElement(l.Plus.Button, {
      className: n.iconButton,
      onClick: () => this.props.addLayer()
    }), r.default.createElement(u.Collapse, {
      in: t
    }, r.default.createElement(l.Pencil.Button, {
      onClick: this.onToggleEdit,
      color: c ? "primary" : ""
    })), r.default.createElement(l.Layers.Button, {
      onClick: this.onToggleOpen,
      color: t ? "primary" : ""
    })), r.default.createElement(u.Collapse, {
      in: t
    }, r.default.createElement("div", {
      className: n.list
    }, o.toArray().map((e, t) => (e.type !== p.LayerTypes.LAYER || !this.state.collapsed[e.folderId]) && (c ? r.default.createElement(A, {
      key: e.id * 2 + e.type,
      index: t,
      layer: e,
      layers: o,
      dragIndex: this.state.dragIndex,
      dropIndex: this.state.dropIndex,
      onDragStart: () => this.handleDragStart(t),
      onDragOver: e => this.handleDragOver(e, t),
      onDragEnd: () => this.handleDragEnd(),
      collapsed: this.state.collapsed,
      toggleCollapsed: this.toggleCollapsed
    }) : r.default.createElement(R, {
      key: e.id * 2 + e.type,
      index: t,
      layer: e,
      layers: o,
      active: a === e.id && e.type !== p.LayerTypes.FOLDER,
      collapsed: this.state.collapsed,
      toggleCollapsed: this.toggleCollapsed
    }))).reverse()))), i);
  }
}));
module.exports = exports.default;