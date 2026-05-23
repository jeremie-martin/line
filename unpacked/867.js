exports.__esModule = true;
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
var i = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./1.js"));
var o = c(require("./868.js"));
var a = c(require("./870.js"));
var s = c(require("./0.js"));
var l = c(require("./89.js"));
var u = require("./358.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function d(e, t) {
  if (!e) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }
  if (!t || typeof t != "object" && typeof t != "function") {
    return e;
  } else {
    return t;
  }
}
function f(e, t) {
  return e && t && t.split(" ").forEach(function (t) {
    return (0, o.default)(e, t);
  });
}
function p(e, t) {
  return e && t && t.split(" ").forEach(function (t) {
    return (0, a.default)(e, t);
  });
}
r({}, l.default.propTypes, {
  classNames: u.classNamesShape,
  onEnter: i.func,
  onEntering: i.func,
  onEntered: i.func,
  onExit: i.func,
  onExiting: i.func,
  onExited: i.func
});
var h = function (e) {
  function t() {
    var n;
    var r;
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, t);
    for (var i = arguments.length, o = Array(i), a = 0; a < i; a++) {
      o[a] = arguments[a];
    }
    n = r = d(this, e.call.apply(e, [this].concat(o)));
    r.onEnter = function (e, t) {
      var n = r.getClassNames(t ? "appear" : "enter").className;
      r.removeClasses(e, "exit");
      f(e, n);
      if (r.props.onEnter) {
        r.props.onEnter(e);
      }
    };
    r.onEntering = function (e, t) {
      var n = r.getClassNames(t ? "appear" : "enter").activeClassName;
      r.reflowAndAddClass(e, n);
      if (r.props.onEntering) {
        r.props.onEntering(e);
      }
    };
    r.onEntered = function (e, t) {
      var n = r.getClassNames("enter").doneClassName;
      r.removeClasses(e, t ? "appear" : "enter");
      f(e, n);
      if (r.props.onEntered) {
        r.props.onEntered(e);
      }
    };
    r.onExit = function (e) {
      var t = r.getClassNames("exit").className;
      r.removeClasses(e, "appear");
      r.removeClasses(e, "enter");
      f(e, t);
      if (r.props.onExit) {
        r.props.onExit(e);
      }
    };
    r.onExiting = function (e) {
      var t = r.getClassNames("exit").activeClassName;
      r.reflowAndAddClass(e, t);
      if (r.props.onExiting) {
        r.props.onExiting(e);
      }
    };
    r.onExited = function (e) {
      var t = r.getClassNames("exit").doneClassName;
      r.removeClasses(e, "exit");
      f(e, t);
      if (r.props.onExited) {
        r.props.onExited(e);
      }
    };
    r.getClassNames = function (e) {
      var t = r.props.classNames;
      var n = typeof t != "string" ? t[e] : t + "-" + e;
      return {
        className: n,
        activeClassName: typeof t != "string" ? t[e + "Active"] : n + "-active",
        doneClassName: typeof t != "string" ? t[e + "Done"] : n + "-done"
      };
    };
    return d(r, n);
  }
  (function (e, t) {
    if (typeof t != "function" && t !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof t);
    }
    e.prototype = Object.create(t && t.prototype, {
      constructor: {
        value: e,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (t) {
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(e, t);
      } else {
        e.__proto__ = t;
      }
    }
  })(t, e);
  t.prototype.removeClasses = function (e, t) {
    var n = this.getClassNames(t);
    var r = n.className;
    var i = n.activeClassName;
    var o = n.doneClassName;
    if (r) {
      p(e, r);
    }
    if (i) {
      p(e, i);
    }
    if (o) {
      p(e, o);
    }
  };
  t.prototype.reflowAndAddClass = function (e, t) {
    if (e) {
      e.scrollTop;
    }
    f(e, t);
  };
  t.prototype.render = function () {
    var e = r({}, this.props);
    delete e.classNames;
    return s.default.createElement(l.default, r({}, e, {
      onEnter: this.onEnter,
      onEntered: this.onEntered,
      onEntering: this.onEntering,
      onExit: this.onExit,
      onExiting: this.onExiting,
      onExited: this.onExited
    }));
  };
  return t;
}(s.default.Component);
h.propTypes = {};
exports.default = h;
module.exports = exports.default;