Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./0.js"));
var i = s(require("./5.js"));
var o = s(require("./2.js"));
var a = require("./114.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const l = {
  topLeft: e => ({
    top: e,
    left: e
  }),
  topRight: e => ({
    top: e,
    right: e
  }),
  bottomLeft: e => ({
    bottom: e,
    left: e
  }),
  bottomRight: e => ({
    bottom: e,
    right: e
  }),
  topCenter: e => ({
    top: e,
    left: "50%",
    translateX: "-50%"
  }),
  bottomCenter: e => ({
    bottom: e,
    left: "50%",
    translateX: "-50%"
  }),
  centerLeft: e => ({
    top: "50%",
    left: e,
    translateY: "-50%"
  }),
  centerRight: e => ({
    top: "50%",
    right: e,
    translateY: "-50%"
  })
};
const u = {
  top: e => ({
    bottom: -e,
    translateY: "100%"
  }),
  bottom: e => ({
    top: -e,
    translateY: "-100%"
  }),
  left: e => ({
    right: -e,
    translateX: "100%"
  }),
  right: e => ({
    left: -e,
    translateX: "-100%"
  })
};
exports.default = (0, o.default)({
  root: {
    display: "flex",
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.93)",
    borderRadius: 2,
    "@media (max-width: 373px)": {
      "& .lr-icon-button": {
        width: 44
      }
    },
    "@media (max-height: 373px)": {
      "& .lr-icon-button": {
        height: 44
      }
    }
  },
  noBackground: {
    background: "none"
  },
  vertical: {
    flexDirection: "column"
  }
})(class extends r.default.PureComponent {
  render() {
    var e = this.props;
    let t = e.hidesWhenInactive;
    let n = e.classes;
    let o = e.anchor;
    let s = e.align;
    let c = e.vertical;
    let d = e.noBackground;
    let f = e.noMargin;
    let p = e.style;
    let h = f ? 0 : 8;
    let m = {
      translateX: 0,
      translateY: 0
    };
    if (o in l) {
      m = Object.assign({}, m, l[o](h));
    }
    if (s in u) {
      m = Object.assign({}, m, u[s](h));
    }
    var y = m;
    let g = y.translateX;
    let v = y.translateY;
    let b = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(y, ["translateX", "translateY"]);
    m = Object.assign({}, p, b, {
      transform: `translate(${g}, ${v})`
    });
    let _ = (0, i.default)(n.root, c && n.vertical, d && n.noBackground, t && a.HOVER_CONTROL_CLASS, this.props.className);
    return r.default.createElement("div", {
      className: _,
      style: m
    }, this.props.children);
  }
});
module.exports = exports.default;