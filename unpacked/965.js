Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = d(require("./2.js"));
var s = d(require("./19.js"));
var l = require("./48.js");
var u = require("./8.js");
var c = d(require("./68.js"));
function d(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const f = (0, o.createStructuredSelector)({
  lineCount: u.getSimulatorLineCount
});
exports.default = (0, i.connect)(f)((0, a.default)({
  root: {
    marginRight: -8,
    textAlign: "right",
    padding: 4,
    "@media (max-width: 343px)": {
      display: "none"
    }
  },
  countSwatch: {
    display: "inline-block",
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginLeft: 5,
    "@media (max-width: 373px)": {
      marginLeft: 2
    },
    "@media (max-width: 355px)": {
      marginLeft: 0
    }
  },
  totalCount: {
    "@media (max-width: 401px)": {
      display: "none"
    }
  }
})(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.widgetWrapperClasses = {
      root: e.classes.root
    };
  }
  render() {
    var e = this.props;
    let t = e.classes;
    var n = e.lineCount;
    let i = n.total;
    let o = n.lineCounts;
    return r.default.createElement(c.default, {
      anchor: "bottomRight",
      align: "top",
      vertical: true,
      classes: this.widgetWrapperClasses
    }, r.default.createElement(s.default, {
      className: t.totalCount
    }, i, " line", i === 1 ? "" : "s"), r.default.createElement(s.default, null, o[0] || 0, " ", r.default.createElement("span", {
      className: t.countSwatch,
      style: {
        backgroundColor: l.blue[500]
      }
    })), r.default.createElement(s.default, null, o[1] || 0, " ", r.default.createElement("span", {
      className: t.countSwatch,
      style: {
        backgroundColor: l.red[500]
      }
    })), r.default.createElement(s.default, null, o[2] || 0, " ", r.default.createElement("span", {
      className: t.countSwatch,
      style: {
        backgroundColor: l.green[500]
      }
    })));
  }
}));
module.exports = exports.default;