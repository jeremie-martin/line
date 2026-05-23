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
var l = c(require("./2.js"));
var u = require("./20.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var d = 50;
var f = exports.styles = function (e) {
  return {
    root: {
      display: "inline-block"
    },
    colorPrimary: {
      color: e.palette.primary.main
    },
    colorSecondary: {
      color: e.palette.secondary.main
    },
    svgIndeterminate: {
      animation: "mui-progress-circular-rotate 1.4s linear infinite"
    },
    svgDeterminate: {
      transform: "rotate(-90deg)"
    },
    circle: {
      stroke: "currentColor",
      strokeLinecap: "round"
    },
    circleIndeterminate: {
      animation: "mui-progress-circular-dash 1.4s ease-in-out infinite",
      strokeDasharray: "80px, 200px",
      strokeDashoffset: "0px"
    },
    "@keyframes mui-progress-circular-rotate": {
      "100%": {
        transform: "rotate(360deg)"
      }
    },
    "@keyframes mui-progress-circular-dash": {
      "0%": {
        strokeDasharray: "1px, 200px",
        strokeDashoffset: "0px"
      },
      "50%": {
        strokeDasharray: "100px, 200px",
        strokeDashoffset: "-15px"
      },
      "100%": {
        strokeDasharray: "100px, 200px",
        strokeDashoffset: "-120px"
      }
    }
  };
};
function p(e) {
  var t;
  var n = e.classes;
  var l = e.className;
  var c = e.color;
  var f = e.max;
  var p = e.min;
  var h = e.mode;
  var m = e.size;
  var y = e.style;
  var g = e.thickness;
  var v = e.value;
  var b = (0, o.default)(e, ["classes", "className", "color", "max", "min", "mode", "size", "style", "thickness", "value"]);
  var _ = {};
  var w = {};
  if (h === "determinate") {
    var x = function (e, t, n) {
      return (Math.min(Math.max(t, e), n) - t) / (n - t);
    }(v, p, f) * 100;
    var E = Math.PI * 2 * (d / 2 - 5);
    w.strokeDashoffset = Math.round((100 - x) / 100 * E * 1000) / 1000 + "px";
    w.strokeDasharray = Math.round(E * 1000) / 1000;
    _["aria-valuenow"] = v;
    _["aria-valuemin"] = p;
    _["aria-valuemax"] = f;
  }
  return a.default.createElement("div", (0, r.default)({
    className: (0, s.default)(n.root, (0, i.default)({}, n["color" + (0, u.capitalize)(c)], c !== "inherit"), l),
    style: (0, r.default)({
      width: m,
      height: m
    }, y),
    role: "progressbar"
  }, _, b), a.default.createElement("svg", {
    className: (0, s.default)((t = {}, (0, i.default)(t, n.svgIndeterminate, h === "indeterminate"), (0, i.default)(t, n.svgDeterminate, h === "determinate"), t)),
    viewBox: "0 0 " + d + " " + d
  }, a.default.createElement("circle", {
    className: (0, s.default)(n.circle, (0, i.default)({}, n.circleIndeterminate, h === "indeterminate")),
    style: w,
    cx: d / 2,
    cy: d / 2,
    r: d / 2 - 5,
    fill: "none",
    strokeWidth: g
  })));
}
p.propTypes = {};
p.defaultProps = {
  color: "primary",
  max: 100,
  min: 0,
  mode: "indeterminate",
  size: 40,
  thickness: 3.6,
  value: 0
};
exports.default = (0, l.default)(f, {
  name: "MuiCircularProgress",
  flip: false
})(p);