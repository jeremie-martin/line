Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./4.js"));
var i = s(require("./0.js"));
s(require("./1.js"));
var o = s(require("./907.js"));
var a = s(require("./910.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function l(e) {
  var t = e.implementation;
  var n = (0, r.default)(e, ["implementation"]);
  if (t === "js") {
    return i.default.createElement(o.default, n);
  } else {
    return i.default.createElement(a.default, n);
  }
}
l.propTypes = {};
l.defaultProps = {
  implementation: "js",
  lgDown: false,
  lgUp: false,
  mdDown: false,
  mdUp: false,
  smDown: false,
  smUp: false,
  xlDown: false,
  xlUp: false,
  xsDown: false,
  xsUp: false
};
exports.default = l;