Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = u(require("./6.js"));
var i = u(require("./3.js"));
var o = u(require("./4.js"));
var a = u(require("./0.js"));
u(require("./1.js"));
var s = u(require("./5.js"));
u(require("./14.js"));
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
var c = exports.styles = {
  root: {
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "center"
  },
  rootMedia: {
    width: "100%"
  }
};
var d = ["video", "audio", "picture", "iframe", "img"];
function f(e) {
  var t;
  var n = e.classes;
  var l = e.className;
  var u = e.component;
  var c = e.image;
  var f = e.src;
  var p = e.style;
  var h = (0, o.default)(e, ["classes", "className", "component", "image", "src", "style"]);
  var m = d.indexOf(u) !== -1;
  var y = !m && c ? (0, i.default)({
    backgroundImage: "url(" + c + ")"
  }, p) : p;
  var g = (0, s.default)((t = {}, (0, r.default)(t, n.root, !m), (0, r.default)(t, n.rootMedia, m), t), l);
  return a.default.createElement(u, (0, i.default)({
    className: g,
    style: y,
    src: m ? c || f : undefined
  }, h));
}
f.propTypes = {};
f.defaultProps = {
  component: "div"
};
exports.default = (0, l.default)(c, {
  name: "MuiCardMedia"
})(f);