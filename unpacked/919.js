Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = p(require("./3.js"));
var i = p(require("./6.js"));
var o = p(require("./126.js"));
var a = p(require("./4.js"));
var s = p(require("./0.js"));
p(require("./1.js"));
var l = p(require("./5.js"));
var u = p(require("./2.js"));
var c = p(require("./37.js"));
var d = require("./20.js");
var f = require("./124.js");
function p(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var h = exports.styles = function (e) {
  return {
    root: {
      display: "flex",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      background: e.palette.background.default,
      padding: e.spacing.unit
    },
    positionBottom: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: e.zIndex.mobileStepper
    },
    positionTop: {
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: e.zIndex.mobileStepper
    },
    positionStatic: {},
    dots: {
      display: "flex",
      flexDirection: "row"
    },
    dot: {
      backgroundColor: e.palette.action.disabled,
      borderRadius: "50%",
      width: e.spacing.unit,
      height: e.spacing.unit,
      margin: "0 2px"
    },
    dotActive: {
      backgroundColor: e.palette.primary.main
    },
    progress: {
      width: "50%"
    }
  };
};
function m(e) {
  var t = e.activeStep;
  var n = e.backButton;
  var u = e.classes;
  var p = e.className;
  var h = e.nextButton;
  var m = e.position;
  var y = e.steps;
  var g = e.type;
  var v = (0, a.default)(e, ["activeStep", "backButton", "classes", "className", "nextButton", "position", "steps", "type"]);
  var b = (0, l.default)(u.root, u["position" + (0, d.capitalize)(m)], p);
  return s.default.createElement(c.default, (0, r.default)({
    square: true,
    elevation: 0,
    className: b
  }, v), n, g === "dots" && s.default.createElement("div", {
    className: u.dots
  }, [].concat((0, o.default)(new Array(y))).map(function (e, n) {
    var r = (0, l.default)((0, i.default)({}, u.dotActive, n === t), u.dot);
    return s.default.createElement("div", {
      key: n,
      className: r
    });
  })), g === "progress" && s.default.createElement("div", {
    className: u.progress
  }, s.default.createElement(f.LinearProgress, {
    mode: "determinate",
    value: Math.ceil(t / (y - 1) * 100)
  })), h);
}
m.propTypes = {};
m.defaultProps = {
  activeStep: 0,
  position: "bottom",
  type: "dots"
};
exports.default = (0, u.default)(h, {
  name: "MuiMobileStepper"
})(m);