Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = d(require("./3.js"));
var i = d(require("./6.js"));
var o = d(require("./4.js"));
var a = d(require("./0.js"));
d(require("./1.js"));
var s = d(require("./5.js"));
var l = d(require("./2.js"));
var u = d(require("./19.js"));
var c = d(require("./931.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var f = exports.styles = function (e) {
  return {
    root: {
      display: "flex",
      alignItems: "center"
    },
    horizontal: {},
    vertical: {},
    active: {
      fontWeight: 500
    },
    completed: {
      fontWeight: 500
    },
    disabled: {
      cursor: "default"
    },
    iconContainer: {},
    iconContainerNoAlternative: {
      paddingRight: e.spacing.unit
    },
    alternativeLabelRoot: {
      flexDirection: "column"
    },
    alternativeLabel: {
      textAlign: "center",
      marginTop: e.spacing.unit * 2
    }
  };
};
function p(e) {
  var t;
  var n;
  var l = e.active;
  var d = e.alternativeLabel;
  var f = e.children;
  var p = e.classes;
  var h = e.className;
  var m = e.completed;
  var y = e.disabled;
  var g = e.icon;
  e.last;
  var v = e.optional;
  var b = e.orientation;
  var _ = (0, o.default)(e, ["active", "alternativeLabel", "children", "classes", "className", "completed", "disabled", "icon", "last", "optional", "orientation"]);
  var w = (0, s.default)(p.root, p[b], (t = {}, (0, i.default)(t, p.disabled, y), (0, i.default)(t, p.completed, m), (0, i.default)(t, p.alternativeLabelRoot, d), (0, i.default)(t, "classNameProp", h), t));
  var x = (0, s.default)((n = {}, (0, i.default)(n, p.alternativeLabel, d), (0, i.default)(n, p.completed, m), (0, i.default)(n, p.active, l), n));
  return a.default.createElement("span", (0, r.default)({
    className: w
  }, _), g && a.default.createElement("span", {
    className: (0, s.default)(p.iconContainer, (0, i.default)({}, p.iconContainerNoAlternative, !d))
  }, a.default.createElement(c.default, {
    completed: m,
    active: l,
    icon: g,
    alternativeLabel: d
  })), a.default.createElement("span", null, a.default.createElement(u.default, {
    type: "body1",
    component: "span",
    className: x
  }, f), v));
}
p.propTypes = {};
p.defaultProps = {
  active: false,
  alternativeLabel: false,
  completed: false,
  disabled: false,
  last: false,
  orientation: "horizontal"
};
p.muiName = "StepLabel";
exports.default = (0, l.default)(f, {
  name: "MuiStepLabel"
})(p);