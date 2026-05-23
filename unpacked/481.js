exports.__esModule = true;
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
exports.batchedSubscribe = function (e) {
  if (typeof e != "function") {
    throw new Error("Expected batch to be a function.");
  }
  var t = [];
  var n = t;
  function i() {
    if (n === t) {
      n = t.slice();
    }
  }
  function o(e) {
    if (typeof e != "function") {
      throw new Error("Expected listener to be a function.");
    }
    var t = true;
    i();
    n.push(e);
    return function () {
      if (t) {
        t = false;
        i();
        var r = n.indexOf(e);
        n.splice(r, 1);
      }
    };
  }
  function a() {
    for (var e = t = n, r = 0; r < e.length; r++) {
      e[r]();
    }
  }
  return function (t) {
    return function () {
      var n = t.apply(undefined, arguments);
      var i = n.subscribe;
      return r({}, n, {
        dispatch: function () {
          var t = n.dispatch.apply(n, arguments);
          e(a);
          return t;
        },
        subscribe: o,
        subscribeImmediate: i
      });
    };
  };
};