var t = require("./18.js");
function r(e, t) {
  if (e === t) {
    return 0;
  }
  var n = e.length;
  var r = t.length;
  for (var i = 0, o = Math.min(n, r); i < o; ++i) {
    if (e[i] !== t[i]) {
      n = e[i];
      r = t[i];
      break;
    }
  }
  if (n < r) {
    return -1;
  } else if (r < n) {
    return 1;
  } else {
    return 0;
  }
}
function i(e) {
  if (t.Buffer && typeof t.Buffer.isBuffer == "function") {
    return t.Buffer.isBuffer(e);
  } else {
    return e != null && !!e._isBuffer;
  }
}
var o = require("./603.js");
var a = Object.prototype.hasOwnProperty;
var s = Array.prototype.slice;
var l = function () {}.name === "foo";
function u(e) {
  return Object.prototype.toString.call(e);
}
function c(e) {
  return !i(e) && typeof t.ArrayBuffer == "function" && (typeof ArrayBuffer.isView == "function" ? ArrayBuffer.isView(e) : !!e && (e instanceof DataView || !!e.buffer && !!(e.buffer instanceof ArrayBuffer)));
}
var d = module.exports = g;
var f = /\s*function\s+([^\(\s]*)\s*/;
function p(e) {
  if (o.isFunction(e)) {
    if (l) {
      return e.name;
    }
    var t = e.toString().match(f);
    return t && t[1];
  }
}
function h(e, t) {
  if (typeof e == "string") {
    if (e.length < t) {
      return e;
    } else {
      return e.slice(0, t);
    }
  } else {
    return e;
  }
}
function m(e) {
  if (l || !o.isFunction(e)) {
    return o.inspect(e);
  }
  var t = p(e);
  return "[Function" + (t ? ": " + t : "") + "]";
}
function y(e, t, n, r, i) {
  throw new d.AssertionError({
    message: n,
    actual: e,
    expected: t,
    operator: r,
    stackStartFunction: i
  });
}
function g(e, t) {
  if (!e) {
    y(e, true, t, "==", d.ok);
  }
}
function v(e, t, n, a) {
  if (e === t) {
    return true;
  }
  if (i(e) && i(t)) {
    return r(e, t) === 0;
  }
  if (o.isDate(e) && o.isDate(t)) {
    return e.getTime() === t.getTime();
  }
  if (o.isRegExp(e) && o.isRegExp(t)) {
    return e.source === t.source && e.global === t.global && e.multiline === t.multiline && e.lastIndex === t.lastIndex && e.ignoreCase === t.ignoreCase;
  }
  if (e !== null && typeof e == "object" || t !== null && typeof t == "object") {
    if (c(e) && c(t) && u(e) === u(t) && !(e instanceof Float32Array) && !(e instanceof Float64Array)) {
      return r(new Uint8Array(e.buffer), new Uint8Array(t.buffer)) === 0;
    }
    if (i(e) !== i(t)) {
      return false;
    }
    var l = (a = a || {
      actual: [],
      expected: []
    }).actual.indexOf(e);
    return l !== -1 && l === a.expected.indexOf(t) || (a.actual.push(e), a.expected.push(t), function (e, t, n, r) {
      if (e === null || e === undefined || t === null || t === undefined) {
        return false;
      }
      if (o.isPrimitive(e) || o.isPrimitive(t)) {
        return e === t;
      }
      if (n && Object.getPrototypeOf(e) !== Object.getPrototypeOf(t)) {
        return false;
      }
      var i = b(e);
      var a = b(t);
      if (i && !a || !i && a) {
        return false;
      }
      if (i) {
        e = s.call(e);
        t = s.call(t);
        return v(e, t, n);
      }
      var l;
      var u;
      var c = x(e);
      var d = x(t);
      if (c.length !== d.length) {
        return false;
      }
      c.sort();
      d.sort();
      u = c.length - 1;
      for (; u >= 0; u--) {
        if (c[u] !== d[u]) {
          return false;
        }
      }
      for (u = c.length - 1; u >= 0; u--) {
        l = c[u];
        if (!v(e[l], t[l], n, r)) {
          return false;
        }
      }
      return true;
    }(e, t, n, a));
  }
  if (n) {
    return e === t;
  } else {
    return e == t;
  }
}
function b(e) {
  return Object.prototype.toString.call(e) == "[object Arguments]";
}
function _(e, t) {
  if (!e || !t) {
    return false;
  }
  if (Object.prototype.toString.call(t) == "[object RegExp]") {
    return t.test(e);
  }
  try {
    if (e instanceof t) {
      return true;
    }
  } catch (e) {}
  return !Error.isPrototypeOf(t) && t.call({}, e) === true;
}
function w(e, t, n, r) {
  var i;
  if (typeof t != "function") {
    throw new TypeError("\"block\" argument must be a function");
  }
  if (typeof n == "string") {
    r = n;
    n = null;
  }
  i = function (e) {
    var t;
    try {
      e();
    } catch (e) {
      t = e;
    }
    return t;
  }(t);
  r = (n && n.name ? " (" + n.name + ")." : ".") + (r ? " " + r : ".");
  if (e && !i) {
    y(i, n, "Missing expected exception" + r);
  }
  var a = typeof r == "string";
  var s = !e && o.isError(i);
  var l = !e && i && !n;
  if (s && a && _(i, n) || l) {
    y(i, n, "Got unwanted exception" + r);
  }
  if (e && i && n && !_(i, n) || !e && i) {
    throw i;
  }
}
d.AssertionError = function (e) {
  var t;
  this.name = "AssertionError";
  this.actual = e.actual;
  this.expected = e.expected;
  this.operator = e.operator;
  if (e.message) {
    this.message = e.message;
    this.generatedMessage = false;
  } else {
    this.message = h(m((t = this).actual), 128) + " " + t.operator + " " + h(m(t.expected), 128);
    this.generatedMessage = true;
  }
  var n = e.stackStartFunction || y;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, n);
  } else {
    var r = new Error();
    if (r.stack) {
      var i = r.stack;
      var o = p(n);
      var a = i.indexOf("\n" + o);
      if (a >= 0) {
        var s = i.indexOf("\n", a + 1);
        i = i.substring(s + 1);
      }
      this.stack = i;
    }
  }
};
o.inherits(d.AssertionError, Error);
d.fail = y;
d.ok = g;
d.equal = function (e, t, n) {
  if (e != t) {
    y(e, t, n, "==", d.equal);
  }
};
d.notEqual = function (e, t, n) {
  if (e == t) {
    y(e, t, n, "!=", d.notEqual);
  }
};
d.deepEqual = function (e, t, n) {
  if (!v(e, t, false)) {
    y(e, t, n, "deepEqual", d.deepEqual);
  }
};
d.deepStrictEqual = function (e, t, n) {
  if (!v(e, t, true)) {
    y(e, t, n, "deepStrictEqual", d.deepStrictEqual);
  }
};
d.notDeepEqual = function (e, t, n) {
  if (v(e, t, false)) {
    y(e, t, n, "notDeepEqual", d.notDeepEqual);
  }
};
d.notDeepStrictEqual = function e(t, n, r) {
  if (v(t, n, true)) {
    y(t, n, r, "notDeepStrictEqual", e);
  }
};
d.strictEqual = function (e, t, n) {
  if (e !== t) {
    y(e, t, n, "===", d.strictEqual);
  }
};
d.notStrictEqual = function (e, t, n) {
  if (e === t) {
    y(e, t, n, "!==", d.notStrictEqual);
  }
};
d.throws = function (e, t, n) {
  w(true, e, t, n);
};
d.doesNotThrow = function (e, t, n) {
  w(false, e, t, n);
};
d.ifError = function (e) {
  if (e) {
    throw e;
  }
};
var x = Object.keys || function (e) {
  var t = [];
  for (var n in e) {
    if (a.call(e, n)) {
      t.push(n);
    }
  }
  return t;
};