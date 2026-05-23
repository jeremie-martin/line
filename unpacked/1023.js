function n() {}
n.prototype = {
  on: function (e, t, n) {
    var r = this.e ||= {};
    (r[e] ||= []).push({
      fn: t,
      ctx: n
    });
    return this;
  },
  once: function (e, t, n) {
    var r = this;
    function i() {
      r.off(e, i);
      t.apply(n, arguments);
    }
    i._ = t;
    return this.on(e, i, n);
  },
  emit: function (e) {
    var t = [].slice.call(arguments, 1);
    var n = ((this.e ||= {})[e] || []).slice();
    for (var r = 0, i = n.length; r < i; r++) {
      n[r].fn.apply(n[r].ctx, t);
    }
    return this;
  },
  off: function (e, t) {
    var n = this.e ||= {};
    var r = n[e];
    var i = [];
    if (r && t) {
      for (var o = 0, a = r.length; o < a; o++) {
        if (r[o].fn !== t && r[o].fn._ !== t) {
          i.push(r[o]);
        }
      }
    }
    if (i.length) {
      n[e] = i;
    } else {
      delete n[e];
    }
    return this;
  }
};
module.exports = n;