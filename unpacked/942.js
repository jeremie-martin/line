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
var d = m(require("./403.js"));
var f = m(require("./404.js"));
var p = m(require("./2.js"));
var h = m(require("./129.js"));
function m(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var y = exports.styles = function (e) {
  return {
    root: {
      flexShrink: 0,
      color: e.palette.text.secondary,
      marginLeft: e.spacing.unit * 2.5
    }
  };
};
var g = c.default.createElement(f.default, null);
var v = c.default.createElement(d.default, null);
var b = c.default.createElement(d.default, null);
var _ = c.default.createElement(f.default, null);
var w = function (e) {
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
    r.handleBackButtonClick = function (e) {
      r.props.onChangePage(e, r.props.page - 1);
    };
    r.handleNextButtonClick = function (e) {
      r.props.onChangePage(e, r.props.page + 1);
    };
    i = n;
    return (0, l.default)(r, i);
  }
  (0, u.default)(t, e);
  (0, s.default)(t, [{
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.backIconButtonProps;
      var n = e.classes;
      var o = e.count;
      var a = e.nextIconButtonProps;
      e.onChangePage;
      var s = e.page;
      var l = e.rowsPerPage;
      var u = e.theme;
      var d = (0, i.default)(e, ["backIconButtonProps", "classes", "count", "nextIconButtonProps", "onChangePage", "page", "rowsPerPage", "theme"]);
      return c.default.createElement("div", (0, r.default)({
        className: n.root
      }, d), c.default.createElement(h.default, (0, r.default)({
        onClick: this.handleBackButtonClick,
        disabled: s === 0
      }, t), u.direction === "rtl" ? g : v), c.default.createElement(h.default, (0, r.default)({
        onClick: this.handleNextButtonClick,
        disabled: s >= Math.ceil(o / l) - 1
      }, a), u.direction === "rtl" ? b : _));
    }
  }]);
  return t;
}(c.default.Component);
w.propTypes = {};
exports.default = (0, p.default)(y, {
  name: "MuiTablePaginationActions",
  withTheme: true
})(w);