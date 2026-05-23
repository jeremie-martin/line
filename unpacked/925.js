Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = v(require("./6.js"));
var i = v(require("./4.js"));
var o = v(require("./3.js"));
var a = v(require("./126.js"));
var s = v(require("./10.js"));
var l = v(require("./9.js"));
var u = v(require("./11.js"));
var c = v(require("./12.js"));
var d = v(require("./13.js"));
var f = v(require("./0.js"));
v(require("./1.js"));
var p = v(require("./5.js"));
var h = v(require("./91.js"));
v(require("./14.js"));
var m = v(require("./926.js"));
var y = v(require("./375.js"));
var g = require("./250.js");
function v(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var b = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, l.default)(this, t);
    for (var u = arguments.length, d = Array(u), f = 0; f < u; f++) {
      d[f] = arguments[f];
    }
    n = r = (0, c.default)(this, (e = t.__proto__ || (0, s.default)(t)).call.apply(e, [this].concat(d)));
    r.state = {
      anchorEl: null,
      open: false
    };
    r.ignoreNextBlur = false;
    r.isControlled = r.props.open !== undefined;
    r.update = r.isControlled ? function (e) {
      var t = e.event;
      var n = e.open;
      var i = e.anchorEl;
      if (n) {
        r.props.onOpen(t);
      } else {
        r.props.onClose(t);
      }
      r.setState({
        anchorEl: i
      });
    } : function (e) {
      var t = e.open;
      var n = e.anchorEl;
      return r.setState({
        open: t,
        anchorEl: n
      });
    };
    r.handleClick = function (e) {
      r.ignoreNextBlur = true;
      r.update({
        open: true,
        anchorEl: e.currentTarget,
        event: e
      });
    };
    r.handleClose = function (e) {
      r.update({
        open: false,
        event: e
      });
    };
    r.handleItemClick = function (e) {
      return function (t) {
        if (!r.props.multiple) {
          r.update({
            open: false,
            event: t
          });
        }
        if (r.props.onChange) {
          var n = r.props;
          var i = n.onChange;
          var s = n.name;
          var l = undefined;
          var u = undefined;
          if (t.target) {
            u = t.target;
          }
          if (r.props.multiple) {
            var c = (l = Array.isArray(r.props.value) ? [].concat((0, a.default)(r.props.value)) : []).indexOf(e.props.value);
            if (c === -1) {
              l.push(e.props.value);
            } else {
              l.splice(c, 1);
            }
          } else {
            l = e.props.value;
          }
          t.persist();
          t.target = (0, o.default)({}, u, {
            value: l,
            name: s
          });
          i(t, e);
        }
      };
    };
    r.handleBlur = function (e) {
      if (r.ignoreNextBlur === true) {
        e.stopPropagation();
        r.ignoreNextBlur = false;
        return;
      }
      if (r.props.onBlur) {
        r.props.onBlur(e);
      }
    };
    r.handleKeyDown = function (e) {
      if (!r.props.readOnly) {
        if (["space", "up", "down"].includes((0, h.default)(e))) {
          e.preventDefault();
          r.ignoreNextBlur = true;
          r.update({
            open: true,
            anchorEl: e.currentTarget,
            event: e
          });
        }
      }
    };
    r.handleSelectRef = function (e) {
      if (r.props.inputRef) {
        r.props.inputRef({
          node: e,
          value: r.props.value
        });
      }
    };
    i = n;
    return (0, c.default)(r, i);
  }
  (0, d.default)(t, e);
  (0, u.default)(t, [{
    key: "render",
    value: function () {
      var e = this;
      var t = this.props;
      var n = t.autoWidth;
      var a = t.children;
      var s = t.classes;
      var l = t.className;
      var u = t.disabled;
      var c = t.displayEmpty;
      var d = t.inputRef;
      var h = t.MenuProps;
      var v = h === undefined ? {} : h;
      var b = t.multiple;
      var _ = t.name;
      var w = t.native;
      var x = t.onBlur;
      var E = t.onChange;
      t.onClose;
      var S = t.onFocus;
      t.onOpen;
      var T = t.open;
      var k = t.readOnly;
      var O = t.renderValue;
      var P = t.value;
      var C = (0, i.default)(t, ["autoWidth", "children", "classes", "className", "disabled", "displayEmpty", "inputRef", "MenuProps", "multiple", "name", "native", "onBlur", "onChange", "onClose", "onFocus", "onOpen", "open", "readOnly", "renderValue", "value"]);
      if (w) {
        return f.default.createElement("div", {
          className: s.root
        }, f.default.createElement("select", (0, o.default)({
          className: (0, p.default)(s.select, (0, r.default)({}, s.disabled, u), l),
          name: _,
          disabled: u,
          onBlur: x,
          onChange: E,
          onFocus: S,
          value: P,
          readOnly: k,
          ref: d
        }, C), a), f.default.createElement(m.default, {
          className: s.icon
        }));
      }
      if (P === undefined) {
        throw new Error("Material-UI: the `value` property is required when using the `Select` component with `native=false`.");
      }
      var I = undefined;
      var M = "";
      var L = [];
      var R = false;
      if ((0, g.isDirty)(this.props) || c) {
        if (O) {
          I = O(P);
        } else {
          R = true;
        }
      }
      var A = f.default.Children.map(a, function (t) {
        if (!f.default.isValidElement(t)) {
          return null;
        }
        var n = undefined;
        if (b) {
          if (!Array.isArray(P)) {
            throw new Error("Material-UI: the `value` property must be an array when using the `Select` component with `multiple`.");
          }
          if ((n = P.indexOf(t.props.value) !== -1) && R) {
            L.push(t.props.children);
          }
        } else if ((n = P === t.props.value) && R) {
          M = t.props.children;
        }
        return f.default.cloneElement(t, {
          role: "option",
          selected: n,
          onClick: e.handleItemClick(t)
        });
      });
      if (R) {
        I = b ? L.join(", ") : M;
      }
      var D = this.state.anchorEl == null || n ? undefined : this.state.anchorEl.clientWidth;
      return f.default.createElement("div", {
        className: s.root
      }, f.default.createElement("div", {
        className: (0, p.default)(s.select, s.selectMenu, (0, r.default)({}, s.disabled, u), l),
        "aria-pressed": this.state.open ? "true" : "false",
        tabIndex: u ? null : 0,
        role: "button",
        "aria-owns": this.state.open ? "menu-" + (_ || "") : null,
        "aria-haspopup": "true",
        onKeyDown: this.handleKeyDown,
        onBlur: this.handleBlur,
        onClick: u || k ? null : this.handleClick,
        onFocus: S
      }, I), f.default.createElement("input", (0, o.default)({
        value: Array.isArray(P) ? P.join(",") : P,
        name: _,
        readOnly: k,
        ref: this.handleSelectRef
      }, C, {
        type: "hidden"
      })), f.default.createElement(m.default, {
        className: s.icon
      }), f.default.createElement(y.default, (0, o.default)({
        id: "menu-" + (_ || ""),
        anchorEl: this.state.anchorEl,
        open: this.isControlled ? T : this.state.open,
        onClose: this.handleClose
      }, v, {
        MenuListProps: (0, o.default)({}, v.MenuListProps, {
          role: "listbox"
        }),
        PaperProps: (0, o.default)({}, v.PaperProps, {
          style: (0, o.default)({
            minWidth: D
          }, v.PaperProps != null ? v.PaperProps.style : null)
        })
      }), A));
    }
  }]);
  return t;
}(f.default.Component);
b.propTypes = {};
exports.default = b;