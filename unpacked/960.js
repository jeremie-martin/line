Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = require("./0.js");
a(i);
var o = a(require("./1.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function s(e, t) {
  var n = e.component;
  var o = n === undefined ? "div" : n;
  var a = e.innerRef;
  var s = e.children;
  var l = function (e, t) {
    var n = {};
    for (var r in e) {
      if (!(t.indexOf(r) >= 0)) {
        if (Object.prototype.hasOwnProperty.call(e, r)) {
          n[r] = e[r];
        }
      }
    }
    return n;
  }(e, ["component", "innerRef", "children"]);
  var u = t.popperManager;
  function c(e) {
    u.setTargetNode(e);
    if (typeof a == "function") {
      a(e);
    }
  }
  if (typeof s == "function") {
    return s({
      targetProps: {
        ref: c
      },
      restProps: l
    });
  }
  var d = r({}, l);
  if (typeof o == "string") {
    d.ref = c;
  } else {
    d.innerRef = c;
  }
  return (0, i.createElement)(o, d, s);
}
s.contextTypes = {
  popperManager: o.default.object.isRequired
};
s.propTypes = {
  component: o.default.oneOfType([o.default.node, o.default.func]),
  innerRef: o.default.func,
  children: o.default.oneOfType([o.default.node, o.default.func])
};
exports.default = s;