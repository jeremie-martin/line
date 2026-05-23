exports.__esModule = true;
var r = a(require("./660.js"));
var i = a(require("./664.js"));
var o = a(require("./155.js"));
function a(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e, t) {
  if (typeof t != "function" && t !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + (t === undefined ? "undefined" : (0, o.default)(t)));
  }
  e.prototype = (0, i.default)(t && t.prototype, {
    constructor: {
      value: e,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (t) {
    if (r.default) {
      (0, r.default)(e, t);
    } else {
      e.__proto__ = t;
    }
  }
};