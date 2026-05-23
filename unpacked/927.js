Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = c(require("./3.js"));
var i = c(require("./4.js"));
var o = c(require("./0.js"));
c(require("./1.js"));
var a = c(require("./5.js"));
var s = c(require("./2.js"));
var l = c(require("./37.js"));
var u = c(require("./928.js"));
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
      display: "flex",
      padding: e.spacing.unit * 3
    },
    horizontal: {
      flexDirection: "row",
      alignItems: "center"
    },
    vertical: {
      flexDirection: "column"
    }
  };
};
function f(e) {
  var t = e.activeStep;
  var n = e.alternativeLabel;
  var s = e.classes;
  var u = e.className;
  var c = e.children;
  var d = e.connector;
  var f = e.nonLinear;
  var p = e.orientation;
  var h = (0, i.default)(e, ["activeStep", "alternativeLabel", "classes", "className", "children", "connector", "nonLinear", "orientation"]);
  var m = (0, a.default)(s.root, u, n ? null : s[p]);
  var y = d ? o.default.cloneElement(d, {
    orientation: p
  }) : null;
  var g = o.default.Children.toArray(c);
  var v = g.map(function (e, i) {
    var a = {
      index: i,
      orientation: p,
      active: false,
      completed: false,
      disabled: false,
      last: i + 1 === g.length,
      alternativeLabel: n,
      connector: d
    };
    if (t === i) {
      a.active = true;
    } else if (!f && t > i) {
      a.completed = true;
    } else if (!f && t < i) {
      a.disabled = true;
    }
    return [!n && y && i > 0 && o.default.cloneElement(y, {
      key: "connect-" + (i - 1) + "-to-" + i
    }), o.default.cloneElement(e, (0, r.default)({}, a, e.props))];
  });
  return o.default.createElement(l.default, (0, r.default)({
    square: true,
    elevation: 0,
    className: m
  }, h), v);
}
f.propTypes = {};
f.defaultProps = {
  activeStep: 0,
  alternativeLabel: false,
  connector: o.default.createElement(u.default, null),
  nonLinear: false,
  orientation: "horizontal"
};
f.muiName = "Stepper";
exports.default = (0, s.default)(d, {
  name: "MuiStepper"
})(f);