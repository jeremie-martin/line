Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = m(require("./3.js"));
var i = m(require("./4.js"));
var o = m(require("./10.js"));
var a = m(require("./9.js"));
var s = m(require("./11.js"));
var l = m(require("./12.js"));
var u = m(require("./13.js"));
var c = m(require("./0.js"));
m(require("./1.js"));
var d = m(require("./5.js"));
var f = m(require("./56.js"));
var p = m(require("./44.js"));
var h = m(require("./2.js"));
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var y = exports.styles = {
  root: {
    position: "relative",
    width: "100%"
  },
  textarea: {
    width: "100%",
    height: "100%",
    resize: "none",
    font: "inherit",
    padding: 0,
    cursor: "inherit",
    boxSizing: "border-box",
    lineHeight: "inherit",
    border: "none",
    outline: "none",
    background: "transparent"
  },
  shadow: {
    resize: "none",
    overflow: "hidden",
    visibility: "hidden",
    position: "absolute",
    height: "auto",
    whiteSpace: "pre-wrap"
  }
};
var g = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, a.default)(this, t);
    for (var s = arguments.length, u = Array(s), c = 0; c < s; c++) {
      u[c] = arguments[c];
    }
    n = r = (0, l.default)(this, (e = t.__proto__ || (0, o.default)(t)).call.apply(e, [this].concat(u)));
    r.state = {
      height: null
    };
    r.shadow = null;
    r.singlelineShadow = null;
    r.input = null;
    r.value = null;
    r.handleResize = (0, f.default)(function (e) {
      r.syncHeightWithShadow(e);
    }, 166);
    r.handleRefInput = function (e) {
      r.input = e;
      if (r.props.textareaRef) {
        r.props.textareaRef(e);
      }
    };
    r.handleRefSinglelineShadow = function (e) {
      r.singlelineShadow = e;
    };
    r.handleRefShadow = function (e) {
      r.shadow = e;
    };
    r.handleChange = function (e) {
      r.value = e.target.value;
      if (r.props.value === undefined && r.shadow) {
        r.shadow.value = r.value;
        r.syncHeightWithShadow(e);
      }
      if (r.props.onChange) {
        r.props.onChange(e);
      }
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentWillMount",
    value: function () {
      this.value = this.props.value || this.props.defaultValue || "";
      this.setState({
        height: Number(this.props.rows) * 24
      });
    }
  }, {
    key: "componentDidMount",
    value: function () {
      this.syncHeightWithShadow(null);
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (e.value !== this.props.value || Number(e.rowsMax) !== Number(this.props.rowsMax)) {
        this.syncHeightWithShadow(null, e);
      }
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      this.handleResize.cancel();
    }
  }, {
    key: "syncHeightWithShadow",
    value: function (e, t = this.props) {
      if (this.shadow && this.singlelineShadow) {
        if (this.props.value !== undefined) {
          this.shadow.value = t.value == null ? "" : String(t.value);
        }
        var n = this.singlelineShadow.scrollHeight;
        var r = this.shadow.scrollHeight;
        if (r === undefined) {
          return;
        }
        if (Number(t.rowsMax) >= Number(t.rows)) {
          r = Math.min(Number(t.rowsMax) * n, r);
        }
        r = Math.max(r, n);
        if (this.state.height !== r) {
          this.setState({
            height: r
          });
        }
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.classes;
      var n = e.className;
      var o = e.defaultValue;
      e.onChange;
      var a = e.rows;
      e.rowsMax;
      e.textareaRef;
      var s = e.value;
      var l = (0, i.default)(e, ["classes", "className", "defaultValue", "onChange", "rows", "rowsMax", "textareaRef", "value"]);
      return c.default.createElement("div", {
        className: t.root,
        style: {
          height: this.state.height
        }
      }, c.default.createElement(p.default, {
        target: "window",
        onResize: this.handleResize
      }), c.default.createElement("textarea", {
        ref: this.handleRefSinglelineShadow,
        className: (0, d.default)(t.shadow, t.textarea),
        tabIndex: -1,
        rows: "1",
        readOnly: true,
        "aria-hidden": "true",
        value: ""
      }), c.default.createElement("textarea", {
        ref: this.handleRefShadow,
        className: (0, d.default)(t.shadow, t.textarea),
        tabIndex: -1,
        rows: a,
        "aria-hidden": "true",
        readOnly: true,
        defaultValue: o,
        value: s
      }), c.default.createElement("textarea", (0, r.default)({
        rows: a,
        className: (0, d.default)(t.textarea, n),
        defaultValue: o,
        value: s,
        onChange: this.handleChange,
        ref: this.handleRefInput
      }, l)));
    }
  }]);
  return t;
}(c.default.Component);
g.propTypes = {};
g.defaultProps = {
  rows: 1
};
exports.default = (0, h.default)(y, {
  name: "MuiTextarea"
})(g);