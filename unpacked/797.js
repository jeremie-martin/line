exports.__esModule = true;
var r = require("./0.js");
i(require("./362.js"));
i(require("./119.js"));
function i(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = function (e) {
  return function (t) {
    var n = (0, r.createFactory)(t);
    return function (t) {
      function r() {
        (function (e, t) {
          if (!(e instanceof t)) {
            throw new TypeError("Cannot call a class as a function");
          }
        })(this, r);
        return function (e, t) {
          if (!e) {
            throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
          }
          if (!t || typeof t != "object" && typeof t != "function") {
            return e;
          } else {
            return t;
          }
        }(this, t.apply(this, arguments));
      }
      (function (e, t) {
        if (typeof t != "function" && t !== null) {
          throw new TypeError("Super expression must either be null or a function, not " + typeof t);
        }
        e.prototype = Object.create(t && t.prototype, {
          constructor: {
            value: e,
            enumerable: false,
            writable: true,
            configurable: true
          }
        });
        if (t) {
          if (Object.setPrototypeOf) {
            Object.setPrototypeOf(e, t);
          } else {
            e.__proto__ = t;
          }
        }
      })(r, t);
      r.prototype.shouldComponentUpdate = function (t) {
        return e(this.props, t);
      };
      r.prototype.render = function () {
        return n(this.props);
      };
      return r;
    }(r.Component);
  };
};