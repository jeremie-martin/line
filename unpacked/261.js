exports.default = function (e) {
  var t = {};
  var n = 1;
  var r = e;
  return {
    getState: function () {
      return r;
    },
    setState: function (e) {
      r = e;
      var n = Object.keys(t);
      for (var i = 0, o = n.length; i < o; i++) {
        if (t[n[i]]) {
          t[n[i]](e);
        }
      }
    },
    subscribe: function (e) {
      if (typeof e != "function") {
        throw new Error("listener must be a function.");
      }
      var r = n;
      t[r] = e;
      n += 1;
      return r;
    },
    unsubscribe: function (e) {
      t[e] = undefined;
    }
  };
};