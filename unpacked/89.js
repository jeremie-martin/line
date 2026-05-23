exports.__esModule = true;
exports.EXITING = exports.ENTERED = exports.ENTERING = exports.EXITED = exports.UNMOUNTED = undefined;
var r = function (e) {
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
var i = a(require("./0.js"));
var o = a(require("./21.js"));
require("./358.js");
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var s = exports.UNMOUNTED = "unmounted";
var l = exports.EXITED = "exited";
var u = exports.ENTERING = "entering";
var c = exports.ENTERED = "entered";
var d = exports.EXITING = "exiting";
var f = function (e) {
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
    var o = r.transitionGroup;
    var a = o && !o.isMounting ? n.enter : n.appear;
    var d = undefined;
    i.nextStatus = null;
    if (n.in) {
      if (a) {
        d = l;
        i.nextStatus = u;
      } else {
        d = c;
      }
    } else {
      d = n.unmountOnExit || n.mountOnEnter ? s : l;
    }
    i.state = {
      status: d
    };
    i.nextCallback = null;
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
      transitionGroup: null
    };
  };
  t.prototype.componentDidMount = function () {
    this.updateStatus(true);
  };
  t.prototype.componentWillReceiveProps = function (e) {
    var t = (this.pendingState || this.state).status;
    if (e.in) {
      if (t === s) {
        this.setState({
          status: l
        });
      }
      if (t !== u && t !== c) {
        this.nextStatus = u;
      }
    } else if (t === u || t === c) {
      this.nextStatus = d;
    }
  };
  t.prototype.componentDidUpdate = function () {
    this.updateStatus();
  };
  t.prototype.componentWillUnmount = function () {
    this.cancelNextCallback();
  };
  t.prototype.getTimeouts = function () {
    var e = this.props.timeout;
    var t = undefined;
    var n = undefined;
    var r = undefined;
    t = n = r = e;
    if (e != null && typeof e != "number") {
      t = e.exit;
      n = e.enter;
      r = e.appear;
    }
    return {
      exit: t,
      enter: n,
      appear: r
    };
  };
  t.prototype.updateStatus = function (e = false) {
    var t = this.nextStatus;
    if (t !== null) {
      this.nextStatus = null;
      this.cancelNextCallback();
      var n = o.default.findDOMNode(this);
      if (t === u) {
        this.performEnter(n, e);
      } else {
        this.performExit(n);
      }
    } else if (this.props.unmountOnExit && this.state.status === l) {
      this.setState({
        status: s
      });
    }
  };
  t.prototype.performEnter = function (e, t) {
    var n = this;
    var r = this.props.enter;
    var i = this.context.transitionGroup ? this.context.transitionGroup.isMounting : t;
    var o = this.getTimeouts();
    if (t || r) {
      this.props.onEnter(e, i);
      this.safeSetState({
        status: u
      }, function () {
        n.props.onEntering(e, i);
        n.onTransitionEnd(e, o.enter, function () {
          n.safeSetState({
            status: c
          }, function () {
            n.props.onEntered(e, i);
          });
        });
      });
    } else {
      this.safeSetState({
        status: c
      }, function () {
        n.props.onEntered(e);
      });
    }
  };
  t.prototype.performExit = function (e) {
    var t = this;
    var n = this.props.exit;
    var r = this.getTimeouts();
    if (n) {
      this.props.onExit(e);
      this.safeSetState({
        status: d
      }, function () {
        t.props.onExiting(e);
        t.onTransitionEnd(e, r.exit, function () {
          t.safeSetState({
            status: l
          }, function () {
            t.props.onExited(e);
          });
        });
      });
    } else {
      this.safeSetState({
        status: l
      }, function () {
        t.props.onExited(e);
      });
    }
  };
  t.prototype.cancelNextCallback = function () {
    if (this.nextCallback !== null) {
      this.nextCallback.cancel();
      this.nextCallback = null;
    }
  };
  t.prototype.safeSetState = function (e, t) {
    var n = this;
    this.pendingState = e;
    t = this.setNextCallback(t);
    this.setState(e, function () {
      n.pendingState = null;
      t();
    });
  };
  t.prototype.setNextCallback = function (e) {
    var t = this;
    var n = true;
    this.nextCallback = function (r) {
      if (n) {
        n = false;
        t.nextCallback = null;
        e(r);
      }
    };
    this.nextCallback.cancel = function () {
      n = false;
    };
    return this.nextCallback;
  };
  t.prototype.onTransitionEnd = function (e, t, n) {
    this.setNextCallback(n);
    if (e) {
      if (this.props.addEndListener) {
        this.props.addEndListener(e, this.nextCallback);
      }
      if (t != null) {
        setTimeout(this.nextCallback, t);
      }
    } else {
      setTimeout(this.nextCallback, 0);
    }
  };
  t.prototype.render = function () {
    var e = this.state.status;
    if (e === s) {
      return null;
    }
    var t = this.props;
    var n = t.children;
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
    }(t, ["children"]);
    delete r.in;
    delete r.mountOnEnter;
    delete r.unmountOnExit;
    delete r.appear;
    delete r.enter;
    delete r.exit;
    delete r.timeout;
    delete r.addEndListener;
    delete r.onEnter;
    delete r.onEntering;
    delete r.onEntered;
    delete r.onExit;
    delete r.onExiting;
    delete r.onExited;
    if (typeof n == "function") {
      return n(e, r);
    }
    var o = i.default.Children.only(n);
    return i.default.cloneElement(o, r);
  };
  return t;
}(i.default.Component);
function p() {}
f.contextTypes = {
  transitionGroup: r.object
};
f.childContextTypes = {
  transitionGroup: function () {}
};
f.propTypes = {};
f.defaultProps = {
  in: false,
  mountOnEnter: false,
  unmountOnExit: false,
  appear: false,
  enter: true,
  exit: true,
  onEnter: p,
  onEntering: p,
  onEntered: p,
  onExit: p,
  onExiting: p,
  onExited: p
};
f.UNMOUNTED = 0;
f.EXITED = 1;
f.ENTERING = 2;
f.ENTERED = 3;
f.EXITING = 4;
exports.default = f;