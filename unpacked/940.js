Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.styles = undefined;
var r = b(require("./3.js"));
var i = b(require("./4.js"));
var o = b(require("./10.js"));
var a = b(require("./9.js"));
var s = b(require("./11.js"));
var l = b(require("./12.js"));
var u = b(require("./13.js"));
var c = b(require("./0.js"));
b(require("./1.js"));
var d = b(require("./2.js"));
var f = b(require("./63.js"));
var p = require("./74.js");
var h = b(require("./175.js"));
var m = b(require("./402.js"));
var y = b(require("./252.js"));
var g = b(require("./19.js"));
var v = b(require("./942.js"));
function b(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var _ = exports.styles = function (e) {
  return {
    root: {
      "&:last-child": {
        padding: 0
      }
    },
    toolbar: {
      height: 56,
      minHeight: 56,
      paddingRight: 2
    },
    spacer: {
      flex: "1 1 100%"
    },
    caption: {
      flexShrink: 0
    },
    input: {
      fontSize: "inherit",
      flexShrink: 0
    },
    selectRoot: {
      marginRight: e.spacing.unit * 4,
      marginLeft: e.spacing.unit,
      color: e.palette.text.secondary
    },
    select: {
      paddingLeft: e.spacing.unit,
      paddingRight: e.spacing.unit * 2
    },
    selectIcon: {
      top: 1
    },
    actions: {
      flexShrink: 0,
      color: e.palette.text.secondary,
      marginLeft: e.spacing.unit * 2.5
    }
  };
};
var w = function (e) {
  function t() {
    (0, a.default)(this, t);
    return (0, l.default)(this, (t.__proto__ || (0, o.default)(t)).apply(this, arguments));
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "componentWillReceiveProps",
    value: function (e) {
      var t = e.count;
      var n = e.onChangePage;
      var r = e.rowsPerPage;
      var i = Math.max(0, Math.ceil(t / r) - 1);
      if (this.props.page > i) {
        n(null, i);
      }
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.Actions;
      var n = e.backIconButtonProps;
      var o = e.classes;
      var a = e.colSpan;
      var s = e.component;
      var l = e.count;
      var u = e.labelDisplayedRows;
      var d = e.labelRowsPerPage;
      var v = e.nextIconButtonProps;
      var b = e.onChangePage;
      var _ = e.onChangeRowsPerPage;
      var w = e.page;
      var x = e.rowsPerPage;
      var E = e.rowsPerPageOptions;
      var S = (0, i.default)(e, ["Actions", "backIconButtonProps", "classes", "colSpan", "component", "count", "labelDisplayedRows", "labelRowsPerPage", "nextIconButtonProps", "onChangePage", "onChangeRowsPerPage", "page", "rowsPerPage", "rowsPerPageOptions"]);
      var T = undefined;
      if (s === m.default || s === "td") {
        T = a || 1000;
      }
      return c.default.createElement(s, (0, r.default)({
        className: o.root,
        colSpan: T
      }, S), c.default.createElement(y.default, {
        className: o.toolbar
      }, c.default.createElement("div", {
        className: o.spacer
      }), E.length > 1 && c.default.createElement(g.default, {
        type: "caption",
        className: o.caption
      }, d), E.length > 1 && c.default.createElement(h.default, {
        classes: {
          root: o.selectRoot,
          select: o.select,
          icon: o.selectIcon
        },
        input: c.default.createElement(f.default, {
          classes: {
            root: o.input
          },
          disableUnderline: true
        }),
        value: x,
        onChange: _
      }, E.map(function (e) {
        return c.default.createElement(p.MenuItem, {
          key: e,
          value: e
        }, e);
      })), c.default.createElement(g.default, {
        type: "caption",
        className: o.caption
      }, u({
        from: l === 0 ? 0 : w * x + 1,
        to: Math.min(l, (w + 1) * x),
        count: l,
        page: w
      })), c.default.createElement(t, {
        backIconButtonProps: n,
        count: l,
        nextIconButtonProps: v,
        onChangePage: b,
        page: w,
        rowsPerPage: x
      })));
    }
  }]);
  return t;
}(c.default.Component);
w.propTypes = {};
w.defaultProps = {
  Actions: v.default,
  component: m.default,
  labelDisplayedRows: function (e) {
    return e.from + "-" + e.to + " of " + e.count;
  },
  labelRowsPerPage: "Rows per page:",
  rowsPerPageOptions: [5, 10, 25]
};
exports.default = (0, d.default)(_, {
  name: "MuiTablePagination"
})(w);