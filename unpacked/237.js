Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.CHANNEL = undefined;
var r = o(require("./6.js"));
var i = o(require("./1.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var a = exports.CHANNEL = "__THEMING__";
var s = {
  contextTypes: (0, r.default)({}, a, i.default.object),
  initial: function (e) {
    if (e[a]) {
      return e[a].getState();
    } else {
      return null;
    }
  },
  subscribe: function (e, t) {
    if (e[a]) {
      return e[a].subscribe(t);
    } else {
      return null;
    }
  },
  unsubscribe: function (e, t) {
    if (e[a]) {
      e[a].unsubscribe(t);
    }
  }
};
exports.default = s;