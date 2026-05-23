Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = k(require("./3.js"));
var i = k(require("./6.js"));
var o = k(require("./4.js"));
var a = k(require("./10.js"));
var s = k(require("./9.js"));
var l = k(require("./11.js"));
var u = k(require("./12.js"));
var c = k(require("./13.js"));
var d = k(require("./0.js"));
var f = k(require("./21.js"));
k(require("./1.js"));
var p = k(require("./5.js"));
k(require("./14.js"));
var h = k(require("./91.js"));
var m = k(require("./377.js"));
var y = k(require("./165.js"));
var g = k(require("./166.js"));
var v = k(require("./62.js"));
var b = k(require("./378.js"));
var _ = k(require("./244.js"));
var w = k(require("./360.js"));
var x = require("./20.js");
var E = k(require("./2.js"));
var S = k(require("./379.js"));
var T = k(require("./381.js"));
function k(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function O(e) {
  return (0, v.default)(f.default.findDOMNode(e));
}
function P(e) {
  return !!e.children && e.children.props.hasOwnProperty("in");
}
var C = exports.styles = function (e) {
  return {
    root: {
      display: "flex",
      width: "100%",
      height: "100%",
      position: "fixed",
      zIndex: e.zIndex.modal,
      top: 0,
      left: 0
    },
    hidden: {
      visibility: "hidden"
    }
  };
};
var I = function (e) {
  function t(e, n) {
    (0, s.default)(this, t);
    var r = (0, u.default)(this, (t.__proto__ || (0, a.default)(t)).call(this, e, n));
    r.dialog = null;
    r.mounted = false;
    r.mountNode = null;
    r.handleRendered = function () {
      r.autoFocus();
      if (r.props.onRendered) {
        r.props.onRendered();
      }
    };
    r.handleOpen = function () {
      var e = O(r);
      var t = function (e, t) {
        e = typeof e == "function" ? e() : e;
        return f.default.findDOMNode(e) || t;
      }(r.props.container, e.body);
      r.props.manager.add(r, t);
      r.onDocumentKeydownListener = (0, w.default)(e, "keydown", r.handleDocumentKeyDown);
      r.onFocusinListener = (0, w.default)(document, "focus", r.enforceFocus, true);
    };
    r.handleClose = function () {
      r.props.manager.remove(r);
      r.onDocumentKeydownListener.remove();
      r.onFocusinListener.remove();
      r.restoreLastFocus();
    };
    r.handleExited = function () {
      r.setState({
        exited: true
      });
      r.handleClose();
    };
    r.handleBackdropClick = function (e) {
      if (e.target === e.currentTarget) {
        if (r.props.onBackdropClick) {
          r.props.onBackdropClick(e);
        }
        if (!r.props.disableBackdropClick && r.props.onClose) {
          r.props.onClose(e, "backdropClick");
        }
      }
    };
    r.handleDocumentKeyDown = function (e) {
      if (r.isTopModal() && (0, h.default)(e) === "esc") {
        if (r.props.onEscapeKeyDown) {
          r.props.onEscapeKeyDown(e);
        }
        if (!r.props.disableEscapeKeyDown && r.props.onClose) {
          r.props.onClose(e, "escapeKeyDown");
        }
      }
    };
    r.checkForFocus = function () {
      if (g.default) {
        r.lastFocus = (0, m.default)();
      }
    };
    r.enforceFocus = function () {
      if (!r.props.disableEnforceFocus && r.mounted && r.isTopModal()) {
        var e = r.getDialogElement();
        var t = (0, m.default)(O(r));
        if (e && !(0, y.default)(e, t)) {
          e.focus();
        }
      }
    };
    r.state = {
      exited: !r.props.open
    };
    return r;
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentDidMount",
    value: function () {
      this.mounted = true;
      if (this.props.open) {
        this.handleOpen();
      }
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (e.open) {
        this.setState({
          exited: false
        });
      } else if (!P(e)) {
        this.setState({
          exited: true
        });
      }
    }
  }, {
    key: "componentWillUpdate",
    value: function (e) {
      if (!this.props.open && e.open) {
        this.checkForFocus();
      }
    }
  }, {
    key: "componentDidUpdate",
    value: function (e) {
      if (!e.open || this.props.open || P(this.props)) {
        if (!e.open && this.props.open) {
          this.handleOpen();
        }
      } else {
        this.handleClose();
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.mounted = false;
      if (this.props.open || P(this.props) && !this.state.exited) {
        this.handleClose();
      }
    }
  }, {
    key: "getDialogElement",
    value: function () {
      return f.default.findDOMNode(this.dialog);
    }
  }, {
    key: "autoFocus",
    value: function () {
      if (!this.props.disableAutoFocus) {
        var e = this.getDialogElement();
        var t = (0, m.default)(O(this));
        if (e && !(0, y.default)(e, t)) {
          this.lastFocus = t;
          if (!e.hasAttribute("tabIndex")) {
            e.setAttribute("tabIndex", -1);
          }
          e.focus();
        }
      }
    }
  }, {
    key: "restoreLastFocus",
    value: function () {
      if (!this.props.disableRestoreFocus) {
        if (this.lastFocus) {
          this.lastFocus.focus();
          this.lastFocus = null;
        }
      }
    }
  }, {
    key: "isTopModal",
    value: function () {
      return this.props.manager.isTopModal(this);
    }
  }, {
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.BackdropComponent;
      var a = t.BackdropProps;
      var s = t.children;
      var l = t.classes;
      var u = t.className;
      var c = t.container;
      t.disableAutoFocus;
      t.disableBackdropClick;
      t.disableEnforceFocus;
      t.disableEscapeKeyDown;
      t.disableRestoreFocus;
      var f = t.hideBackdrop;
      var h = t.keepMounted;
      t.onBackdropClick;
      t.onClose;
      t.onEscapeKeyDown;
      t.onRendered;
      var m = t.open;
      t.manager;
      var y = (0, o.default)(t, ["BackdropComponent", "BackdropProps", "children", "classes", "className", "container", "disableAutoFocus", "disableBackdropClick", "disableEnforceFocus", "disableEscapeKeyDown", "disableRestoreFocus", "hideBackdrop", "keepMounted", "onBackdropClick", "onClose", "onEscapeKeyDown", "onRendered", "open", "manager"]);
      var g = this.state.exited;
      var v = P(this.props);
      var w = {};
      if (h || m || v && !g) {
        if (v) {
          w.onExited = (0, x.createChainedFunction)(this.handleExited, s.props.onExited);
        }
        if (s.props.role === undefined) {
          w.role = s.props.role || "document";
        }
        if (s.props.tabIndex === undefined) {
          w.tabIndex = s.props.tabIndex || "-1";
        }
        return d.default.createElement(_.default, {
          ref: function (t) {
            e.mountNode = t ? t.getMountNode() : t;
          },
          container: c,
          onRendered: this.handleRendered
        }, d.default.createElement("div", (0, r.default)({
          className: (0, p.default)(l.root, u, (0, i.default)({}, l.hidden, g))
        }, y), f ? null : d.default.createElement(n, (0, r.default)({
          open: m,
          onClick: this.handleBackdropClick
        }, a)), d.default.createElement(b.default, {
          ref: function (t) {
            e.dialog = t;
          }
        }, d.default.cloneElement(s, w))));
      } else {
        return null;
      }
    }
  }]);
  return t;
}(d.default.Component);
I.propTypes = {};
I.defaultProps = {
  disableAutoFocus: false,
  disableBackdropClick: false,
  disableEnforceFocus: false,
  disableEscapeKeyDown: false,
  disableRestoreFocus: false,
  hideBackdrop: false,
  keepMounted: false,
  manager: new S.default(),
  BackdropComponent: T.default
};
exports.default = (0, E.default)(C, {
  flip: false,
  name: "MuiModal"
})(I);