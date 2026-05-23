Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = g(require("./3.js"));
var i = g(require("./6.js"));
var o = g(require("./4.js"));
var a = g(require("./10.js"));
var s = g(require("./9.js"));
var l = g(require("./11.js"));
var u = g(require("./12.js"));
var c = g(require("./13.js"));
var d = g(require("./0.js"));
g(require("./1.js"));
var f = g(require("./5.js"));
var p = g(require("./173.js"));
var h = g(require("./37.js"));
var m = g(require("./2.js"));
var y = require("./45.js");
function g(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var v = exports.styles = function (e) {
  var t = {
    duration: e.transitions.duration.shortest,
    easing: e.transitions.easing.ease
  };
  return {
    root: {
      position: "relative",
      margin: 0,
      transition: e.transitions.create(["margin"], t),
      "&:before": {
        position: "absolute",
        left: 0,
        top: -1,
        right: 0,
        height: 1,
        content: "\"\"",
        opacity: 1,
        backgroundColor: e.palette.divider,
        transition: e.transitions.create(["opacity", "background-color"], t)
      },
      "&:first-child": {
        borderTopLeftRadius: 2,
        borderTopRightRadius: 2,
        "&:before": {
          display: "none"
        }
      },
      "&:last-child": {
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2
      },
      "&$expanded + &": {
        "&:before": {
          display: "none"
        }
      }
    },
    expanded: {
      margin: e.spacing.unit * 2 + "px 0",
      "&:first-child": {
        marginTop: 0
      },
      "&:last-child": {
        marginBottom: 0
      },
      "&:before": {
        opacity: 0
      }
    },
    disabled: {
      backgroundColor: e.palette.action.disabledBackground
    }
  };
};
var b = function (e) {
  function t() {
    var e;
    var n;
    var r;
    var i;
    (0, s.default)(this, t);
    for (var o = arguments.length, l = Array(o), c = 0; c < o; c++) {
      l[c] = arguments[c];
    }
    n = r = (0, u.default)(this, (e = t.__proto__ || (0, a.default)(t)).call.apply(e, [this].concat(l)));
    r.state = {
      expanded: false
    };
    r.isControlled = null;
    r.handleChange = function (e) {
      var t = r.props.onChange;
      var n = !r.state.expanded;
      if (t) {
        t(e, n);
      }
      if (!r.isControlled) {
        r.setState({
          expanded: n
        });
      }
    };
    i = n;
    return (0, u.default)(r, i);
  }
  (0, c.default)(t, e);
  (0, l.default)(t, [{
    key: "componentWillMount",
    value: function () {
      var e = this.props;
      var t = e.expanded;
      var n = e.defaultExpanded;
      this.isControlled = t != null;
      this.setState({
        expanded: this.isControlled ? t : n
      });
    }
  }, {
    key: "componentWillReceiveProps",
    value: function (e) {
      if (this.isControlled) {
        this.setState({
          expanded: e.expanded
        });
      }
    }
  }, {
    key: "render",
    value: function () {
      var e;
      var t = this;
      var n = this.props;
      var a = n.children;
      var s = n.classes;
      var l = n.className;
      var u = n.CollapseProps;
      n.defaultExpanded;
      var c = n.disabled;
      n.expanded;
      n.onChange;
      var m = (0, o.default)(n, ["children", "classes", "className", "CollapseProps", "defaultExpanded", "disabled", "expanded", "onChange"]);
      var g = this.state.expanded;
      var v = (0, f.default)(s.root, (e = {}, (0, i.default)(e, s.expanded, g), (0, i.default)(e, s.disabled, c), e), l);
      var b = null;
      var _ = d.default.Children.map(a, function (e) {
        if (d.default.isValidElement(e)) {
          if ((0, y.isMuiElement)(e, ["ExpansionPanelSummary"])) {
            b = d.default.cloneElement(e, {
              disabled: c,
              expanded: g,
              onChange: t.handleChange
            });
            return null;
          } else {
            return e;
          }
        } else {
          return null;
        }
      });
      var w = g ? null : {
        "aria-hidden": "true"
      };
      return d.default.createElement(h.default, (0, r.default)({
        className: v,
        elevation: 1,
        square: true
      }, m), b, d.default.createElement(p.default, (0, r.default)({
        in: g,
        timeout: "auto"
      }, w, u), _));
    }
  }]);
  return t;
}(d.default.Component);
b.propTypes = {};
b.defaultProps = {
  defaultExpanded: false,
  disabled: false
};
exports.default = (0, m.default)(v, {
  name: "MuiExpansionPanel"
})(b);