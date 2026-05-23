Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = d(require("./0.js"));
var i = require("./15.js");
var o = require("./17.js");
var a = require("./7.js");
var s = d(require("./19.js"));
var l = require("./8.js");
var u = d(require("./90.js"));
var c = d(require("./259.js"));
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
  trackTitle: e => (0, l.getTrackDetails)(e).title
});
exports.default = (0, i.connect)(f)(class extends r.default.PureComponent {
  constructor(e) {
    super(e);
    this.trackTitle = e.trackTitle;
  }
  render() {
    return r.default.createElement(c.default, this.props, r.default.createElement(s.default, {
      align: "center",
      paragraph: true
    }, "Loading \"", this.trackTitle, "\""), r.default.createElement(u.default, {
      id: a.LOAD_TRACK
    }));
  }
});
module.exports = exports.default;