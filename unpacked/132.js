Object.defineProperty(exports, "__esModule", {
  value: true
});
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
var i = c(require("./0.js"));
var o = require("./93.js");
var a = c(o);
var s = c(require("./2.js"));
var l = c(require("./19.js"));
var u = require("./22.js");
function c(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, s.default)(e => ({
  panel: {
    margin: 0,
    boxShadow: "none",
    backgroundColor: "initial",
    borderBottom: `1px solid ${e.palette.divider}`,
    "&:before": {
      display: "none"
    }
  },
  icon: {
    color: e.palette.action.active,
    position: "relative",
    left: -10
  },
  expandIcon: {
    color: e.palette.action.active
  },
  details: {
    display: "block",
    paddingLeft: e.spacing.unit,
    paddingRight: e.spacing.unit
  }
}))(class extends i.default.PureComponent {
  render() {
    var e = this.props;
    let t = e.Icon;
    let n = e.heading;
    let s = e.children;
    let c = e.classes;
    let d = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["Icon", "heading", "children", "classes"]);
    return i.default.createElement(a.default, r({
      className: c.panel,
      innerRef: e => this.panelRef = e
    }, d), i.default.createElement(o.ExpansionPanelSummary, {
      expandIcon: i.default.createElement(u.ChevronDown.Icon, {
        className: c.expandIcon
      })
    }, t && i.default.createElement(t, {
      className: c.icon
    }), i.default.createElement(l.default, {
      type: "subheading"
    }, n)), i.default.createElement(o.ExpansionPanelDetails, {
      className: c.details
    }, s));
  }
});
module.exports = exports.default;