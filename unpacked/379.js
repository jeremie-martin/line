Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = u(require("./9.js"));
var i = u(require("./40.js"));
var o = u(require("./856.js"));
var a = u(require("./376.js"));
var s = u(require("./864.js"));
var l = require("./866.js");
function u(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function c(e) {
  return parseInt((0, o.default)(e, "paddingRight") || 0, 10);
}
exports.default = function e() {
  var t = this;
  var n = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var o = n.hideSiblingNodes;
  var u = o === undefined || o;
  var d = n.handleContainerOverflow;
  var f = d === undefined || d;
  (0, r.default)(this, e);
  this.add = function (e, n) {
    var r = t.modals.indexOf(e);
    var o = t.containers.indexOf(n);
    if (r !== -1) {
      return r;
    }
    r = t.modals.length;
    t.modals.push(e);
    if (t.hideSiblingNodes) {
      (0, l.hideSiblings)(n, e.mountNode);
    }
    if (o !== -1) {
      t.data[o].modals.push(e);
      return r;
    }
    var u = {
      modals: [e],
      overflowing: (0, s.default)(n),
      prevPaddings: []
    };
    if (t.handleContainerOverflow) {
      (function (e, t) {
        var n = {
          overflow: "hidden"
        };
        e.style = {
          overflow: t.style.overflow,
          paddingRight: t.style.paddingRight
        };
        if (e.overflowing) {
          var r = (0, a.default)();
          n.paddingRight = c(t) + r + "px";
          for (var o = document.querySelectorAll(".mui-fixed"), s = 0; s < o.length; s += 1) {
            var l = c(o[s]);
            e.prevPaddings.push(l);
            o[s].style.paddingRight = l + r + "px";
          }
        }
        (0, i.default)(n).forEach(function (e) {
          t.style[e] = n[e];
        });
      })(u, n);
    }
    t.containers.push(n);
    t.data.push(u);
    return r;
  };
  this.remove = function (e) {
    var n = t.modals.indexOf(e);
    if (n === -1) {
      return n;
    }
    var r = function (e, t) {
      return function (e, t) {
        var n = -1;
        e.some(function (e, r) {
          return !!t(e) && (n = r, true);
        });
        return n;
      }(e, function (e) {
        return e.modals.indexOf(t) !== -1;
      });
    }(t.data, e);
    var o = t.data[r];
    var a = t.containers[r];
    o.modals.splice(o.modals.indexOf(e), 1);
    t.modals.splice(n, 1);
    if (o.modals.length === 0) {
      if (t.handleContainerOverflow) {
        (function (e, t) {
          (0, i.default)(e.style).forEach(function (n) {
            t.style[n] = e.style[n];
          });
          for (var n = document.querySelectorAll(".mui-fixed"), r = 0; r < n.length; r += 1) {
            n[r].style.paddingRight = e.prevPaddings[r] + "px";
          }
        })(o, a);
      }
      if (t.hideSiblingNodes) {
        (0, l.showSiblings)(a, e.mountNode);
      }
      t.containers.splice(r, 1);
      t.data.splice(r, 1);
    } else if (t.hideSiblingNodes) {
      (0, l.ariaHidden)(false, o.modals[o.modals.length - 1].mountNode);
    }
    return n;
  };
  this.isTopModal = function (e) {
    return !!t.modals.length && t.modals[t.modals.length - 1] === e;
  };
  this.hideSiblingNodes = u;
  this.handleContainerOverflow = f;
  this.modals = [];
  this.containers = [];
  this.data = [];
};