function n(e, t) {
  for (var n = 0; n < e.length; ++n) {
    if (e[n] === t) {
      return n;
    }
  }
  return -1;
}
function r(e, t) {
  var r = [];
  var i = [];
  if (t == null) {
    t = function (e, t) {
      if (r[0] === t) {
        return "[Circular ~]";
      } else {
        return "[Circular ~." + i.slice(0, n(r, t)).join(".") + "]";
      }
    };
  }
  return function (o, a) {
    if (r.length > 0) {
      var s = n(r, this);
      if (~s) {
        r.splice(s + 1);
      } else {
        r.push(this);
      }
      if (~s) {
        i.splice(s, Infinity, o);
      } else {
        i.push(o);
      }
      if (~n(r, a)) {
        a = t.call(this, o, a);
      }
    } else {
      r.push(a);
    }
    if (e == null) {
      if (a instanceof Error) {
        return function (e) {
          var t = {
            stack: e.stack,
            message: e.message,
            name: e.name
          };
          for (var n in e) {
            if (Object.prototype.hasOwnProperty.call(e, n)) {
              t[n] = e[n];
            }
          }
          return t;
        }(a);
      } else {
        return a;
      }
    } else {
      return e.call(this, o, a);
    }
  };
}
(module.exports = function (e, t, n, i) {
  return JSON.stringify(e, r(t, i), n);
}).getSerialize = r;