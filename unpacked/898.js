Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = b(require("./3.js"));
var i = b(require("./6.js"));
var o = b(require("./4.js"));
var a = b(require("./10.js"));
var s = b(require("./9.js"));
var l = b(require("./11.js"));
var u = b(require("./12.js"));
var c = b(require("./13.js"));
var d = b(require("./0.js"));
b(require("./1.js"));
var f = b(require("./5.js"));
var p = b(require("./75.js"));
var h = b(require("./2.js"));
var m = b(require("./123.js"));
var y = b(require("./37.js"));
var g = require("./20.js");
var v = require("./43.js");
function b(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var _ = exports.styles = function (e) {
  return {
    docked: {
      flex: "0 0 auto"
    },
    paper: {
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      flex: "1 0 auto",
      zIndex: e.zIndex.drawer,
      WebkitOverflowScrolling: "touch",
      position: "fixed",
      top: 0,
      "&:focus": {
        outline: "none"
      }
    },
    paperAnchorLeft: {
      left: 0,
      right: "auto"
    },
    paperAnchorRight: {
      left: "auto",
      right: 0
    },
    paperAnchorTop: {
      top: 0,
      left: 0,
      bottom: "auto",
      right: 0,
      height: "auto",
      maxHeight: "100vh"
    },
    paperAnchorBottom: {
      top: "auto",
      left: 0,
      bottom: 0,
      right: 0,
      height: "auto",
      maxHeight: "100vh"
    },
    paperAnchorDockedLeft: {
      borderRight: "1px solid " + e.palette.divider
    },
    paperAnchorDockedTop: {
      borderBottom: "1px solid " + e.palette.divider
    },
    paperAnchorDockedRight: {
      borderLeft: "1px solid " + e.palette.divider
    },
    paperAnchorDockedBottom: {
      borderTop: "1px solid " + e.palette.divider
    },
    modal: {}
  };
};
var w = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var o = arguments.length, l = Array(o), c = 0; c < o; c++) {
      l[c] = arguments[c];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(l)));
    r.state = {
      firstMount: true
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentWillReceiveProps",
    value: function () {
      this.setState({
        firstMount: false
      });
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.anchor;
      var n = e.children;
      var a = e.classes;
      var s = e.className;
      var l = e.elevation;
      var u = e.ModalProps;
      var c = e.onClose;
      var h = e.open;
      var v = e.SlideProps;
      var b = e.theme;
      var _ = e.transitionDuration;
      var w = e.type;
      var x = (0, o.default)(e, ["anchor", "children", "classes", "className", "elevation", "ModalProps", "onClose", "open", "SlideProps", "theme", "transitionDuration", "type"]);
      var E = t;
      if (b.direction === "rtl" && ["left", "right"].includes(E)) {
        E = E === "left" ? "right" : "left";
      }
      var S = d.default.createElement(y.default, {
        elevation: w === "temporary" ? l : 0,
        square: true,
        className: (0, f.default)(a.paper, a["paperAnchor" + (0, g.capitalize)(E)], (0, i.default)({}, a["paperAnchorDocked" + (0, g.capitalize)(E)], w !== "temporary"))
      }, n);
      if (w === "permanent") {
        return d.default.createElement("div", (0, r.default)({
          className: (0, f.default)(a.docked, s)
        }, x), S);
      }
      var T = d.default.createElement(m.default, (0, r.default)({
        in: h,
        direction: function (e) {
          if (e === "left") {
            return "right";
          } else if (e === "right") {
            return "left";
          } else if (e === "top") {
            return "down";
          } else {
            return "up";
          }
        }(E),
        timeout: _,
        appear: !this.state.firstMount
      }, v), S);
      if (w === "persistent") {
        return d.default.createElement("div", (0, r.default)({
          className: (0, f.default)(a.docked, s)
        }, x), T);
      } else {
        return d.default.createElement(p.default, (0, r.default)({
          BackdropProps: {
            transitionDuration: _
          },
          className: (0, f.default)(a.modal, s),
          open: h,
          onClose: c
        }, x, u), T);
      }
    }
  }]);
  return t;
}(d.default.Component);
w.propTypes = {};
w.defaultProps = {
  anchor: "left",
  elevation: 16,
  open: false,
  transitionDuration: {
    enter: v.duration.enteringScreen,
    exit: v.duration.leavingScreen
  },
  type: "temporary"
};
exports.default = (0, h.default)(_, {
  name: "MuiDrawer",
  flip: false,
  withTheme: true
})(w);