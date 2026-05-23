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
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: 40,
      height: 40,
      fontFamily: e.typography.fontFamily,
      fontSize: e.typography.pxToRem(20),
      borderRadius: "50%",
      overflow: "hidden",
      userSelect: "none"
    },
    colorDefault: {
      color: e.palette.background.default,
      backgroundColor: e.palette.type === "light" ? e.palette.grey[400] : e.palette.grey[600]
    },
    img: {
      width: "100%",
      height: "100%",
      textAlign: "center",
      objectFit: "cover"
    }
  };
};
function d(e) {
  var t = e.alt;
  var n = e.children;
  var l = e.childrenClassName;
  var u = e.classes;
  var c = e.className;
  var d = e.component;
  var f = e.imgProps;
  var p = e.sizes;
  var h = e.src;
  var m = e.srcSet;
  var y = (0, o.default)(e, ["alt", "children", "childrenClassName", "classes", "className", "component", "imgProps", "sizes", "src", "srcSet"]);
  var g = (0, s.default)(u.root, (0, i.default)({}, u.colorDefault, n && !h && !m), c);
  var v = null;
  if (n) {
    if (l && typeof n != "string" && a.default.isValidElement(n)) {
      var b = (0, s.default)(l, n.props.className);
      v = a.default.cloneElement(n, {
        className: b
      });
    } else {
      v = n;
    }
  } else if (h || m) {
    v = a.default.createElement("img", (0, r.default)({
      alt: t,
      src: h,
      srcSet: m,
      sizes: p,
      className: u.img
    }, f));
  }
  return a.default.createElement(d, (0, r.default)({
    className: g
  }, y), v);
}
d.propTypes = {};
d.defaultProps = {
  component: "div"
};
exports.default = (0, l.default)(c, {
  name: "MuiAvatar"
})(d);