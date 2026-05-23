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
var d = exports.styles = function (e) {
  return {
    root: {
      display: "block",
      margin: 0
    },
    display4: e.typography.display4,
    display3: e.typography.display3,
    display2: e.typography.display2,
    display1: e.typography.display1,
    headline: e.typography.headline,
    title: e.typography.title,
    subheading: e.typography.subheading,
    body2: e.typography.body2,
    body1: e.typography.body1,
    caption: e.typography.caption,
    button: e.typography.button,
    alignLeft: {
      textAlign: "left"
    },
    alignCenter: {
      textAlign: "center"
    },
    alignRight: {
      textAlign: "right"
    },
    alignJustify: {
      textAlign: "justify"
    },
    noWrap: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    },
    gutterBottom: {
      marginBottom: "0.35em"
    },
    paragraph: {
      marginBottom: e.spacing.unit * 2
    },
    colorInherit: {
      color: "inherit"
    },
    colorPrimary: {
      color: e.palette.primary.main
    },
    colorSecondary: {
      color: e.palette.secondary.main
    },
    colorTextSecondary: {
      color: e.palette.text.secondary
    },
    colorError: {
      color: e.palette.error.main
    }
  };
};
function f(e) {
  var t;
  var n = e.align;
  var l = e.classes;
  var c = e.className;
  var d = e.component;
  var f = e.color;
  var p = e.gutterBottom;
  var h = e.headlineMapping;
  var m = e.noWrap;
  var y = e.paragraph;
  var g = e.type;
  var v = (0, o.default)(e, ["align", "classes", "className", "component", "color", "gutterBottom", "headlineMapping", "noWrap", "paragraph", "type"]);
  var b = (0, s.default)(l.root, l[g], (t = {}, (0, i.default)(t, l["color" + (0, u.capitalize)(f)], f !== "default"), (0, i.default)(t, l.noWrap, m), (0, i.default)(t, l.gutterBottom, p), (0, i.default)(t, l.paragraph, y), (0, i.default)(t, l["align" + (0, u.capitalize)(n)], n !== "inherit"), t), c);
  var _ = d || (y ? "p" : h[g]) || "span";
  return a.default.createElement(_, (0, r.default)({
    className: b
  }, v));
}
f.propTypes = {};
f.defaultProps = {
  align: "inherit",
  color: "default",
  gutterBottom: false,
  headlineMapping: {
    display4: "h1",
    display3: "h1",
    display2: "h1",
    display1: "h1",
    headline: "h1",
    title: "h2",
    subheading: "h3",
    body2: "aside",
    body1: "p"
  },
  noWrap: false,
  paragraph: false,
  type: "body1"
};
exports.default = (0, l.default)(d, {
  name: "MuiTypography"
})(f);