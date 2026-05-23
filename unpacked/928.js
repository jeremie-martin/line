Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./3.js"));
var i = u(require("./6.js"));
var o = u(require("./4.js"));
var a = u(require("./0.js"));
u(require("./1.js"));
var s = u(require("./5.js"));
var l = u(require("./2.js"));
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var c = exports.styles = function (e) {
  return {
    root: {
      flex: "1 1 auto"
    },
    line: {
      display: "block",
      borderColor: e.palette.type === "light" ? e.palette.grey[400] : e.palette.grey[600]
    },
    rootVertical: {
      marginLeft: 12,
      padding: "0 0 " + e.spacing.unit + "px"
    },
    lineHorizontal: {
      borderTopStyle: "solid",
      borderTopWidth: 1
    },
    lineVertical: {
      borderLeftStyle: "solid",
      borderLeftWidth: 1,
      minHeight: 24
    },
    alternativeLabelRoot: {
      position: "absolute",
      top: e.spacing.unit + 4,
      left: "calc(50% + 20px)",
      right: "calc(-50% + 20px)"
    },
    alternativeLabelLine: {
      marginLeft: 0
    }
  };
};
function d(e) {
  var t;
  var n;
  var l = e.alternativeLabel;
  var u = e.className;
  var c = e.classes;
  var d = e.orientation;
  var f = (0, o.default)(e, ["alternativeLabel", "className", "classes", "orientation"]);
  var p = (0, s.default)((t = {}, (0, i.default)(t, c.root, !l), (0, i.default)(t, c.rootVertical, d === "vertical"), (0, i.default)(t, c.alternativeLabelRoot, l), t), u);
  var h = (0, s.default)(c.line, (n = {}, (0, i.default)(n, c.lineHorizontal, d === "horizontal"), (0, i.default)(n, c.lineVertical, d === "vertical"), (0, i.default)(n, c.alternativeLabelLine, l), n));
  return a.default.createElement("div", (0, r.default)({
    className: p
  }, f), a.default.createElement("span", {
    className: h
  }));
}
d.propTypes = {};
d.defaultProps = {
  alternativeLabel: false,
  orientation: "horizontal"
};
exports.default = (0, l.default)(c, {
  name: "MuiStepConnector"
})(d);