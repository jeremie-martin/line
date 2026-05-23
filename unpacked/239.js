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
var i = l(require("./1.js"));
var o = require("./0.js");
var a = l(o);
var s = require("./744.js");
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var u = Object.values || function (e) {
  return Object.keys(e).map(function (t) {
    return e[t];
  });
};
i.default.any;
i.default.node;
i.default.bool;
i.default.bool;
i.default.bool;
i.default.func;
var c = function (e) {
  function t(n, r) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, t);
    var i = function (e, t) {
      if (!e) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }
      if (!t || typeof t != "object" && typeof t != "function") {
        return e;
      } else {
        return t;
      }
    }(this, e.call(this, n, r));
    i.state = {
      children: (0, s.getChildMapping)(n.children, function (e) {
        return (0, o.cloneElement)(e, {
          onExited: i.handleExited.bind(i, e),
          in: true,
          appear: i.getProp(e, "appear"),
          enter: i.getProp(e, "enter"),
          exit: i.getProp(e, "exit")
        });
      })
    };
    return i;
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
  t.prototype.getChildContext = function () {
    return {
      transitionGroup: {
        isMounting: !this.appeared
      }
    };
  };
  t.prototype.getProp = function (e, t, n = this.props) {
    return n[t] ?? e.props[t];
  };
  t.prototype.componentDidMount = function () {
    this.appeared = true;
  };
  t.prototype.componentWillReceiveProps = function (e) {
    var t = this;
    var n = this.state.children;
    var r = (0, s.getChildMapping)(e.children);
    var i = (0, s.mergeChildMappings)(n, r);
    Object.keys(i).forEach(function (a) {
      var s = i[a];
      if ((0, o.isValidElement)(s)) {
        var l = a in n;
        var u = a in r;
        var c = n[a];
        var d = (0, o.isValidElement)(c) && !c.props.in;
        if (!u || l && !d) {
          if (u || !l || d) {
            if (u && l && (0, o.isValidElement)(c)) {
              i[a] = (0, o.cloneElement)(s, {
                onExited: t.handleExited.bind(t, s),
                in: c.props.in,
                exit: t.getProp(s, "exit", e),
                enter: t.getProp(s, "enter", e)
              });
            }
          } else {
            i[a] = (0, o.cloneElement)(s, {
              in: false
            });
          }
        } else {
          i[a] = (0, o.cloneElement)(s, {
            onExited: t.handleExited.bind(t, s),
            in: true,
            exit: t.getProp(s, "exit", e),
            enter: t.getProp(s, "enter", e)
          });
        }
      }
    });
    this.setState({
      children: i
    });
  };
  t.prototype.handleExited = function (e, t) {
    var n = (0, s.getChildMapping)(this.props.children);
    if (!(e.key in n)) {
      if (e.props.onExited) {
        e.props.onExited(t);
      }
      this.setState(function (t) {
        var n = r({}, t.children);
        delete n[e.key];
        return {
          children: n
        };
      });
    }
  };
  t.prototype.render = function () {
    var e = this.props;
    var t = e.component;
    var n = e.childFactory;
    var r = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["component", "childFactory"]);
    var i = u(this.state.children).map(n);
    delete r.appear;
    delete r.enter;
    delete r.exit;
    if (t === null) {
      return i;
    } else {
      return a.default.createElement(t, r, i);
    }
  };
  return t;
}(a.default.Component);
c.childContextTypes = {
  transitionGroup: i.default.object.isRequired
};
c.propTypes = {};
c.defaultProps = {
  component: "div",
  childFactory: function (e) {
    return e;
  }
};
exports.default = c;
module.exports = exports.default;