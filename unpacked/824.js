Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = s(require("./82.js"));
var i = s(require("./0.js"));
var o = require("./15.js");
var a = require("./7.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = (0, o.connect)(null, {
  disableMillions: a.disableMillions
})(class extends i.default.PureComponent {
  componentDidCatch(e, t) {
    requestAnimationFrame(() => this.props.disableMillions());
    if (!e.message.includes("Could not compile shader:")) {
      switch (e.message) {
        case "The GPU device instance has been suspended. Use GetDeviceRemovedReason to determine the appropriate action.":
        case "Cannot read property 'createProgram' of null":
        case "An attempt was made to break through the security policy of the user agent.":
        case "DOM Exception 18":
          return;
      }
      r.default.captureException(e);
    }
  }
  render() {
    return this.props.children;
  }
});
module.exports = exports.default;