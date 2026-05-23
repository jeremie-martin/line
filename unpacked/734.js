Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./6.js"));
var o = c(require("./4.js"));
var a = c(require("./0.js"));
c(require("./1.js"));
var s = c(require("./5.js"));
c(require("./14.js"));
var l = c(require("./2.js"));
var u = require("./73.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var d = exports.styles = function (e) {
  return {
    root: {
      position: "relative",
      overflow: "hidden",
      height: 5
    },
    primaryColor: {
      backgroundColor: (0, u.lighten)(e.palette.primary.light, 0.6)
    },
    primaryColorBar: {
      backgroundColor: e.palette.primary.main
    },
    primaryDashed: {
      background: "radial-gradient(" + (0, u.lighten)(e.palette.primary.light, 0.6) + " 0%, " + (0, u.lighten)(e.palette.primary.light, 0.6) + " 16%, transparent 42%)",
      backgroundSize: "10px 10px",
      backgroundPosition: "0px -23px"
    },
    secondaryColor: {
      backgroundColor: (0, u.lighten)(e.palette.secondary.light, 0.4)
    },
    secondaryColorBar: {
      backgroundColor: e.palette.secondary.main
    },
    secondaryDashed: {
      background: "radial-gradient(" + (0, u.lighten)(e.palette.secondary.light, 0.4) + " 0%, " + (0, u.lighten)(e.palette.secondary.light, 0.6) + " 16%, transparent 42%)",
      backgroundSize: "10px 10px",
      backgroundPosition: "0px -23px"
    },
    bar: {
      width: "100%",
      position: "absolute",
      left: 0,
      bottom: 0,
      top: 0,
      transition: "transform 0.2s linear",
      transformOrigin: "left"
    },
    dashed: {
      position: "absolute",
      marginTop: 0,
      height: "100%",
      width: "100%",
      animation: "buffer 3s infinite linear"
    },
    bufferBar2: {
      transition: "transform .4s linear"
    },
    rootBuffer: {
      backgroundColor: "transparent"
    },
    rootQuery: {
      transform: "rotate(180deg)"
    },
    indeterminateBar1: {
      width: "auto",
      willChange: "left, right",
      animation: "mui-indeterminate1 2.1s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite"
    },
    indeterminateBar2: {
      width: "auto",
      willChange: "left, right",
      animation: "mui-indeterminate2 2.1s cubic-bezier(0.165, 0.84, 0.44, 1) infinite",
      animationDelay: "1.15s"
    },
    determinateBar1: {
      willChange: "transform",
      transition: "transform .4s linear"
    },
    bufferBar1: {
      zIndex: 1,
      transition: "transform .4s linear"
    },
    "@keyframes mui-indeterminate1": {
      "0%": {
        left: "-35%",
        right: "100%"
      },
      "60%": {
        left: "100%",
        right: "-90%"
      },
      "100%": {
        left: "100%",
        right: "-90%"
      }
    },
    "@keyframes mui-indeterminate2": {
      "0%": {
        left: "-200%",
        right: "100%"
      },
      "60%": {
        left: "107%",
        right: "-8%"
      },
      "100%": {
        left: "107%",
        right: "-8%"
      }
    },
    "@keyframes buffer": {
      "0%": {
        opacity: 1,
        backgroundPosition: "0px -23px"
      },
      "50%": {
        opacity: 0,
        backgroundPosition: "0px -23px"
      },
      "100%": {
        opacity: 1,
        backgroundPosition: "-200px -23px"
      }
    }
  };
};
function f(e) {
  var t;
  var n;
  var l;
  var u;
  var c = e.classes;
  var d = e.className;
  var f = e.color;
  var p = e.mode;
  var h = e.value;
  var m = e.valueBuffer;
  var y = (0, o.default)(e, ["classes", "className", "color", "mode", "value", "valueBuffer"]);
  var g = (0, s.default)(c.dashed, (t = {}, (0, i.default)(t, c.primaryDashed, f === "primary"), (0, i.default)(t, c.secondaryDashed, f === "secondary"), t));
  var v = (0, s.default)(c.root, (n = {}, (0, i.default)(n, c.primaryColor, f === "primary"), (0, i.default)(n, c.secondaryColor, f === "secondary"), (0, i.default)(n, c.rootBuffer, p === "buffer"), (0, i.default)(n, c.rootQuery, p === "query"), n), d);
  var b = (0, s.default)(c.bar, (l = {}, (0, i.default)(l, c.primaryColorBar, f === "primary"), (0, i.default)(l, c.secondaryColorBar, f === "secondary"), (0, i.default)(l, c.indeterminateBar1, p === "indeterminate" || p === "query"), (0, i.default)(l, c.determinateBar1, p === "determinate"), (0, i.default)(l, c.bufferBar1, p === "buffer"), l));
  var _ = (0, s.default)(c.bar, (u = {}, (0, i.default)(u, c.bufferBar2, p === "buffer"), (0, i.default)(u, c.primaryColorBar, f === "primary" && p !== "buffer"), (0, i.default)(u, c.primaryColor, f === "primary" && p === "buffer"), (0, i.default)(u, c.secondaryColorBar, f === "secondary" && p !== "buffer"), (0, i.default)(u, c.secondaryColor, f === "secondary" && p === "buffer"), (0, i.default)(u, c.indeterminateBar2, p === "indeterminate" || p === "query"), u));
  var w = {
    primary: {},
    secondary: {}
  };
  var x = {};
  if (p === "determinate" || p === "buffer") {
    if (h !== undefined) {
      w.primary.transform = "scaleX(" + h / 100 + ")";
      x["aria-valuenow"] = Math.round(h);
    }
  }
  if (p === "buffer" && m !== undefined) {
    w.secondary.transform = "scaleX(" + (m || 0) / 100 + ")";
  }
  return a.default.createElement("div", (0, r.default)({
    className: v,
    role: "progressbar"
  }, x, y), p === "buffer" ? a.default.createElement("div", {
    className: g
  }) : null, a.default.createElement("div", {
    className: b,
    style: w.primary
  }), p === "determinate" ? null : a.default.createElement("div", {
    className: _,
    style: w.secondary
  }));
}
f.propTypes = {};
f.defaultProps = {
  color: "primary",
  mode: "indeterminate"
};
exports.default = (0, l.default)(d, {
  name: "MuiLinearProgress"
})(f);