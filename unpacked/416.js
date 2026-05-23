module.exports = function () {
  "use strict";

  var e = {
    childContextTypes: true,
    contextTypes: true,
    defaultProps: true,
    displayName: true,
    getDefaultProps: true,
    getDerivedStateFromProps: true,
    mixins: true,
    propTypes: true,
    type: true
  };
  var t = {
    name: true,
    length: true,
    prototype: true,
    caller: true,
    callee: true,
    arguments: true,
    arity: true
  };
  var n = Object.defineProperty;
  var r = Object.getOwnPropertyNames;
  var i = Object.getOwnPropertySymbols;
  var o = Object.getOwnPropertyDescriptor;
  var a = Object.getPrototypeOf;
  var s = a && a(Object);
  return function l(u, c, d) {
    if (typeof c != "string") {
      if (s) {
        var f = a(c);
        if (f && f !== s) {
          l(u, f, d);
        }
      }
      var p = r(c);
      if (i) {
        p = p.concat(i(c));
      }
      for (var h = 0; h < p.length; ++h) {
        var m = p[h];
        if (!e[m] && !t[m] && (!d || !d[m])) {
          var y = o(c, m);
          try {
            n(u, m, y);
          } catch (e) {}
        }
      }
      return u;
    }
    return u;
  };
}();