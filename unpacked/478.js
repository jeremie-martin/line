Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createReducer = c;
exports.configureStore = function (e, t) {
  e = e || c();
  t = t || (0, u.default)();
  let n = (0, i.applyMiddleware)(...t);
  if (!window.doNotBatch) {
    n = (0, i.compose)(n, (0, o.batchedSubscribe)(function () {
      let e;
      let t;
      let n = false;
      return function (r) {
        if (!n) {
          n = true;
          const i = () => {
            (0, a.unstable_batchedUpdates)(r);
            cancelAnimationFrame(e);
            clearTimeout(t);
            n = false;
          };
          e = requestAnimationFrame(i);
          t = setTimeout(i, 200);
        }
      };
    }()));
  }
  return (0, i.createStore)(e, n);
};
var r;
var i = require("./181.js");
var o = require("./481.js");
var a = require("./21.js");
var s = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./489.js"));
var l = require("./568.js");
var u = (r = l) && r.__esModule ? r : {
  default: r
};
function c() {
  return (0, i.combineReducers)(s);
}