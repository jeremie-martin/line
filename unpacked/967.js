Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = m(require("./0.js"));
var i = require("./15.js");
var o = m(require("./5.js"));
var a = require("./17.js");
var s = m(require("./2.js"));
var l = m(require("./968.js"));
var u = require("./48.js");
var c = require("./81.js");
var d = require("./7.js");
var f = require("./8.js");
var p = require("./125.js");
var h = m(require("./68.js"));
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const y = {
  root: {
    pointerEvents: "none",
    position: "relative",
    width: 42,
    height: 48,
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  offsetTop: {
    height: 36,
    bottom: 8
  },
  button: {
    pointerEvents: "all",
    padding: 0,
    margin: "auto",
    minWidth: 0,
    minHeight: 0,
    width: 20,
    height: 20,
    borderRadius: "50%",
    backgroundColor: e => e.color,
    "&:hover": {
      backgroundColor: e => e.hoverColor,
      "@media (hover: none)": {
        backgroundColor: e => e.color
      }
    },
    "&:disabled": {
      opacity: 0.3,
      "&:hover": {
        backgroundColor: e => e.color
      }
    }
  },
  buttonActive: {
    width: 28,
    height: 28
  }
};
const g = (0, s.default)(e => ({
  transitionButton: {
    transition: e.transitions.create(["width", "height", "opacity"], {
      duration: e.transitions.duration.standard
    })
  }
}))((0, l.default)(y)(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.onClick = () => {
      this.props.onClick(this.props.value);
    };
  }
  render() {
    var e = this.props;
    let t = e.classes;
    let n = e.selected;
    let i = e.disabled;
    let a = e.offsetTop;
    return r.default.createElement("div", {
      className: (0, o.default)(t.root, a && t.offsetTop)
    }, r.default.createElement(p.Button, {
      disabled: i,
      className: (0, o.default)(t.button, t.transitionButton, n && t.buttonActive),
      onClick: this.onClick
    }));
  }
}));
const v = {
  root: {
    height: 28,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0
  }
};
const b = [{
  id: c.SOLID_LINE,
  color: u.blue,
  trackLine: true
}, {
  id: c.ACC_LINE,
  color: u.red,
  trackLine: true
}, {
  id: c.SCENERY_LINE,
  color: u.green,
  trackLine: false
}];
const _ = (0, a.createStructuredSelector)({
  selectedLineType: f.getSelectedLineType,
  trackLinesLocked: f.getTrackLinesLocked
});
const w = {
  selectLineType: d.selectLineType
};
exports.default = (0, i.connect)(_, w)((0, s.default)(v)(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.renderLineTypeSwatch = this.renderLineTypeSwatch.bind(this);
  }
  renderLineTypeSwatch({
    id: e,
    color: t,
    trackLine: n
  }) {
    var i = this.props;
    var o = i.offsetTop;
    let a = o === undefined || o;
    let s = i.selectedLineType;
    let l = i.selectLineType;
    let u = i.trackLinesLocked;
    return r.default.createElement(g, {
      key: e,
      value: e,
      offsetTop: a,
      color: t[500],
      hoverColor: t[700],
      selected: s === e,
      disabled: u && n,
      onClick: l
    });
  }
  render() {
    var e = this.props;
    let t = e.classes;
    var n = e.offsetTop;
    let i = n === undefined || n;
    var o = e.anchor;
    let a = o === undefined ? "bottomCenter" : o;
    var s = e.align;
    let l = s === undefined ? "top" : s;
    let u = e.vertical;
    return r.default.createElement(h.default, {
      anchor: a,
      align: l,
      noMargin: !i,
      classes: i ? t : {},
      vertical: u
    }, b.map(this.renderLineTypeSwatch), this.props.children);
  }
}));
module.exports = exports.default;