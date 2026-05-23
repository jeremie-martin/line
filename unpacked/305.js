import * as e from "./18.js";
var n = require("./589.js").setImmediate;
var r = Object.keys;
var i = Array.isArray;
var o = typeof self != "undefined" ? self : typeof window != "undefined" ? window : e;
function a(e, t) {
  if (typeof t != "object") {
    return e;
  } else {
    r(t).forEach(function (n) {
      e[n] = t[n];
    });
    return e;
  }
}
var s = Object.getPrototypeOf;
var l = {}.hasOwnProperty;
function u(e, t) {
  return l.call(e, t);
}
function c(e, t) {
  if (typeof t == "function") {
    t = t(s(e));
  }
  r(t).forEach(function (n) {
    f(e, n, t[n]);
  });
}
var d = Object.defineProperty;
function f(e, t, n, r) {
  d(e, t, a(n && u(n, "get") && typeof n.get == "function" ? {
    get: n.get,
    set: n.set,
    configurable: true
  } : {
    value: n,
    configurable: true,
    writable: true
  }, r));
}
function p(e) {
  return {
    from: function (t) {
      e.prototype = Object.create(t.prototype);
      f(e.prototype, "constructor", e);
      return {
        extend: c.bind(null, e.prototype)
      };
    }
  };
}
var h = Object.getOwnPropertyDescriptor;
var m = [].slice;
function y(e, t, n) {
  return m.call(e, t, n);
}
function g(e, t) {
  return t(e);
}
function v(e) {
  if (!e) {
    throw new Error("Assertion Failed");
  }
}
function b(e) {
  if (o.setImmediate) {
    n(e);
  } else {
    setTimeout(e, 0);
  }
}
function _(e, t) {
  return e.reduce(function (e, n, r) {
    var i = t(n, r);
    if (i) {
      e[i[0]] = i[1];
    }
    return e;
  }, {});
}
function w(e, t) {
  return function () {
    try {
      e.apply(this, arguments);
    } catch (e) {
      t(e);
    }
  };
}
function x(e, t, n) {
  try {
    e.apply(null, n);
  } catch (e) {
    if (t) {
      t(e);
    }
  }
}
function E(e, t) {
  if (u(e, t)) {
    return e[t];
  }
  if (!t) {
    return e;
  }
  if (typeof t != "string") {
    var n = [];
    for (var r = 0, i = t.length; r < i; ++r) {
      var o = E(e, t[r]);
      n.push(o);
    }
    return n;
  }
  var a = t.indexOf(".");
  if (a !== -1) {
    var s = e[t.substr(0, a)];
    if (s === undefined) {
      return undefined;
    } else {
      return E(s, t.substr(a + 1));
    }
  }
}
function S(e, t, n) {
  if (e && t !== undefined && (!("isFrozen" in Object) || !Object.isFrozen(e))) {
    if (typeof t != "string" && "length" in t) {
      v(typeof n != "string" && "length" in n);
      for (var r = 0, i = t.length; r < i; ++r) {
        S(e, t[r], n[r]);
      }
    } else {
      var o = t.indexOf(".");
      if (o !== -1) {
        var a = t.substr(0, o);
        var s = t.substr(o + 1);
        if (s === "") {
          if (n === undefined) {
            delete e[a];
          } else {
            e[a] = n;
          }
        } else {
          var l = e[a];
          l ||= e[a] = {};
          S(l, s, n);
        }
      } else if (n === undefined) {
        delete e[t];
      } else {
        e[t] = n;
      }
    }
  }
}
function T(e) {
  var t = {};
  for (var n in e) {
    if (u(e, n)) {
      t[n] = e[n];
    }
  }
  return t;
}
var k = [].concat;
function O(e) {
  return k.apply([], e);
}
var P = "Boolean,String,Date,RegExp,Blob,File,FileList,ArrayBuffer,DataView,Uint8ClampedArray,ImageData,Map,Set".split(",").concat(O([8, 16, 32, 64].map(function (e) {
  return ["Int", "Uint", "Float"].map(function (t) {
    return t + e + "Array";
  });
}))).filter(function (e) {
  return o[e];
}).map(function (e) {
  return o[e];
});
function C(e) {
  if (!e || typeof e != "object") {
    return e;
  }
  var t;
  if (i(e)) {
    t = [];
    for (var n = 0, r = e.length; n < r; ++n) {
      t.push(C(e[n]));
    }
  } else if (P.indexOf(e.constructor) >= 0) {
    t = e;
  } else {
    t = e.constructor ? Object.create(e.constructor.prototype) : {};
    for (var o in e) {
      if (u(e, o)) {
        t[o] = C(e[o]);
      }
    }
  }
  return t;
}
function I(e, t, n, i) {
  n = n || {};
  i = i || "";
  r(e).forEach(function (r) {
    if (u(t, r)) {
      var o = e[r];
      var a = t[r];
      if (typeof o == "object" && typeof a == "object" && o && a && "" + o.constructor == "" + a.constructor) {
        I(o, a, n, i + r + ".");
      } else if (o !== a) {
        n[i + r] = t[r];
      }
    } else {
      n[i + r] = undefined;
    }
  });
  r(t).forEach(function (r) {
    if (!u(e, r)) {
      n[i + r] = t[r];
    }
  });
  return n;
}
var M = typeof Symbol != "undefined" && Symbol.iterator;
var L = M ? function (e) {
  var t;
  return e != null && (t = e[M]) && t.apply(e);
} : function () {
  return null;
};
var R = {};
function A(e) {
  var t;
  var n;
  var r;
  var o;
  if (arguments.length === 1) {
    if (i(e)) {
      return e.slice();
    }
    if (this === R && typeof e == "string") {
      return [e];
    }
    if (o = L(e)) {
      for (n = []; !(r = o.next()).done;) {
        n.push(r.value);
      }
      return n;
    }
    if (e == null) {
      return [e];
    }
    if (typeof (t = e.length) == "number") {
      for (n = new Array(t); t--;) {
        n[t] = e[t];
      }
      return n;
    }
    return [e];
  }
  t = arguments.length;
  n = new Array(t);
  while (t--) {
    n[t] = arguments[t];
  }
  return n;
}
var D = typeof location != "undefined" && /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);
function N(e, t) {
  D = e;
  j = t;
}
function j() {
  return true;
}
var F = !new Error("").stack;
function B() {
  if (F) {
    try {
      B.arguments;
      throw new Error();
    } catch (e) {
      return e;
    }
  }
  return new Error();
}
function U(e, t) {
  var n = e.stack;
  if (n) {
    t = t || 0;
    if (n.indexOf(e.name) === 0) {
      t += (e.name + e.message).split("\n").length;
    }
    return n.split("\n").slice(t).filter(j).map(function (e) {
      return "\n" + e;
    }).join("");
  } else {
    return "";
  }
}
var z = ["Unknown", "Constraint", "Data", "TransactionInactive", "ReadOnly", "Version", "NotFound", "InvalidState", "InvalidAccess", "Abort", "Timeout", "QuotaExceeded", "Syntax", "DataClone"];
var H = ["Modify", "Bulk", "OpenFailed", "VersionChange", "Schema", "Upgrade", "InvalidTable", "MissingAPI", "NoSuchDatabase", "InvalidArgument", "SubTransaction", "Unsupported", "Internal", "DatabaseClosed", "PrematureCommit", "ForeignAwait"].concat(z);
var V = {
  VersionChanged: "Database version changed by other database connection",
  DatabaseClosed: "Database has been closed",
  Abort: "Transaction aborted",
  TransactionInactive: "Transaction has already completed or failed"
};
function W(e, t) {
  this._e = B();
  this.name = e;
  this.message = t;
}
function q(e, t, n, r) {
  this._e = B();
  this.failures = t;
  this.failedKeys = r;
  this.successCount = n;
}
function G(e, t) {
  this._e = B();
  this.name = "BulkError";
  this.failures = t;
  this.message = function (e, t) {
    return e + ". Errors: " + t.map(function (e) {
      return e.toString();
    }).filter(function (e, t, n) {
      return n.indexOf(e) === t;
    }).join("\n");
  }(e, t);
}
p(W).from(Error).extend({
  stack: {
    get: function () {
      return this._stack ||= this.name + ": " + this.message + U(this._e, 2);
    }
  },
  toString: function () {
    return this.name + ": " + this.message;
  }
});
p(q).from(W);
p(G).from(W);
var K = H.reduce(function (e, t) {
  e[t] = t + "Error";
  return e;
}, {});
var Y = W;
var $ = H.reduce(function (e, t) {
  var n = t + "Error";
  function r(e, r) {
    this._e = B();
    this.name = n;
    if (e) {
      if (typeof e == "string") {
        this.message = e;
        this.inner = r || null;
      } else if (typeof e == "object") {
        this.message = e.name + " " + e.message;
        this.inner = e;
      }
    } else {
      this.message = V[t] || n;
      this.inner = null;
    }
  }
  p(r).from(Y);
  e[t] = r;
  return e;
}, {});
$.Syntax = SyntaxError;
$.Type = TypeError;
$.Range = RangeError;
var X = z.reduce(function (e, t) {
  e[t + "Error"] = $[t];
  return e;
}, {});
var Z = H.reduce(function (e, t) {
  if (["Syntax", "Type", "Range"].indexOf(t) === -1) {
    e[t + "Error"] = $[t];
  }
  return e;
}, {});
function J() {}
function Q(e) {
  return e;
}
function ee(e, t) {
  if (e == null || e === Q) {
    return t;
  } else {
    return function (n) {
      return t(e(n));
    };
  }
}
function te(e, t) {
  return function () {
    e.apply(this, arguments);
    t.apply(this, arguments);
  };
}
function ne(e, t) {
  if (e === J) {
    return t;
  } else {
    return function () {
      var n = e.apply(this, arguments);
      if (n !== undefined) {
        arguments[0] = n;
      }
      var r = this.onsuccess;
      var i = this.onerror;
      this.onsuccess = null;
      this.onerror = null;
      var o = t.apply(this, arguments);
      if (r) {
        this.onsuccess = this.onsuccess ? te(r, this.onsuccess) : r;
      }
      if (i) {
        this.onerror = this.onerror ? te(i, this.onerror) : i;
      }
      if (o !== undefined) {
        return o;
      } else {
        return n;
      }
    };
  }
}
function re(e, t) {
  if (e === J) {
    return t;
  } else {
    return function () {
      e.apply(this, arguments);
      var n = this.onsuccess;
      var r = this.onerror;
      this.onsuccess = this.onerror = null;
      t.apply(this, arguments);
      if (n) {
        this.onsuccess = this.onsuccess ? te(n, this.onsuccess) : n;
      }
      if (r) {
        this.onerror = this.onerror ? te(r, this.onerror) : r;
      }
    };
  }
}
function ie(e, t) {
  if (e === J) {
    return t;
  } else {
    return function (n) {
      var r = e.apply(this, arguments);
      a(n, r);
      var i = this.onsuccess;
      var o = this.onerror;
      this.onsuccess = null;
      this.onerror = null;
      var s = t.apply(this, arguments);
      if (i) {
        this.onsuccess = this.onsuccess ? te(i, this.onsuccess) : i;
      }
      if (o) {
        this.onerror = this.onerror ? te(o, this.onerror) : o;
      }
      if (r === undefined) {
        if (s === undefined) {
          return undefined;
        } else {
          return s;
        }
      } else {
        return a(r, s);
      }
    };
  }
}
function oe(e, t) {
  if (e === J) {
    return t;
  } else {
    return function () {
      return t.apply(this, arguments) !== false && e.apply(this, arguments);
    };
  }
}
function ae(e, t) {
  if (e === J) {
    return t;
  } else {
    return function () {
      var n = e.apply(this, arguments);
      if (n && typeof n.then == "function") {
        var r = this;
        for (var i = arguments.length, o = new Array(i); i--;) {
          o[i] = arguments[i];
        }
        return n.then(function () {
          return t.apply(r, o);
        });
      }
      return t.apply(this, arguments);
    };
  }
}
Z.ModifyError = q;
Z.DexieError = W;
Z.BulkError = G;
var se = {};
var le = 100;
var ue = 7;
var ce = function () {
  try {
    return new Function("let F=async ()=>{},p=F();return [p,Object.getPrototypeOf(p),Promise.resolve(),F.constructor];")();
  } catch (t) {
    var e = o.Promise;
    if (e) {
      return [e.resolve(), e.prototype, e.resolve()];
    } else {
      return [];
    }
  }
}();
var de = ce[0];
var fe = ce[1];
var pe = ce[2];
var he = fe && fe.then;
var me = de && de.constructor;
var ye = ce[3];
var ge = !!pe;
var ve = false;
var be = pe ? function () {
  pe.then(Ue);
} : o.setImmediate ? n.bind(null, Ue) : o.MutationObserver ? function () {
  var e = document.createElement("div");
  new MutationObserver(function () {
    Ue();
    e = null;
  }).observe(e, {
    attributes: true
  });
  e.setAttribute("i", "1");
} : function () {
  setTimeout(Ue, 0);
};
function _e(e, t) {
  Ce.push([e, t]);
  if (xe) {
    be();
    xe = false;
  }
}
var we = true;
var xe = true;
var Ee = [];
var Se = [];
var Te = null;
var ke = Q;
var Oe = {
  id: "global",
  global: true,
  ref: 0,
  unhandleds: [],
  onunhandled: ut,
  pgp: false,
  env: {},
  finalize: function () {
    this.unhandleds.forEach(function (e) {
      try {
        ut(e[0], e[1]);
      } catch (e) {}
    });
  }
};
var Pe = Oe;
var Ce = [];
var Ie = 0;
var Me = [];
function Le(e) {
  if (typeof this != "object") {
    throw new TypeError("Promises must be constructed via new");
  }
  this._listeners = [];
  this.onuncatched = J;
  this._lib = false;
  var t = this._PSD = Pe;
  if (D) {
    this._stackHolder = B();
    this._prev = null;
    this._numPrev = 0;
  }
  if (typeof e != "function") {
    if (e !== se) {
      throw new TypeError("Not a function");
    }
    this._state = arguments[1];
    this._value = arguments[2];
    if (this._state === false) {
      De(this, this._value);
    }
    return;
  }
  this._state = null;
  this._value = null;
  ++t.ref;
  (function e(t, n) {
    try {
      n(function (n) {
        if (t._state === null) {
          if (n === t) {
            throw new TypeError("A promise cannot be resolved with itself.");
          }
          var r = t._lib && ze();
          if (n && typeof n.then == "function") {
            e(t, function (e, t) {
              if (n instanceof Le) {
                n._then(e, t);
              } else {
                n.then(e, t);
              }
            });
          } else {
            t._state = true;
            t._value = n;
            Ne(t);
          }
          if (r) {
            He();
          }
        }
      }, De.bind(null, t));
    } catch (e) {
      De(t, e);
    }
  })(this, e);
}
var Re = {
  get: function () {
    var e = Pe;
    var t = Xe;
    function n(n, r) {
      var i = this;
      var o = !e.global && (e !== Pe || t !== Xe);
      if (o) {
        et();
      }
      var a = new Le(function (t, a) {
        je(i, new Ae(at(n, e, o), at(r, e, o), t, a, e));
      });
      if (D) {
        Be(a, this);
      }
      return a;
    }
    n.prototype = se;
    return n;
  },
  set: function (e) {
    f(this, "then", e && e.prototype === se ? Re : {
      get: function () {
        return e;
      },
      set: Re.set
    });
  }
};
function Ae(e, t, n, r, i) {
  this.onFulfilled = typeof e == "function" ? e : null;
  this.onRejected = typeof t == "function" ? t : null;
  this.resolve = n;
  this.reject = r;
  this.psd = i;
}
function De(e, t) {
  Se.push(t);
  if (e._state === null) {
    var n = e._lib && ze();
    t = ke(t);
    e._state = false;
    e._value = t;
    if (D && t !== null && typeof t == "object" && !t._promise) {
      x(function () {
        var n = function e(t, n) {
          var r;
          return h(t, n) || (r = s(t)) && e(r, n);
        }(t, "stack");
        t._promise = e;
        f(t, "stack", {
          get: function () {
            if (ve) {
              return n && (n.get ? n.get.apply(t) : n.value);
            } else {
              return e.stack;
            }
          }
        });
      });
    }
    (function (e) {
      if (!Ee.some(function (t) {
        return t._value === e._value;
      })) {
        Ee.push(e);
      }
    })(e);
    Ne(e);
    if (n) {
      He();
    }
  }
}
function Ne(e) {
  var t = e._listeners;
  e._listeners = [];
  for (var n = 0, r = t.length; n < r; ++n) {
    je(e, t[n]);
  }
  var i = e._PSD;
  if (! --i.ref) {
    i.finalize();
  }
  if (Ie === 0) {
    ++Ie;
    _e(function () {
      if (--Ie == 0) {
        Ve();
      }
    }, []);
  }
}
function je(e, t) {
  if (e._state !== null) {
    var n = e._state ? t.onFulfilled : t.onRejected;
    if (n === null) {
      return (e._state ? t.resolve : t.reject)(e._value);
    }
    ++t.psd.ref;
    ++Ie;
    _e(Fe, [n, e, t]);
  } else {
    e._listeners.push(t);
  }
}
function Fe(e, t, n) {
  try {
    Te = t;
    var r;
    var i = t._value;
    if (t._state) {
      r = e(i);
    } else {
      if (Se.length) {
        Se = [];
      }
      r = e(i);
      if (Se.indexOf(i) === -1) {
        (function (e) {
          var t = Ee.length;
          while (t) {
            if (Ee[--t]._value === e._value) {
              Ee.splice(t, 1);
              return;
            }
          }
        })(t);
      }
    }
    n.resolve(r);
  } catch (e) {
    n.reject(e);
  } finally {
    Te = null;
    if (--Ie == 0) {
      Ve();
    }
    if (! --n.psd.ref) {
      n.psd.finalize();
    }
  }
}
function Be(e, t) {
  var n = t ? t._numPrev + 1 : 0;
  if (n < le) {
    e._prev = t;
    e._numPrev = n;
  }
}
function Ue() {
  if (ze()) {
    He();
  }
}
function ze() {
  var e = we;
  we = false;
  xe = false;
  return e;
}
function He() {
  var e;
  var t;
  var n;
  do {
    while (Ce.length > 0) {
      e = Ce;
      Ce = [];
      n = e.length;
      t = 0;
      for (; t < n; ++t) {
        var r = e[t];
        r[0].apply(null, r[1]);
      }
    }
  } while (Ce.length > 0);
  we = true;
  xe = true;
}
function Ve() {
  var e = Ee;
  Ee = [];
  e.forEach(function (e) {
    e._PSD.onunhandled.call(null, e._value, e);
  });
  var t = Me.slice(0);
  for (var n = t.length; n;) {
    t[--n]();
  }
}
function We(e) {
  return new Le(se, false, e);
}
function qe(e, t) {
  var n = Pe;
  return function () {
    var r = ze();
    var i = Pe;
    try {
      rt(n, true);
      return e.apply(this, arguments);
    } catch (e) {
      if (t) {
        t(e);
      }
    } finally {
      rt(i, false);
      if (r) {
        He();
      }
    }
  };
}
c(Le.prototype, {
  then: Re,
  _then: function (e, t) {
    je(this, new Ae(null, null, e, t, Pe));
  },
  catch: function (e) {
    if (arguments.length === 1) {
      return this.then(null, e);
    }
    var t = arguments[0];
    var n = arguments[1];
    if (typeof t == "function") {
      return this.then(null, function (e) {
        if (e instanceof t) {
          return n(e);
        } else {
          return We(e);
        }
      });
    } else {
      return this.then(null, function (e) {
        if (e && e.name === t) {
          return n(e);
        } else {
          return We(e);
        }
      });
    }
  },
  finally: function (e) {
    return this.then(function (t) {
      e();
      return t;
    }, function (t) {
      e();
      return We(t);
    });
  },
  stack: {
    get: function () {
      if (this._stack) {
        return this._stack;
      }
      try {
        ve = true;
        var e = function e(t, n, r) {
          if (n.length === r) {
            return n;
          }
          var i = "";
          if (t._state === false) {
            var o;
            var a;
            var s = t._value;
            if (s != null) {
              o = s.name || "Error";
              a = s.message || s;
              i = U(s, 0);
            } else {
              o = s;
              a = "";
            }
            n.push(o + (a ? ": " + a : "") + i);
          }
          if (D) {
            if ((i = U(t._stackHolder, 2)) && n.indexOf(i) === -1) {
              n.push(i);
            }
            if (t._prev) {
              e(t._prev, n, r);
            }
          }
          return n;
        }(this, [], 20).join("\nFrom previous: ");
        if (this._state !== null) {
          this._stack = e;
        }
        return e;
      } finally {
        ve = false;
      }
    }
  },
  timeout: function (e, t) {
    var n = this;
    if (e < Infinity) {
      return new Le(function (r, i) {
        var o = setTimeout(function () {
          return i(new $.Timeout(t));
        }, e);
        n.then(r, i).finally(clearTimeout.bind(null, o));
      });
    } else {
      return this;
    }
  }
});
if (typeof Symbol != "undefined" && Symbol.toStringTag) {
  f(Le.prototype, Symbol.toStringTag, "Promise");
}
Oe.env = it();
c(Le, {
  all: function () {
    var e = A.apply(null, arguments).map(tt);
    return new Le(function (t, n) {
      if (e.length === 0) {
        t([]);
      }
      var r = e.length;
      e.forEach(function (i, o) {
        return Le.resolve(i).then(function (n) {
          e[o] = n;
          if (! --r) {
            t(e);
          }
        }, n);
      });
    });
  },
  resolve: function (e) {
    if (e instanceof Le) {
      return e;
    }
    if (e && typeof e.then == "function") {
      return new Le(function (t, n) {
        e.then(t, n);
      });
    }
    var t = new Le(se, true, e);
    Be(t, Te);
    return t;
  },
  reject: We,
  race: function () {
    var e = A.apply(null, arguments).map(tt);
    return new Le(function (t, n) {
      e.map(function (e) {
        return Le.resolve(e).then(t, n);
      });
    });
  },
  PSD: {
    get: function () {
      return Pe;
    },
    set: function (e) {
      return Pe = e;
    }
  },
  newPSD: Je,
  usePSD: ot,
  scheduler: {
    get: function () {
      return _e;
    },
    set: function (e) {
      _e = e;
    }
  },
  rejectionMapper: {
    get: function () {
      return ke;
    },
    set: function (e) {
      ke = e;
    }
  },
  follow: function (e, t) {
    return new Le(function (n, r) {
      return Je(function (t, n) {
        var r = Pe;
        r.unhandleds = [];
        r.onunhandled = n;
        r.finalize = te(function () {
          var e = this;
          (function (e) {
            Me.push(function t() {
              e();
              Me.splice(Me.indexOf(t), 1);
            });
            ++Ie;
            _e(function () {
              if (--Ie == 0) {
                Ve();
              }
            }, []);
          })(function () {
            if (e.unhandleds.length === 0) {
              t();
            } else {
              n(e.unhandleds[0]);
            }
          });
        }, r.finalize);
        e();
      }, t, n, r);
    });
  }
});
var Ge = {
  awaits: 0,
  echoes: 0,
  id: 0
};
var Ke = 0;
var Ye = [];
var $e = 0;
var Xe = 0;
var Ze = 0;
function Je(e, t, n, r) {
  var i = Pe;
  var o = Object.create(i);
  o.parent = i;
  o.ref = 0;
  o.global = false;
  o.id = ++Ze;
  var s = Oe.env;
  o.env = ge ? {
    Promise: Le,
    PromiseProp: {
      value: Le,
      configurable: true,
      writable: true
    },
    all: Le.all,
    race: Le.race,
    resolve: Le.resolve,
    reject: Le.reject,
    nthen: st(s.nthen, o),
    gthen: st(s.gthen, o)
  } : {};
  if (t) {
    a(o, t);
  }
  ++i.ref;
  o.finalize = function () {
    if (! --this.parent.ref) {
      this.parent.finalize();
    }
  };
  var l = ot(o, e, n, r);
  if (o.ref === 0) {
    o.finalize();
  }
  return l;
}
function Qe() {
  Ge.id ||= ++Ke;
  ++Ge.awaits;
  Ge.echoes += ue;
  return Ge.id;
}
function et(e) {
  if (!!Ge.awaits && (!e || e === Ge.id)) {
    if (--Ge.awaits == 0) {
      Ge.id = 0;
    }
    Ge.echoes = Ge.awaits * ue;
  }
}
function tt(e) {
  if (Ge.echoes && e && e.constructor === me) {
    Qe();
    return e.then(function (e) {
      et();
      return e;
    }, function (e) {
      et();
      return ct(e);
    });
  } else {
    return e;
  }
}
function nt() {
  var e = Ye[Ye.length - 1];
  Ye.pop();
  rt(e, false);
}
function rt(e, t) {
  var n;
  var r = Pe;
  if (!(t ? !Ge.echoes || $e++ && e === Pe : !$e || --$e && e === Pe)) {
    n = t ? function (e) {
      ++Xe;
      if (!Ge.echoes || --Ge.echoes == 0) {
        Ge.echoes = Ge.id = 0;
      }
      Ye.push(Pe);
      rt(e, true);
    }.bind(null, e) : nt;
    he.call(de, n);
  }
  if (e !== Pe && (Pe = e, r === Oe && (Oe.env = it()), ge)) {
    var i = Oe.env.Promise;
    var a = e.env;
    fe.then = a.nthen;
    i.prototype.then = a.gthen;
    if (r.global || e.global) {
      Object.defineProperty(o, "Promise", a.PromiseProp);
      i.all = a.all;
      i.race = a.race;
      i.resolve = a.resolve;
      i.reject = a.reject;
    }
  }
}
function it() {
  var e = o.Promise;
  if (ge) {
    return {
      Promise: e,
      PromiseProp: Object.getOwnPropertyDescriptor(o, "Promise"),
      all: e.all,
      race: e.race,
      resolve: e.resolve,
      reject: e.reject,
      nthen: fe.then,
      gthen: e.prototype.then
    };
  } else {
    return {};
  }
}
function ot(e, t, n, r, i) {
  var o = Pe;
  try {
    rt(e, true);
    return t(n, r, i);
  } finally {
    rt(o, false);
  }
}
function at(e, t, n) {
  if (typeof e != "function") {
    return e;
  } else {
    return function () {
      var r = Pe;
      if (n) {
        Qe();
      }
      rt(t, true);
      try {
        return e.apply(this, arguments);
      } finally {
        rt(r, false);
      }
    };
  }
}
function st(e, t) {
  return function (n, r) {
    return e.call(this, at(n, t, false), at(r, t, false));
  };
}
var lt = "unhandledrejection";
function ut(e, t) {
  var n;
  try {
    n = t.onuncatched(e);
  } catch (e) {}
  if (n !== false) {
    try {
      var r;
      var i = {
        promise: t,
        reason: e
      };
      if (o.document && document.createEvent) {
        (r = document.createEvent("Event")).initEvent(lt, true, true);
        a(r, i);
      } else if (o.CustomEvent) {
        a(r = new CustomEvent(lt, {
          detail: i
        }), i);
      }
      if (r && o.dispatchEvent && (dispatchEvent(r), !o.PromiseRejectionEvent && o.onunhandledrejection)) {
        try {
          o.onunhandledrejection(r);
        } catch (e) {}
      }
      if (!r.defaultPrevented) {
        console.warn("Unhandled rejection: " + (e.stack || e));
      }
    } catch (e) {}
  }
}
var ct = Le.reject;
function dt(e) {
  var t = {};
  function n(n, r) {
    if (r) {
      for (var i = arguments.length, o = new Array(i - 1); --i;) {
        o[i - 1] = arguments[i];
      }
      t[n].subscribe.apply(null, o);
      return e;
    }
    if (typeof n == "string") {
      return t[n];
    }
  }
  n.addEventType = s;
  for (var o = 1, a = arguments.length; o < a; ++o) {
    s(arguments[o]);
  }
  return n;
  function s(e, o, a) {
    if (typeof e != "object") {
      var l;
      o ||= oe;
      a ||= J;
      var u = {
        subscribers: [],
        fire: a,
        subscribe: function (e) {
          if (u.subscribers.indexOf(e) === -1) {
            u.subscribers.push(e);
            u.fire = o(u.fire, e);
          }
        },
        unsubscribe: function (e) {
          u.subscribers = u.subscribers.filter(function (t) {
            return t !== e;
          });
          u.fire = u.subscribers.reduce(o, a);
        }
      };
      t[e] = n[e] = u;
      return u;
    }
    r(l = e).forEach(function (e) {
      var t = l[e];
      if (i(t)) {
        s(e, l[e][0], l[e][1]);
      } else {
        if (t !== "asap") {
          throw new $.InvalidArgument("Invalid event config");
        }
        var n = s(e, Q, function () {
          for (var e = arguments.length, t = new Array(e); e--;) {
            t[e] = arguments[e];
          }
          n.subscribers.forEach(function (e) {
            b(function () {
              e.apply(null, t);
            });
          });
        });
      }
    });
  }
}
var ft;
var pt = String.fromCharCode(65535);
var ht = function () {
  try {
    IDBKeyRange.only([[]]);
    return [[]];
  } catch (e) {
    return pt;
  }
}();
var mt = -Infinity;
var yt = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.";
var gt = "String expected.";
var vt = [];
var bt = typeof navigator != "undefined" && /(MSIE|Trident|Edge)/.test(navigator.userAgent);
var _t = bt;
var wt = bt;
function xt(e) {
  return !/(dexie\.js|dexie\.min\.js)/.test(e);
}
function Et(e, t) {
  var n;
  var s;
  var l;
  var d;
  var p;
  var h = Et.dependencies;
  var m = a({
    addons: Et.addons,
    autoOpen: true,
    indexedDB: h.indexedDB,
    IDBKeyRange: h.IDBKeyRange
  }, t);
  var b = m.addons;
  var k = m.autoOpen;
  var P = m.indexedDB;
  var M = m.IDBKeyRange;
  var L = this._dbSchema = {};
  var N = [];
  var j = [];
  var F = {};
  var z = null;
  var H = null;
  var V = false;
  var W = null;
  var K = false;
  var Y = "readwrite";
  var X = this;
  var Z = new Le(function (e) {
    n = e;
  });
  var te = new Le(function (e, t) {
    s = t;
  });
  var oe = true;
  var se = !!At(P);
  function le(e) {
    this._cfg = {
      version: e,
      storesSource: null,
      dbschema: {},
      tables: {},
      contentUpgrade: null
    };
    this.stores({});
  }
  function ue(e, t, n) {
    var i = X._createTransaction(Y, j, L);
    i.create(t);
    i._completion.catch(n);
    var o = i._reject.bind(i);
    Je(function () {
      Pe.trans = i;
      if (e === 0) {
        r(L).forEach(function (e) {
          ce(t, e, L[e].primKey, L[e].indexes);
        });
        Le.follow(function () {
          return X.on.populate.fire(i);
        }).catch(o);
      } else {
        (function (e, t, n) {
          var i = [];
          var o = N.filter(function (t) {
            return t._cfg.version === e;
          })[0];
          if (!o) {
            throw new $.Upgrade("Dexie specification of currently installed DB version is missing");
          }
          L = X._dbSchema = o._cfg.dbschema;
          var a = false;
          N.filter(function (t) {
            return t._cfg.version > e;
          }).forEach(function (e) {
            i.push(function () {
              var r = L;
              var i = e._cfg.dbschema;
              Re(r, n);
              Re(i, n);
              L = X._dbSchema = i;
              var o = function (e, t) {
                var n = {
                  del: [],
                  add: [],
                  change: []
                };
                for (var r in e) {
                  if (!t[r]) {
                    n.del.push(r);
                  }
                }
                for (r in t) {
                  var i = e[r];
                  var o = t[r];
                  if (i) {
                    var a = {
                      name: r,
                      def: o,
                      recreate: false,
                      del: [],
                      add: [],
                      change: []
                    };
                    if (i.primKey.src !== o.primKey.src) {
                      a.recreate = true;
                      n.change.push(a);
                    } else {
                      var s = i.idxByName;
                      var l = o.idxByName;
                      for (var u in s) {
                        if (!l[u]) {
                          a.del.push(u);
                        }
                      }
                      for (u in l) {
                        var c = s[u];
                        var d = l[u];
                        if (c) {
                          if (c.src !== d.src) {
                            a.change.push(d);
                          }
                        } else {
                          a.add.push(d);
                        }
                      }
                      if (a.del.length > 0 || a.add.length > 0 || a.change.length > 0) {
                        n.change.push(a);
                      }
                    }
                  } else {
                    n.add.push([r, o]);
                  }
                }
                return n;
              }(r, i);
              o.add.forEach(function (e) {
                ce(n, e[0], e[1].primKey, e[1].indexes);
              });
              o.change.forEach(function (e) {
                if (e.recreate) {
                  throw new $.Upgrade("Not yet support for changing primary key");
                }
                var t = n.objectStore(e.name);
                e.add.forEach(function (e) {
                  de(t, e);
                });
                e.change.forEach(function (e) {
                  t.deleteIndex(e.name);
                  de(t, e);
                });
                e.del.forEach(function (e) {
                  t.deleteIndex(e);
                });
              });
              if (e._cfg.contentUpgrade) {
                a = true;
                return Le.follow(function () {
                  e._cfg.contentUpgrade(t);
                });
              }
            });
            i.push(function (t) {
              if (!a || !_t) {
                (function (e, t) {
                  for (var n = 0; n < t.db.objectStoreNames.length; ++n) {
                    var r = t.db.objectStoreNames[n];
                    if (e[r] == null) {
                      t.db.deleteObjectStore(r);
                    }
                  }
                })(e._cfg.dbschema, t);
              }
            });
          });
          return function e() {
            if (i.length) {
              return Le.resolve(i.shift()(t.idbtrans)).then(e);
            } else {
              return Le.resolve();
            }
          }().then(function () {
            (function (e, t) {
              r(e).forEach(function (n) {
                if (!t.db.objectStoreNames.contains(n)) {
                  ce(t, n, e[n].primKey, e[n].indexes);
                }
              });
            })(L, n);
          });
        })(e, i, t).catch(o);
      }
    });
  }
  function ce(e, t, n, r) {
    var i = e.db.createObjectStore(t, n.keyPath ? {
      keyPath: n.keyPath,
      autoIncrement: n.auto
    } : {
      autoIncrement: n.auto
    });
    r.forEach(function (e) {
      de(i, e);
    });
    return i;
  }
  function de(e, t) {
    e.createIndex(t.name, t.keyPath, {
      unique: t.unique,
      multiEntry: t.multi
    });
  }
  function fe(e, t, n) {
    this.name = e;
    this.schema = t;
    this._tx = n;
    this.hook = F[e] ? F[e].hook : dt(null, {
      creating: [ne, J],
      reading: [ee, Q],
      updating: [ie, J],
      deleting: [re, J]
    });
  }
  function pe(e, t, n) {
    return (n ? Pt : kt)(function (n) {
      e.push(n);
      if (t) {
        t();
      }
    });
  }
  function he(e, t, n, r, i) {
    return new Le(function (o, a) {
      var s = n.length;
      var l = s - 1;
      if (s === 0) {
        return o();
      }
      if (r) {
        var u;
        var c = Pt(a);
        var d = Tt(null);
        x(function () {
          for (var r = 0; r < s; ++r) {
            u = {
              onsuccess: null,
              onerror: null
            };
            var a = n[r];
            i.call(u, a[0], a[1], t);
            var f = e.delete(a[0]);
            f._hookCtx = u;
            f.onerror = c;
            f.onsuccess = r === l ? Tt(o) : d;
          }
        }, function (e) {
          if (u.onerror) {
            u.onerror(e);
          }
          throw e;
        });
      } else {
        for (var f = 0; f < s; ++f) {
          var p = e.delete(n[f]);
          p.onerror = kt(a);
          if (f === l) {
            p.onsuccess = qe(function () {
              return o();
            });
          }
        }
      }
    });
  }
  function ge(e, t, n, r) {
    var i = this;
    this.db = X;
    this.mode = e;
    this.storeNames = t;
    this.idbtrans = null;
    this.on = dt(this, "complete", "error", "abort");
    this.parent = r || null;
    this.active = true;
    this._reculock = 0;
    this._blockedFuncs = [];
    this._resolve = null;
    this._reject = null;
    this._waitingFor = null;
    this._waitingQueue = null;
    this._spinCount = 0;
    this._completion = new Le(function (e, t) {
      i._resolve = e;
      i._reject = t;
    });
    this._completion.then(function () {
      i.active = false;
      i.on.complete.fire();
    }, function (e) {
      var t = i.active;
      i.active = false;
      i.on.error.fire(e);
      if (i.parent) {
        i.parent._reject(e);
      } else if (t && i.idbtrans) {
        i.idbtrans.abort();
      }
      return ct(e);
    });
  }
  function ve(e, t, n) {
    this._ctx = {
      table: e,
      index: t === ":id" ? null : t,
      or: n
    };
  }
  function be(e, t) {
    var n = null;
    var r = null;
    if (t) {
      try {
        n = t();
      } catch (e) {
        r = e;
      }
    }
    var i = e._ctx;
    var o = i.table;
    this._ctx = {
      table: o,
      index: i.index,
      isPrimKey: !i.index || o.schema.primKey.keyPath && i.index === o.schema.primKey.name,
      range: n,
      keysOnly: false,
      dir: "next",
      unique: "",
      algorithm: null,
      filter: null,
      replayFilter: null,
      justLimit: true,
      isMatch: null,
      offset: 0,
      limit: Infinity,
      error: r,
      or: i.or,
      valueMapper: o.hook.reading.fire
    };
  }
  function _e(e, t) {
    return !e.filter && !e.algorithm && !e.or && (t ? e.justLimit : !e.replayFilter);
  }
  function we(e, t) {
    return e._cfg.version - t._cfg.version;
  }
  function xe(e, t, n) {
    t.forEach(function (t) {
      var r = n[t];
      e.forEach(function (e) {
        if (!(t in e)) {
          if (e === ge.prototype || e instanceof ge) {
            f(e, t, {
              get: function () {
                return this.table(t);
              }
            });
          } else {
            e[t] = new fe(t, r);
          }
        }
      });
    });
  }
  function Ee(e, t, n, r, i, o) {
    var a = qe(o ? function (e, t, r) {
      return n(o(e), t, r);
    } : n, i);
    e.onerror ||= kt(i);
    e.onsuccess = w(t ? function () {
      var n = e.result;
      if (n) {
        function o() {
          n.continue();
        }
        if (t(n, function (e) {
          o = e;
        }, r, i)) {
          a(n.value, n, function (e) {
            o = e;
          });
        }
        o();
      } else {
        r();
      }
    } : function () {
      var t = e.result;
      if (t) {
        function n() {
          t.continue();
        }
        a(t.value, t, function (e) {
          n = e;
        });
        n();
      } else {
        r();
      }
    }, i);
  }
  function Se(e, t) {
    return P.cmp(e, t);
  }
  function Te(e, t) {
    if (Se(e, t) > 0) {
      return e;
    } else {
      return t;
    }
  }
  function ke(e, t) {
    return P.cmp(e, t);
  }
  function Oe(e, t) {
    return P.cmp(t, e);
  }
  function Ce(e, t) {
    if (e < t) {
      return -1;
    } else if (e === t) {
      return 0;
    } else {
      return 1;
    }
  }
  function Ie(e, t) {
    if (e > t) {
      return -1;
    } else if (e === t) {
      return 0;
    } else {
      return 1;
    }
  }
  function Me(e, t) {
    if (e) {
      if (t) {
        return function () {
          return e.apply(this, arguments) && t.apply(this, arguments);
        };
      } else {
        return e;
      }
    } else {
      return t;
    }
  }
  function Re(e, t) {
    for (var n = t.db.objectStoreNames, r = 0; r < n.length; ++r) {
      var i = n[r];
      var a = t.objectStore(i);
      l = "getAll" in a;
      for (var s = 0; s < a.indexNames.length; ++s) {
        var u = a.indexNames[s];
        var c = a.index(u).keyPath;
        var d = typeof c == "string" ? c : "[" + y(c).join("+") + "]";
        if (e[i]) {
          var f = e[i].idxByName[d];
          if (f) {
            f.name = u;
          }
        }
      }
    }
    if (/Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && o.WorkerGlobalScope && o instanceof o.WorkerGlobalScope && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604) {
      l = false;
    }
  }
  function Ae(e) {
    X.on("blocked").fire(e);
    vt.filter(function (e) {
      return e.name === X.name && e !== X && !e._vcFired;
    }).map(function (t) {
      return t.on("versionchange").fire(e);
    });
  }
  this.version = function (e) {
    if (z || V) {
      throw new $.Schema("Cannot add version when database is open");
    }
    this.verno = Math.max(this.verno, e);
    var t = N.filter(function (t) {
      return t._cfg.version === e;
    })[0];
    return t || (t = new le(e), N.push(t), N.sort(we), oe = false, t);
  };
  a(le.prototype, {
    stores: function (e) {
      this._cfg.storesSource = this._cfg.storesSource ? a(this._cfg.storesSource, e) : e;
      var t = {};
      N.forEach(function (e) {
        a(t, e._cfg.storesSource);
      });
      var n = this._cfg.dbschema = {};
      this._parseStoresSpec(t, n);
      L = X._dbSchema = n;
      [F, X, ge.prototype].forEach(function (e) {
        for (var t in e) {
          if (e[t] instanceof fe) {
            delete e[t];
          }
        }
      });
      xe([F, X, ge.prototype, this._cfg.tables], r(n), n);
      j = r(n);
      return this;
    },
    upgrade: function (e) {
      this._cfg.contentUpgrade = e;
      return this;
    },
    _parseStoresSpec: function (e, t) {
      r(e).forEach(function (n) {
        if (e[n] !== null) {
          var r = {};
          var o = function (e) {
            var t = [];
            e.split(",").forEach(function (e) {
              var n = (e = e.trim()).replace(/([&*]|\+\+)/g, "");
              var r = /^\[/.test(n) ? n.match(/^\[(.*)\]$/)[1].split("+") : n;
              t.push(new Mt(n, r || null, /\&/.test(e), /\*/.test(e), /\+\+/.test(e), i(r), /\./.test(e)));
            });
            return t;
          }(e[n]);
          var a = o.shift();
          if (a.multi) {
            throw new $.Schema("Primary key cannot be multi-valued");
          }
          if (a.keyPath) {
            S(r, a.keyPath, a.auto ? 0 : a.keyPath);
          }
          o.forEach(function (e) {
            if (e.auto) {
              throw new $.Schema("Only primary key can be marked as autoIncrement (++)");
            }
            if (!e.keyPath) {
              throw new $.Schema("Index must have a name and cannot be an empty string");
            }
            S(r, e.keyPath, e.compound ? e.keyPath.map(function () {
              return "";
            }) : "");
          });
          t[n] = new Lt(n, a, o, r);
        }
      });
    }
  });
  this._allTables = F;
  this._createTransaction = function (e, t, n, r) {
    return new ge(e, t, n, r);
  };
  this._whenReady = function (e) {
    if (K || Pe.letThrough) {
      return e();
    } else {
      return new Le(function (e, t) {
        if (!V) {
          if (!k) {
            t(new $.DatabaseClosed());
            return;
          }
          X.open().catch(J);
        }
        Z.then(e, t);
      }).then(e);
    }
  };
  this.verno = 0;
  this.open = function () {
    if (V || z) {
      return Z.then(function () {
        if (H) {
          return ct(H);
        } else {
          return X;
        }
      });
    }
    if (D) {
      te._stackHolder = B();
    }
    V = true;
    H = null;
    K = false;
    var t = n;
    var i = null;
    return Le.race([te, new Le(function (t, n) {
      if (!P) {
        throw new $.MissingAPI("indexedDB API not found. If using IE10+, make sure to run your code on a server URL (not locally). If using old Safari versions, make sure to include indexedDB polyfill.");
      }
      var o = oe ? P.open(e) : P.open(e, Math.round(X.verno * 10));
      if (!o) {
        throw new $.MissingAPI("IndexedDB API not available");
      }
      o.onerror = kt(n);
      o.onblocked = qe(Ae);
      o.onupgradeneeded = qe(function (t) {
        i = o.transaction;
        if (oe && !X._allowEmptyDB) {
          o.onerror = Ct;
          i.abort();
          o.result.close();
          var r = P.deleteDatabase(e);
          r.onsuccess = r.onerror = qe(function () {
            n(new $.NoSuchDatabase("Database " + e + " doesnt exist"));
          });
        } else {
          i.onerror = kt(n);
          ue((t.oldVersion > Math.pow(2, 62) ? 0 : t.oldVersion) / 10, i, n);
        }
      }, n);
      o.onsuccess = qe(function () {
        i = null;
        z = o.result;
        vt.push(X);
        if (oe) {
          (function () {
            X.verno = z.version / 10;
            X._dbSchema = L = {};
            if ((j = y(z.objectStoreNames, 0)).length === 0) {
              return;
            }
            var e = z.transaction(Rt(j), "readonly");
            j.forEach(function (t) {
              for (var n = e.objectStore(t), r = n.keyPath, i = r && typeof r == "string" && r.indexOf(".") !== -1, o = new Mt(r, r || "", false, false, !!n.autoIncrement, r && typeof r != "string", i), a = [], s = 0; s < n.indexNames.length; ++s) {
                var l = n.index(n.indexNames[s]);
                r = l.keyPath;
                i = r && typeof r == "string" && r.indexOf(".") !== -1;
                var u = new Mt(l.name, r, !!l.unique, !!l.multiEntry, false, r && typeof r != "string", i);
                a.push(u);
              }
              L[t] = new Lt(t, o, a, {});
            });
            xe([F], r(L), L);
          })();
        } else if (z.objectStoreNames.length > 0) {
          try {
            Re(L, z.transaction(Rt(z.objectStoreNames), "readonly"));
          } catch (e) {}
        }
        z.onversionchange = qe(function (e) {
          X._vcFired = true;
          X.on("versionchange").fire(e);
        });
        if (!se && e !== "__dbnames") {
          ft.dbnames.put({
            name: e
          }).catch(J);
        }
        t();
      }, n);
    })]).then(function () {
      W = [];
      return Le.resolve(Et.vip(X.on.ready.fire)).then(function e() {
        if (W.length > 0) {
          var t = W.reduce(ae, J);
          W = [];
          return Le.resolve(Et.vip(t)).then(e);
        }
      });
    }).finally(function () {
      W = null;
    }).then(function () {
      V = false;
      return X;
    }).catch(function (e) {
      try {
        if (i) {
          i.abort();
        }
      } catch (e) {}
      V = false;
      X.close();
      return ct(H = e);
    }).finally(function () {
      K = true;
      t();
    });
  };
  this.close = function () {
    var e = vt.indexOf(X);
    if (e >= 0) {
      vt.splice(e, 1);
    }
    if (z) {
      try {
        z.close();
      } catch (e) {}
      z = null;
    }
    k = false;
    H = new $.DatabaseClosed();
    if (V) {
      s(H);
    }
    Z = new Le(function (e) {
      n = e;
    });
    te = new Le(function (e, t) {
      s = t;
    });
  };
  this.delete = function () {
    var t = arguments.length > 0;
    return new Le(function (n, r) {
      if (t) {
        throw new $.InvalidArgument("Arguments not allowed in db.delete()");
      }
      function i() {
        X.close();
        var t = P.deleteDatabase(e);
        t.onsuccess = qe(function () {
          if (!se) {
            ft.dbnames.delete(e).catch(J);
          }
          n();
        });
        t.onerror = kt(r);
        t.onblocked = Ae;
      }
      if (V) {
        Z.then(i);
      } else {
        i();
      }
    });
  };
  this.backendDB = function () {
    return z;
  };
  this.isOpen = function () {
    return z !== null;
  };
  this.hasBeenClosed = function () {
    return H && H instanceof $.DatabaseClosed;
  };
  this.hasFailed = function () {
    return H !== null;
  };
  this.dynamicallyOpened = function () {
    return oe;
  };
  this.name = e;
  c(this, {
    tables: {
      get: function () {
        return r(F).map(function (e) {
          return F[e];
        });
      }
    }
  });
  this.on = dt(this, "populate", "blocked", "versionchange", {
    ready: [ae, J]
  });
  this.on.ready.subscribe = g(this.on.ready.subscribe, function (e) {
    return function (t, n) {
      Et.vip(function () {
        if (K) {
          if (!H) {
            Le.resolve().then(t);
          }
          if (n) {
            e(t);
          }
        } else if (W) {
          W.push(t);
          if (n) {
            e(t);
          }
        } else {
          e(t);
          if (!n) {
            e(function e() {
              X.on.ready.unsubscribe(t);
              X.on.ready.unsubscribe(e);
            });
          }
        }
      });
    };
  });
  this.transaction = function () {
    var e = function (e, t, n) {
      var r = arguments.length;
      if (r < 2) {
        throw new $.InvalidArgument("Too few arguments");
      }
      var i = new Array(r - 1);
      while (--r) {
        i[r - 1] = arguments[r];
      }
      n = i.pop();
      var o = O(i);
      return [e, o, n];
    }.apply(this, arguments);
    return this._transaction.apply(this, e);
  };
  this._transaction = function (e, t, n) {
    var r = Pe.trans;
    if (!r || r.db !== X || e.indexOf("!") !== -1) {
      r = null;
    }
    var i = e.indexOf("?") !== -1;
    e = e.replace("!", "").replace("?", "");
    try {
      var o = t.map(function (e) {
        var t = e instanceof fe ? e.name : e;
        if (typeof t != "string") {
          throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
        }
        return t;
      });
      if (e == "r" || e == "readonly") {
        e = "readonly";
      } else {
        if (e != "rw" && e != Y) {
          throw new $.InvalidArgument("Invalid transaction mode: " + e);
        }
        e = Y;
      }
      if (r) {
        if (r.mode === "readonly" && e === Y) {
          if (!i) {
            throw new $.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
          }
          r = null;
        }
        if (r) {
          o.forEach(function (e) {
            if (r && r.storeNames.indexOf(e) === -1) {
              if (!i) {
                throw new $.SubTransaction("Table " + e + " not included in parent transaction.");
              }
              r = null;
            }
          });
        }
        if (i && r && !r.active) {
          r = null;
        }
      }
    } catch (e) {
      if (r) {
        return r._promise(null, function (t, n) {
          n(e);
        });
      } else {
        return ct(e);
      }
    }
    if (r) {
      return r._promise(e, a, "lock");
    } else if (Pe.trans) {
      return ot(Pe.transless, function () {
        return X._whenReady(a);
      });
    } else {
      return X._whenReady(a);
    }
    function a() {
      return Le.resolve().then(function () {
        var t;
        var i = Pe.transless || Pe;
        var a = X._createTransaction(e, o, L, r);
        var s = {
          trans: a,
          transless: i
        };
        if (r) {
          a.idbtrans = r.idbtrans;
        } else {
          a.create();
        }
        if (n.constructor === ye) {
          Qe();
        }
        var l = Le.follow(function () {
          if (t = n.call(a, a)) {
            if (t.constructor === me) {
              var e = et.bind(null, null);
              t.then(e, e);
            } else if (typeof t.next == "function" && typeof t.throw == "function") {
              t = It(t);
            }
          }
        }, s);
        return (t && typeof t.then == "function" ? Le.resolve(t).then(function (e) {
          if (a.active) {
            return e;
          } else {
            return ct(new $.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn"));
          }
        }) : l.then(function () {
          return t;
        })).then(function (e) {
          if (r) {
            a._resolve();
          }
          return a._completion.then(function () {
            return e;
          });
        }).catch(function (e) {
          a._reject(e);
          return ct(e);
        });
      });
    }
  };
  this.table = function (e) {
    if (!u(F, e)) {
      throw new $.InvalidTable("Table " + e + " does not exist");
    }
    return F[e];
  };
  c(fe.prototype, {
    _trans: function (e, t, n) {
      var r = this._tx || Pe.trans;
      if (r && r.db === X) {
        if (r === Pe.trans) {
          return r._promise(e, t, n);
        } else {
          return Je(function () {
            return r._promise(e, t, n);
          }, {
            trans: r,
            transless: Pe.transless || Pe
          });
        }
      } else {
        return function e(t, n, r) {
          if (K || Pe.letThrough) {
            var i = X._createTransaction(t, n, L);
            try {
              i.create();
            } catch (e) {
              return ct(e);
            }
            return i._promise(t, function (e, t) {
              return Je(function () {
                Pe.trans = i;
                return r(e, t, i);
              });
            }).then(function (e) {
              return i._completion.then(function () {
                return e;
              });
            });
          }
          if (!V) {
            if (!k) {
              return ct(new $.DatabaseClosed());
            }
            X.open().catch(J);
          }
          return Z.then(function () {
            return e(t, n, r);
          });
        }(e, [this.name], t);
      }
    },
    _idbstore: function (e, t, n) {
      var r = this.name;
      return this._trans(e, function (e, n, i) {
        if (i.storeNames.indexOf(r) === -1) {
          throw new $.NotFound("Table" + r + " not part of transaction");
        }
        return t(e, n, i.idbtrans.objectStore(r), i);
      }, n);
    },
    get: function (e, t) {
      if (e && e.constructor === Object) {
        return this.where(e).first(t);
      }
      var n = this;
      return this._idbstore("readonly", function (t, r, i) {
        var o = i.get(e);
        o.onerror = kt(r);
        o.onsuccess = qe(function () {
          t(n.hook.reading.fire(o.result));
        }, r);
      }).then(t);
    },
    where: function (e) {
      if (typeof e == "string") {
        return new ve(this, e);
      }
      if (i(e)) {
        return new ve(this, "[" + e.join("+") + "]");
      }
      var t = r(e);
      if (t.length === 1) {
        return this.where(t[0]).equals(e[t[0]]);
      }
      var n = this.schema.indexes.concat(this.schema.primKey).filter(function (e) {
        return e.compound && t.every(function (t) {
          return e.keyPath.indexOf(t) >= 0;
        }) && e.keyPath.every(function (e) {
          return t.indexOf(e) >= 0;
        });
      })[0];
      if (n && ht !== pt) {
        return this.where(n.name).equals(n.keyPath.map(function (t) {
          return e[t];
        }));
      }
      if (!n) {
        console.warn("The query " + JSON.stringify(e) + " on " + this.name + " would benefit of a compound index [" + t.join("+") + "]");
      }
      var o = this.schema.idxByName;
      var a = t.reduce(function (t, n) {
        return [t[0] || o[n], t[0] || !o[n] ? Me(t[1], function (t) {
          return "" + E(t, n) == "" + e[n];
        }) : t[1]];
      }, [null, null]);
      var s = a[0];
      if (s) {
        return this.where(s.name).equals(e[s.keyPath]).filter(a[1]);
      } else if (n) {
        return this.filter(a[1]);
      } else {
        return this.where(t).equals("");
      }
    },
    count: function (e) {
      return this.toCollection().count(e);
    },
    offset: function (e) {
      return this.toCollection().offset(e);
    },
    limit: function (e) {
      return this.toCollection().limit(e);
    },
    reverse: function () {
      return this.toCollection().reverse();
    },
    filter: function (e) {
      return this.toCollection().and(e);
    },
    each: function (e) {
      return this.toCollection().each(e);
    },
    toArray: function (e) {
      return this.toCollection().toArray(e);
    },
    orderBy: function (e) {
      return new be(new ve(this, i(e) ? "[" + e.join("+") + "]" : e));
    },
    toCollection: function () {
      return new be(new ve(this));
    },
    mapToClass: function (e, t) {
      this.schema.mappedClass = e;
      var n = Object.create(e.prototype);
      if (t) {
        St(n, t);
      }
      this.schema.instanceTemplate = n;
      function r(t) {
        if (!t) {
          return t;
        }
        var n = Object.create(e.prototype);
        for (var r in t) {
          if (u(t, r)) {
            try {
              n[r] = t[r];
            } catch (e) {}
          }
        }
        return n;
      }
      if (this.schema.readHook) {
        this.hook.reading.unsubscribe(this.schema.readHook);
      }
      this.schema.readHook = r;
      this.hook("reading", r);
      return e;
    },
    defineClass: function (e) {
      return this.mapToClass(Et.defineClass(e), e);
    },
    bulkDelete: function (e) {
      if (this.hook.deleting.fire === J) {
        return this._idbstore(Y, function (t, n, r, i) {
          t(he(r, i, e, false, J));
        });
      } else {
        return this.where(":id").anyOf(e).delete().then(function () {});
      }
    },
    bulkPut: function (e, t) {
      var n = this;
      return this._idbstore(Y, function (r, i, o) {
        if (!o.keyPath && !n.schema.primKey.auto && !t) {
          throw new $.InvalidArgument("bulkPut() with non-inbound keys requires keys array in second argument");
        }
        if (o.keyPath && t) {
          throw new $.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
        }
        if (t && t.length !== e.length) {
          throw new $.InvalidArgument("Arguments objects and keys must have the same length");
        }
        if (e.length === 0) {
          return r();
        }
        var a;
        var s;
        function l(e) {
          if (u.length === 0) {
            r(e);
          } else {
            i(new G(n.name + ".bulkPut(): " + u.length + " of " + c + " operations failed", u));
          }
        }
        var u = [];
        var c = e.length;
        var d = n;
        if (n.hook.creating.fire === J && n.hook.updating.fire === J) {
          s = pe(u);
          for (var f = 0, p = e.length; f < p; ++f) {
            (a = t ? o.put(e[f], t[f]) : o.put(e[f])).onerror = s;
          }
          a.onerror = pe(u, l);
          a.onsuccess = Ot(l);
        } else {
          var h = t || o.keyPath && e.map(function (e) {
            return E(e, o.keyPath);
          });
          var m = h && _(h, function (t, n) {
            return t != null && [t, e[n]];
          });
          (h ? d.where(":id").anyOf(h.filter(function (e) {
            return e != null;
          })).modify(function () {
            this.value = m[this.primKey];
            m[this.primKey] = null;
          }).catch(q, function (e) {
            u = e.failures;
          }).then(function () {
            var n = [];
            var r = t && [];
            for (var i = h.length - 1; i >= 0; --i) {
              var o = h[i];
              if (o == null || m[o]) {
                n.push(e[i]);
                if (t) {
                  r.push(o);
                }
                if (o != null) {
                  m[o] = null;
                }
              }
            }
            n.reverse();
            if (t) {
              r.reverse();
            }
            return d.bulkAdd(n, r);
          }).then(function (e) {
            var t = h[h.length - 1];
            return t ?? e;
          }) : d.bulkAdd(e)).then(l).catch(G, function (e) {
            u = u.concat(e.failures);
            l();
          }).catch(i);
        }
      }, "locked");
    },
    bulkAdd: function (e, t) {
      var n = this;
      var r = this.hook.creating.fire;
      return this._idbstore(Y, function (i, o, a, s) {
        if (!a.keyPath && !n.schema.primKey.auto && !t) {
          throw new $.InvalidArgument("bulkAdd() with non-inbound keys requires keys array in second argument");
        }
        if (a.keyPath && t) {
          throw new $.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
        }
        if (t && t.length !== e.length) {
          throw new $.InvalidArgument("Arguments objects and keys must have the same length");
        }
        if (e.length === 0) {
          return i();
        }
        function l(e) {
          if (f.length === 0) {
            i(e);
          } else {
            o(new G(n.name + ".bulkAdd(): " + f.length + " of " + p + " operations failed", f));
          }
        }
        var u;
        var c;
        var d;
        var f = [];
        var p = e.length;
        if (r !== J) {
          var h;
          var m = a.keyPath;
          c = pe(f, null, true);
          d = Tt(null);
          x(function () {
            for (var n = 0, i = e.length; n < i; ++n) {
              h = {
                onerror: null,
                onsuccess: null
              };
              var o = t && t[n];
              var l = e[n];
              var f = t ? o : m ? E(l, m) : undefined;
              var p = r.call(h, f, l, s);
              if (f == null && p != null) {
                if (m) {
                  S(l = C(l), m, p);
                } else {
                  o = p;
                }
              }
              (u = o != null ? a.add(l, o) : a.add(l))._hookCtx = h;
              if (n < i - 1) {
                u.onerror = c;
                if (h.onsuccess) {
                  u.onsuccess = d;
                }
              }
            }
          }, function (e) {
            if (h.onerror) {
              h.onerror(e);
            }
            throw e;
          });
          u.onerror = pe(f, l, true);
          u.onsuccess = Tt(l);
        } else {
          c = pe(f);
          for (var y = 0, g = e.length; y < g; ++y) {
            (u = t ? a.add(e[y], t[y]) : a.add(e[y])).onerror = c;
          }
          u.onerror = pe(f, l);
          u.onsuccess = Ot(l);
        }
      });
    },
    add: function (e, t) {
      var n = this.hook.creating.fire;
      return this._idbstore(Y, function (r, i, o, a) {
        var s = {
          onsuccess: null,
          onerror: null
        };
        if (n !== J) {
          var l = t ?? (o.keyPath ? E(e, o.keyPath) : undefined);
          var u = n.call(s, l, e, a);
          if (l == null && u != null) {
            if (o.keyPath) {
              S(e, o.keyPath, u);
            } else {
              t = u;
            }
          }
        }
        try {
          var c = t != null ? o.add(e, t) : o.add(e);
          c._hookCtx = s;
          c.onerror = Pt(i);
          c.onsuccess = Tt(function (t) {
            var n = o.keyPath;
            if (n) {
              S(e, n, t);
            }
            r(t);
          });
        } catch (e) {
          if (s.onerror) {
            s.onerror(e);
          }
          throw e;
        }
      });
    },
    put: function (e, t) {
      var n = this;
      var r = this.hook.creating.fire;
      var i = this.hook.updating.fire;
      if (r !== J || i !== J) {
        var o = this.schema.primKey.keyPath;
        var a = t !== undefined ? t : o && E(e, o);
        if (a == null) {
          return this.add(e);
        } else {
          e = C(e);
          return this._trans(Y, function () {
            return n.where(":id").equals(a).modify(function () {
              this.value = e;
            }).then(function (r) {
              if (r === 0) {
                return n.add(e, t);
              } else {
                return a;
              }
            });
          }, "locked");
        }
      }
      return this._idbstore(Y, function (n, r, i) {
        var o = t !== undefined ? i.put(e, t) : i.put(e);
        o.onerror = kt(r);
        o.onsuccess = qe(function (t) {
          var r = i.keyPath;
          if (r) {
            S(e, r, t.target.result);
          }
          n(o.result);
        });
      });
    },
    delete: function (e) {
      if (this.hook.deleting.subscribers.length) {
        return this.where(":id").equals(e).delete();
      } else {
        return this._idbstore(Y, function (t, n, r) {
          var i = r.delete(e);
          i.onerror = kt(n);
          i.onsuccess = qe(function () {
            t(i.result);
          });
        });
      }
    },
    clear: function () {
      if (this.hook.deleting.subscribers.length) {
        return this.toCollection().delete();
      } else {
        return this._idbstore(Y, function (e, t, n) {
          var r = n.clear();
          r.onerror = kt(t);
          r.onsuccess = qe(function () {
            e(r.result);
          });
        });
      }
    },
    update: function (e, t) {
      if (typeof t != "object" || i(t)) {
        throw new $.InvalidArgument("Modifications must be an object.");
      }
      if (typeof e != "object" || i(e)) {
        return this.where(":id").equals(e).modify(t);
      }
      r(t).forEach(function (n) {
        S(e, n, t[n]);
      });
      var n = E(e, this.schema.primKey.keyPath);
      if (n === undefined) {
        return ct(new $.InvalidArgument("Given object does not contain its primary key"));
      } else {
        return this.where(":id").equals(n).modify(t);
      }
    }
  });
  c(ge.prototype, {
    _lock: function () {
      v(!Pe.global);
      ++this._reculock;
      if (this._reculock === 1 && !Pe.global) {
        Pe.lockOwnerFor = this;
      }
      return this;
    },
    _unlock: function () {
      v(!Pe.global);
      if (--this._reculock == 0) {
        for (Pe.global || (Pe.lockOwnerFor = null); this._blockedFuncs.length > 0 && !this._locked();) {
          var e = this._blockedFuncs.shift();
          try {
            ot(e[1], e[0]);
          } catch (e) {}
        }
      }
      return this;
    },
    _locked: function () {
      return this._reculock && Pe.lockOwnerFor !== this;
    },
    create: function (e) {
      var t = this;
      if (!this.mode) {
        return this;
      }
      v(!this.idbtrans);
      if (!e && !z) {
        switch (H && H.name) {
          case "DatabaseClosedError":
            throw new $.DatabaseClosed(H);
          case "MissingAPIError":
            throw new $.MissingAPI(H.message, H);
          default:
            throw new $.OpenFailed(H);
        }
      }
      if (!this.active) {
        throw new $.TransactionInactive();
      }
      v(this._completion._state === null);
      (e = this.idbtrans = e || z.transaction(Rt(this.storeNames), this.mode)).onerror = qe(function (n) {
        Ct(n);
        t._reject(e.error);
      });
      e.onabort = qe(function (n) {
        Ct(n);
        if (t.active) {
          t._reject(new $.Abort(e.error));
        }
        t.active = false;
        t.on("abort").fire(n);
      });
      e.oncomplete = qe(function () {
        t.active = false;
        t._resolve();
      });
      return this;
    },
    _promise: function (e, t, n) {
      var r = this;
      if (e === Y && this.mode !== Y) {
        return ct(new $.ReadOnly("Transaction is readonly"));
      }
      if (!this.active) {
        return ct(new $.TransactionInactive());
      }
      if (this._locked()) {
        return new Le(function (i, o) {
          r._blockedFuncs.push([function () {
            r._promise(e, t, n).then(i, o);
          }, Pe]);
        });
      }
      if (n) {
        return Je(function () {
          var e = new Le(function (e, n) {
            r._lock();
            var i = t(e, n, r);
            if (i && i.then) {
              i.then(e, n);
            }
          });
          e.finally(function () {
            return r._unlock();
          });
          e._lib = true;
          return e;
        });
      }
      var i = new Le(function (e, n) {
        var i = t(e, n, r);
        if (i && i.then) {
          i.then(e, n);
        }
      });
      i._lib = true;
      return i;
    },
    _root: function () {
      if (this.parent) {
        return this.parent._root();
      } else {
        return this;
      }
    },
    waitFor: function (e) {
      var t = this._root();
      e = Le.resolve(e);
      if (t._waitingFor) {
        t._waitingFor = t._waitingFor.then(function () {
          return e;
        });
      } else {
        t._waitingFor = e;
        t._waitingQueue = [];
        var n = t.idbtrans.objectStore(t.storeNames[0]);
        (function e() {
          for (++t._spinCount; t._waitingQueue.length;) {
            t._waitingQueue.shift()();
          }
          if (t._waitingFor) {
            n.get(-Infinity).onsuccess = e;
          }
        })();
      }
      var r = t._waitingFor;
      return new Le(function (n, i) {
        e.then(function (e) {
          return t._waitingQueue.push(qe(n.bind(null, e)));
        }, function (e) {
          return t._waitingQueue.push(qe(i.bind(null, e)));
        }).finally(function () {
          if (t._waitingFor === r) {
            t._waitingFor = null;
          }
        });
      });
    },
    abort: function () {
      if (this.active) {
        this._reject(new $.Abort());
      }
      this.active = false;
    },
    tables: {
      get: (d = "Transaction.tables", p = function () {
        return F;
      }, function () {
        console.warn(d + " is deprecated. See https://github.com/dfahlander/Dexie.js/wiki/Deprecations. " + U(B(), 1));
        return p.apply(this, arguments);
      })
    },
    table: function (e) {
      return new fe(e, X.table(e).schema, this);
    }
  });
  c(ve.prototype, function () {
    function e(e, t, n) {
      var r = e instanceof ve ? new be(e) : e;
      r._ctx.error = n ? new n(t) : new TypeError(t);
      return r;
    }
    function t(e) {
      return new be(e, function () {
        return M.only("");
      }).limit(0);
    }
    function n(e, t, n, r, i, o) {
      for (var a = Math.min(e.length, r.length), s = -1, l = 0; l < a; ++l) {
        var u = t[l];
        if (u !== r[l]) {
          if (i(e[l], n[l]) < 0) {
            return e.substr(0, l) + n[l] + n.substr(l + 1);
          } else if (i(e[l], r[l]) < 0) {
            return e.substr(0, l) + r[l] + n.substr(l + 1);
          } else if (s >= 0) {
            return e.substr(0, s) + t[s] + n.substr(s + 1);
          } else {
            return null;
          }
        }
        if (i(e[l], u) < 0) {
          s = l;
        }
      }
      if (a < r.length && o === "next") {
        return e + n.substr(e.length);
      } else if (a < e.length && o === "prev") {
        return e.substr(0, n.length);
      } else if (s < 0) {
        return null;
      } else {
        return e.substr(0, s) + r[s] + n.substr(s + 1);
      }
    }
    function r(t, r, i, o) {
      var a;
      var s;
      var l;
      var u;
      var c;
      var d;
      var f;
      var p = i.length;
      if (!i.every(function (e) {
        return typeof e == "string";
      })) {
        return e(t, gt);
      }
      function h(e) {
        a = function (e) {
          if (e === "next") {
            return function (e) {
              return e.toUpperCase();
            };
          } else {
            return function (e) {
              return e.toLowerCase();
            };
          }
        }(e);
        s = function (e) {
          if (e === "next") {
            return function (e) {
              return e.toLowerCase();
            };
          } else {
            return function (e) {
              return e.toUpperCase();
            };
          }
        }(e);
        l = e === "next" ? Ce : Ie;
        var t = i.map(function (e) {
          return {
            lower: s(e),
            upper: a(e)
          };
        }).sort(function (e, t) {
          return l(e.lower, t.lower);
        });
        u = t.map(function (e) {
          return e.upper;
        });
        c = t.map(function (e) {
          return e.lower;
        });
        d = e;
        f = e === "next" ? "" : o;
      }
      h("next");
      var m = new be(t, function () {
        return M.bound(u[0], c[p - 1] + o);
      });
      m._ondirectionchange = function (e) {
        h(e);
      };
      var y = 0;
      m._addAlgorithm(function (e, t, i) {
        var o = e.key;
        if (typeof o != "string") {
          return false;
        }
        var a = s(o);
        if (r(a, c, y)) {
          return true;
        }
        var h = null;
        for (var m = y; m < p; ++m) {
          var g = n(o, a, u[m], c[m], l, d);
          if (g === null && h === null) {
            y = m + 1;
          } else if (h === null || l(h, g) > 0) {
            h = g;
          }
        }
        t(h !== null ? function () {
          e.continue(h + f);
        } : i);
        return false;
      });
      return m;
    }
    return {
      between: function (n, r, i, o) {
        i = i !== false;
        o = o === true;
        try {
          if (Se(n, r) > 0 || Se(n, r) === 0 && (i || o) && (!i || !o)) {
            return t(this);
          } else {
            return new be(this, function () {
              return M.bound(n, r, !i, !o);
            });
          }
        } catch (t) {
          return e(this, yt);
        }
      },
      equals: function (e) {
        return new be(this, function () {
          return M.only(e);
        });
      },
      above: function (e) {
        return new be(this, function () {
          return M.lowerBound(e, true);
        });
      },
      aboveOrEqual: function (e) {
        return new be(this, function () {
          return M.lowerBound(e);
        });
      },
      below: function (e) {
        return new be(this, function () {
          return M.upperBound(e, true);
        });
      },
      belowOrEqual: function (e) {
        return new be(this, function () {
          return M.upperBound(e);
        });
      },
      startsWith: function (t) {
        if (typeof t != "string") {
          return e(this, gt);
        } else {
          return this.between(t, t + pt, true, true);
        }
      },
      startsWithIgnoreCase: function (e) {
        if (e === "") {
          return this.startsWith(e);
        } else {
          return r(this, function (e, t) {
            return e.indexOf(t[0]) === 0;
          }, [e], pt);
        }
      },
      equalsIgnoreCase: function (e) {
        return r(this, function (e, t) {
          return e === t[0];
        }, [e], "");
      },
      anyOfIgnoreCase: function () {
        var e = A.apply(R, arguments);
        if (e.length === 0) {
          return t(this);
        } else {
          return r(this, function (e, t) {
            return t.indexOf(e) !== -1;
          }, e, "");
        }
      },
      startsWithAnyOfIgnoreCase: function () {
        var e = A.apply(R, arguments);
        if (e.length === 0) {
          return t(this);
        } else {
          return r(this, function (e, t) {
            return t.some(function (t) {
              return e.indexOf(t) === 0;
            });
          }, e, pt);
        }
      },
      anyOf: function () {
        var n = A.apply(R, arguments);
        var r = ke;
        try {
          n.sort(r);
        } catch (t) {
          return e(this, yt);
        }
        if (n.length === 0) {
          return t(this);
        }
        var i = new be(this, function () {
          return M.bound(n[0], n[n.length - 1]);
        });
        i._ondirectionchange = function (e) {
          r = e === "next" ? ke : Oe;
          n.sort(r);
        };
        var o = 0;
        i._addAlgorithm(function (e, t, i) {
          for (var a = e.key; r(a, n[o]) > 0;) {
            if (++o === n.length) {
              t(i);
              return false;
            }
          }
          return r(a, n[o]) === 0 || (t(function () {
            e.continue(n[o]);
          }), false);
        });
        return i;
      },
      notEqual: function (e) {
        return this.inAnyRange([[mt, e], [e, ht]], {
          includeLowers: false,
          includeUppers: false
        });
      },
      noneOf: function () {
        var t = A.apply(R, arguments);
        if (t.length === 0) {
          return new be(this);
        }
        try {
          t.sort(ke);
        } catch (t) {
          return e(this, yt);
        }
        var n = t.reduce(function (e, t) {
          if (e) {
            return e.concat([[e[e.length - 1][1], t]]);
          } else {
            return [[mt, t]];
          }
        }, null);
        n.push([t[t.length - 1], ht]);
        return this.inAnyRange(n, {
          includeLowers: false,
          includeUppers: false
        });
      },
      inAnyRange: function (n, r) {
        if (n.length === 0) {
          return t(this);
        }
        if (!n.every(function (e) {
          return e[0] !== undefined && e[1] !== undefined && ke(e[0], e[1]) <= 0;
        })) {
          return e(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", $.InvalidArgument);
        }
        var i = !r || r.includeLowers !== false;
        var o = r && r.includeUppers === true;
        var a;
        var s = ke;
        function l(e, t) {
          return s(e[0], t[0]);
        }
        try {
          (a = n.reduce(function (e, t) {
            for (var n = 0, r = e.length; n < r; ++n) {
              var i = e[n];
              if (Se(t[0], i[1]) < 0 && Se(t[1], i[0]) > 0) {
                o = i[0];
                a = t[0];
                i[0] = Se(o, a) < 0 ? o : a;
                i[1] = Te(i[1], t[1]);
                break;
              }
            }
            var o;
            var a;
            if (n === r) {
              e.push(t);
            }
            return e;
          }, [])).sort(l);
        } catch (t) {
          return e(this, yt);
        }
        var u = 0;
        var c = o ? function (e) {
          return ke(e, a[u][1]) > 0;
        } : function (e) {
          return ke(e, a[u][1]) >= 0;
        };
        var d = i ? function (e) {
          return Oe(e, a[u][0]) > 0;
        } : function (e) {
          return Oe(e, a[u][0]) >= 0;
        };
        var f = c;
        var p = new be(this, function () {
          return M.bound(a[0][0], a[a.length - 1][1], !i, !o);
        });
        p._ondirectionchange = function (e) {
          if (e === "next") {
            f = c;
            s = ke;
          } else {
            f = d;
            s = Oe;
          }
          a.sort(l);
        };
        p._addAlgorithm(function (e, t, n) {
          for (var r = e.key; f(r);) {
            if (++u === a.length) {
              t(n);
              return false;
            }
          }
          return !!function (e) {
            return !c(e) && !d(e);
          }(r) || Se(r, a[u][1]) !== 0 && Se(r, a[u][0]) !== 0 && (t(function () {
            if (s === ke) {
              e.continue(a[u][0]);
            } else {
              e.continue(a[u][1]);
            }
          }), false);
        });
        return p;
      },
      startsWithAnyOf: function () {
        var n = A.apply(R, arguments);
        if (n.every(function (e) {
          return typeof e == "string";
        })) {
          if (n.length === 0) {
            return t(this);
          } else {
            return this.inAnyRange(n.map(function (e) {
              return [e, e + pt];
            }));
          }
        } else {
          return e(this, "startsWithAnyOf() only works with strings");
        }
      }
    };
  });
  c(be.prototype, function () {
    function e(e, t) {
      e.filter = Me(e.filter, t);
    }
    function t(e, t, n) {
      var r = e.replayFilter;
      e.replayFilter = r ? function () {
        return Me(r(), t());
      } : t;
      e.justLimit = n && !r;
    }
    function n(e, t) {
      if (e.isPrimKey) {
        return t;
      }
      var n = e.table.schema.idxByName[e.index];
      if (!n) {
        throw new $.Schema("KeyPath " + e.index + " on object store " + t.name + " is not indexed");
      }
      return t.index(n.name);
    }
    function i(e, t) {
      var r = n(e, t);
      if (e.keysOnly && "openKeyCursor" in r) {
        return r.openKeyCursor(e.range || null, e.dir + e.unique);
      } else {
        return r.openCursor(e.range || null, e.dir + e.unique);
      }
    }
    function o(e, t, n, r, o) {
      var a = e.replayFilter ? Me(e.filter, e.replayFilter()) : e.filter;
      if (e.or) {
        (function () {
          var s = {};
          var l = 0;
          function c() {
            if (++l == 2) {
              n();
            }
          }
          function d(e, n, i) {
            if (!a || a(n, i, c, r)) {
              var o = n.primaryKey;
              var l = "" + o;
              if (l === "[object ArrayBuffer]") {
                l = "" + new Uint8Array(o);
              }
              if (!u(s, l)) {
                s[l] = true;
                t(e, n, i);
              }
            }
          }
          e.or._iterate(d, c, r, o);
          Ee(i(e, o), e.algorithm, d, c, r, !e.keysOnly && e.valueMapper);
        })();
      } else {
        Ee(i(e, o), Me(e.algorithm, a), t, n, r, !e.keysOnly && e.valueMapper);
      }
    }
    return {
      _read: function (e, t) {
        var n = this._ctx;
        if (n.error) {
          return n.table._trans(null, ct.bind(null, n.error));
        } else {
          return n.table._idbstore("readonly", e).then(t);
        }
      },
      _write: function (e) {
        var t = this._ctx;
        if (t.error) {
          return t.table._trans(null, ct.bind(null, t.error));
        } else {
          return t.table._idbstore(Y, e, "locked");
        }
      },
      _addAlgorithm: function (e) {
        var t = this._ctx;
        t.algorithm = Me(t.algorithm, e);
      },
      _iterate: function (e, t, n, r) {
        return o(this._ctx, e, t, n, r);
      },
      clone: function (e) {
        var t = Object.create(this.constructor.prototype);
        var n = Object.create(this._ctx);
        if (e) {
          a(n, e);
        }
        t._ctx = n;
        return t;
      },
      raw: function () {
        this._ctx.valueMapper = null;
        return this;
      },
      each: function (e) {
        var t = this._ctx;
        return this._read(function (n, r, i) {
          o(t, e, n, r, i);
        });
      },
      count: function (e) {
        var t = this._ctx;
        if (_e(t, true)) {
          return this._read(function (e, r, i) {
            var o = n(t, i);
            var a = t.range ? o.count(t.range) : o.count();
            a.onerror = kt(r);
            a.onsuccess = function (n) {
              e(Math.min(n.target.result, t.limit));
            };
          }, e);
        }
        var r = 0;
        return this._read(function (e, n, i) {
          o(t, function () {
            ++r;
            return false;
          }, function () {
            e(r);
          }, n, i);
        }, e);
      },
      sortBy: function (e, t) {
        var n = e.split(".").reverse();
        var r = n[0];
        var i = n.length - 1;
        function o(e, t) {
          if (t) {
            return o(e[n[t]], t - 1);
          } else {
            return e[r];
          }
        }
        var a = this._ctx.dir === "next" ? 1 : -1;
        function s(e, t) {
          var n = o(e, i);
          var r = o(t, i);
          if (n < r) {
            return -a;
          } else if (n > r) {
            return a;
          } else {
            return 0;
          }
        }
        return this.toArray(function (e) {
          return e.sort(s);
        }).then(t);
      },
      toArray: function (e) {
        var t = this._ctx;
        return this._read(function (e, r, i) {
          if (l && t.dir === "next" && _e(t, true) && t.limit > 0) {
            var a = t.table.hook.reading.fire;
            var s = n(t, i);
            var u = t.limit < Infinity ? s.getAll(t.range, t.limit) : s.getAll(t.range);
            u.onerror = kt(r);
            u.onsuccess = Ot(a === Q ? e : function (t) {
              try {
                e(t.map(a));
              } catch (e) {
                r(e);
              }
            });
          } else {
            var c = [];
            o(t, function (e) {
              c.push(e);
            }, function () {
              e(c);
            }, r, i);
          }
        }, e);
      },
      offset: function (e) {
        var n = this._ctx;
        if (e <= 0) {
          return this;
        } else {
          n.offset += e;
          if (_e(n)) {
            t(n, function () {
              var t = e;
              return function (e, n) {
                return t === 0 || (t === 1 ? (--t, false) : (n(function () {
                  e.advance(t);
                  t = 0;
                }), false));
              };
            });
          } else {
            t(n, function () {
              var t = e;
              return function () {
                return --t < 0;
              };
            });
          }
          return this;
        }
      },
      limit: function (e) {
        this._ctx.limit = Math.min(this._ctx.limit, e);
        t(this._ctx, function () {
          var t = e;
          return function (e, n, r) {
            if (--t <= 0) {
              n(r);
            }
            return t >= 0;
          };
        }, true);
        return this;
      },
      until: function (t, n) {
        e(this._ctx, function (e, r, i) {
          return !t(e.value) || (r(i), n);
        });
        return this;
      },
      first: function (e) {
        return this.limit(1).toArray(function (e) {
          return e[0];
        }).then(e);
      },
      last: function (e) {
        return this.reverse().first(e);
      },
      filter: function (t) {
        var n;
        var r;
        e(this._ctx, function (e) {
          return t(e.value);
        });
        n = this._ctx;
        r = t;
        n.isMatch = Me(n.isMatch, r);
        return this;
      },
      and: function (e) {
        return this.filter(e);
      },
      or: function (e) {
        return new ve(this._ctx.table, e, this);
      },
      reverse: function () {
        this._ctx.dir = this._ctx.dir === "prev" ? "next" : "prev";
        if (this._ondirectionchange) {
          this._ondirectionchange(this._ctx.dir);
        }
        return this;
      },
      desc: function () {
        return this.reverse();
      },
      eachKey: function (e) {
        var t = this._ctx;
        t.keysOnly = !t.isMatch;
        return this.each(function (t, n) {
          e(n.key, n);
        });
      },
      eachUniqueKey: function (e) {
        this._ctx.unique = "unique";
        return this.eachKey(e);
      },
      eachPrimaryKey: function (e) {
        var t = this._ctx;
        t.keysOnly = !t.isMatch;
        return this.each(function (t, n) {
          e(n.primaryKey, n);
        });
      },
      keys: function (e) {
        var t = this._ctx;
        t.keysOnly = !t.isMatch;
        var n = [];
        return this.each(function (e, t) {
          n.push(t.key);
        }).then(function () {
          return n;
        }).then(e);
      },
      primaryKeys: function (e) {
        var t = this._ctx;
        if (l && t.dir === "next" && _e(t, true) && t.limit > 0) {
          return this._read(function (e, r, i) {
            var o = n(t, i);
            var a = t.limit < Infinity ? o.getAllKeys(t.range, t.limit) : o.getAllKeys(t.range);
            a.onerror = kt(r);
            a.onsuccess = Ot(e);
          }).then(e);
        }
        t.keysOnly = !t.isMatch;
        var r = [];
        return this.each(function (e, t) {
          r.push(t.primaryKey);
        }).then(function () {
          return r;
        }).then(e);
      },
      uniqueKeys: function (e) {
        this._ctx.unique = "unique";
        return this.keys(e);
      },
      firstKey: function (e) {
        return this.limit(1).keys(function (e) {
          return e[0];
        }).then(e);
      },
      lastKey: function (e) {
        return this.reverse().firstKey(e);
      },
      distinct: function () {
        var t = this._ctx;
        var n = t.index && t.table.schema.idxByName[t.index];
        if (!n || !n.multi) {
          return this;
        }
        var r = {};
        e(this._ctx, function (e) {
          var t = e.primaryKey.toString();
          var n = u(r, t);
          r[t] = true;
          return !n;
        });
        return this;
      },
      modify: function (e) {
        var t = this;
        var n = this._ctx.table.hook;
        var i = n.updating.fire;
        var o = n.deleting.fire;
        return this._write(function (n, s, l, c) {
          var d;
          if (typeof e == "function") {
            d = i === J && o === J ? e : function (t) {
              var n = C(t);
              if (e.call(this, t, this) === false) {
                return false;
              }
              if (u(this, "value")) {
                var a = I(n, this.value);
                var s = i.call(this, a, this.primKey, n, c);
                if (s) {
                  t = this.value;
                  r(s).forEach(function (e) {
                    S(t, e, s[e]);
                  });
                }
              } else {
                o.call(this, this.primKey, t, c);
              }
            };
          } else if (i === J) {
            var f = r(e);
            var p = f.length;
            d = function (t) {
              var n = false;
              for (var r = 0; r < p; ++r) {
                var i = f[r];
                var o = e[i];
                if (E(t, i) !== o) {
                  S(t, i, o);
                  n = true;
                }
              }
              return n;
            };
          } else {
            var h = e;
            e = T(h);
            d = function (t) {
              var n = false;
              var o = i.call(this, e, this.primKey, C(t), c);
              if (o) {
                a(e, o);
              }
              r(e).forEach(function (r) {
                var i = e[r];
                if (E(t, r) !== i) {
                  S(t, r, i);
                  n = true;
                }
              });
              if (o) {
                e = T(h);
              }
              return n;
            };
          }
          var m = 0;
          var y = 0;
          var g = false;
          var v = [];
          var b = [];
          var _ = null;
          function w(e) {
            if (e) {
              v.push(e);
              b.push(_);
            }
            return s(new q("Error modifying one or more objects", v, y, b));
          }
          function k() {
            if (g && y + v.length === m) {
              if (v.length > 0) {
                w();
              } else {
                n(y);
              }
            }
          }
          t.clone().raw()._iterate(function (e, t) {
            _ = t.primaryKey;
            var n = {
              primKey: t.primaryKey,
              value: e,
              onsuccess: null,
              onerror: null
            };
            function r(e) {
              v.push(e);
              b.push(n.primKey);
              k();
              return true;
            }
            if (d.call(n, e, n) !== false) {
              var i = !u(n, "value");
              ++m;
              x(function () {
                var e = i ? t.delete() : t.update(n.value);
                e._hookCtx = n;
                e.onerror = Pt(r);
                e.onsuccess = Tt(function () {
                  ++y;
                  k();
                });
              }, r);
            } else if (n.onsuccess) {
              n.onsuccess(n.value);
            }
          }, function () {
            g = true;
            k();
          }, w, l);
        });
      },
      delete: function () {
        var e = this;
        var t = this._ctx;
        var n = t.range;
        var r = t.table.hook.deleting.fire;
        var i = r !== J;
        if (!i && _e(t) && (t.isPrimKey && !wt || !n)) {
          return this._write(function (e, t, r) {
            var i = kt(t);
            var o = n ? r.count(n) : r.count();
            o.onerror = i;
            o.onsuccess = function () {
              var a = o.result;
              x(function () {
                var t = n ? r.delete(n) : r.clear();
                t.onerror = i;
                t.onsuccess = function () {
                  return e(a);
                };
              }, function (e) {
                return t(e);
              });
            };
          });
        }
        var o = i ? 2000 : 10000;
        return this._write(function (n, a, s, l) {
          var u = 0;
          var c = e.clone({
            keysOnly: !t.isMatch && !i
          }).distinct().limit(o).raw();
          var d = [];
          function f() {
            return c.each(i ? function (e, t) {
              d.push([t.primaryKey, t.value]);
            } : function (e, t) {
              d.push(t.primaryKey);
            }).then(function () {
              if (i) {
                d.sort(function (e, t) {
                  return ke(e[0], t[0]);
                });
              } else {
                d.sort(ke);
              }
              return he(s, l, d, i, r);
            }).then(function () {
              var e = d.length;
              d = [];
              if (e < o) {
                return u += e;
              } else {
                return f();
              }
            });
          }
          n(f());
        });
      }
    };
  });
  a(this, {
    Collection: be,
    Table: fe,
    Transaction: ge,
    Version: le,
    WhereClause: ve
  });
  X.on("versionchange", function (e) {
    if (e.newVersion > 0) {
      console.warn("Another connection wants to upgrade database '" + X.name + "'. Closing db now to resume the upgrade.");
    } else {
      console.warn("Another connection wants to delete database '" + X.name + "'. Closing db now to resume the delete request.");
    }
    X.close();
  });
  X.on("blocked", function (e) {
    if (!e.newVersion || e.newVersion < e.oldVersion) {
      console.warn("Dexie.delete('" + X.name + "') was blocked");
    } else {
      console.warn("Upgrade '" + X.name + "' blocked by other connection holding version " + e.oldVersion / 10);
    }
  });
  b.forEach(function (e) {
    e(X);
  });
}
function St(e, t) {
  r(t).forEach(function (n) {
    var r = function e(t) {
      if (typeof t == "function") {
        return new t();
      }
      if (i(t)) {
        return [e(t[0])];
      }
      if (t && typeof t == "object") {
        var n = {};
        St(n, t);
        return n;
      }
      return t;
    }(t[n]);
    e[n] = r;
  });
  return e;
}
function Tt(e) {
  return qe(function (t) {
    var n = t.target;
    var r = n._hookCtx;
    var i = r.value || n.result;
    var o = r && r.onsuccess;
    if (o) {
      o(i);
    }
    if (e) {
      e(i);
    }
  }, e);
}
function kt(e) {
  return qe(function (t) {
    Ct(t);
    e(t.target.error);
    return false;
  });
}
function Ot(e) {
  return qe(function (t) {
    e(t.target.result);
  });
}
function Pt(e) {
  return qe(function (t) {
    var n = t.target;
    var r = n.error;
    var i = n._hookCtx;
    var o = i && i.onerror;
    if (o) {
      o(r);
    }
    Ct(t);
    e(r);
    return false;
  });
}
function Ct(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  if (e.preventDefault) {
    e.preventDefault();
  }
}
function It(e) {
  function t(t) {
    return e.next(t);
  }
  var n = o(t);
  var r = o(function (t) {
    return e.throw(t);
  });
  function o(e) {
    return function (t) {
      var o = e(t);
      var a = o.value;
      if (o.done) {
        return a;
      } else if (a && typeof a.then == "function") {
        return a.then(n, r);
      } else if (i(a)) {
        return Le.all(a).then(n, r);
      } else {
        return n(a);
      }
    };
  }
  return o(t)();
}
function Mt(e, t, n, r, i, o, a) {
  this.name = e;
  this.keyPath = t;
  this.unique = n;
  this.multi = r;
  this.auto = i;
  this.compound = o;
  this.dotted = a;
  var s = typeof t == "string" ? t : t && "[" + [].join.call(t, "+") + "]";
  this.src = (n ? "&" : "") + (r ? "*" : "") + (i ? "++" : "") + s;
}
function Lt(e, t, n, r) {
  this.name = e;
  this.primKey = t || new Mt();
  this.indexes = n || [new Mt()];
  this.instanceTemplate = r;
  this.mappedClass = null;
  this.idxByName = _(n, function (e) {
    return [e.name, e];
  });
}
function Rt(e) {
  if (e.length === 1) {
    return e[0];
  } else {
    return e;
  }
}
function At(e) {
  var t = e && (e.getDatabaseNames || e.webkitGetDatabaseNames);
  return t && t.bind(e);
}
N(D, xt);
c(Et, Z);
c(Et, {
  delete: function (e) {
    var t = new Et(e);
    var n = t.delete();
    n.onblocked = function (e) {
      t.on("blocked", e);
      return this;
    };
    return n;
  },
  exists: function (e) {
    return new Et(e).open().then(function (e) {
      e.close();
      return true;
    }).catch(Et.NoSuchDatabaseError, function () {
      return false;
    });
  },
  getDatabaseNames: function (e) {
    var t = At(Et.dependencies.indexedDB);
    if (t) {
      return new Le(function (e, n) {
        var r = t();
        r.onsuccess = function (t) {
          e(y(t.target.result, 0));
        };
        r.onerror = kt(n);
      }).then(e);
    } else {
      return ft.dbnames.toCollection().primaryKeys(e);
    }
  },
  defineClass: function () {
    return function (e) {
      if (e) {
        a(this, e);
      }
    };
  },
  applyStructure: St,
  ignoreTransaction: function (e) {
    if (Pe.trans) {
      return ot(Pe.transless, e);
    } else {
      return e();
    }
  },
  vip: function (e) {
    return Je(function () {
      Pe.letThrough = true;
      return e();
    });
  },
  async: function (e) {
    return function () {
      try {
        var t = It(e.apply(this, arguments));
        if (t && typeof t.then == "function") {
          return t;
        } else {
          return Le.resolve(t);
        }
      } catch (e) {
        return ct(e);
      }
    };
  },
  spawn: function (e, t, n) {
    try {
      var r = It(e.apply(n, t || []));
      if (r && typeof r.then == "function") {
        return r;
      } else {
        return Le.resolve(r);
      }
    } catch (e) {
      return ct(e);
    }
  },
  currentTransaction: {
    get: function () {
      return Pe.trans || null;
    }
  },
  waitFor: function (e, t) {
    var n = Le.resolve(typeof e == "function" ? Et.ignoreTransaction(e) : e).timeout(t || 60000);
    if (Pe.trans) {
      return Pe.trans.waitFor(n);
    } else {
      return n;
    }
  },
  Promise: Le,
  debug: {
    get: function () {
      return D;
    },
    set: function (e) {
      N(e, e === "dexie" ? function () {
        return true;
      } : xt);
    }
  },
  derive: p,
  extend: a,
  props: c,
  override: g,
  Events: dt,
  getByKeyPath: E,
  setByKeyPath: S,
  delByKeyPath: function (e, t) {
    if (typeof t == "string") {
      S(e, t, undefined);
    } else if ("length" in t) {
      [].map.call(t, function (t) {
        S(e, t, undefined);
      });
    }
  },
  shallowClone: T,
  deepClone: C,
  getObjectDiff: I,
  asap: b,
  maxKey: ht,
  minKey: mt,
  addons: [],
  connections: vt,
  MultiModifyError: $.Modify,
  errnames: K,
  IndexSpec: Mt,
  TableSchema: Lt,
  dependencies: function () {
    try {
      return {
        indexedDB: o.indexedDB || o.mozIndexedDB || o.webkitIndexedDB || o.msIndexedDB,
        IDBKeyRange: o.IDBKeyRange || o.webkitIDBKeyRange
      };
    } catch (e) {
      return {
        indexedDB: null,
        IDBKeyRange: null
      };
    }
  }(),
  semVer: "{version}",
  version: "{version}".split(".").map(function (e) {
    return parseInt(e);
  }).reduce(function (e, t, n) {
    return e + t / Math.pow(10, n * 2);
  }),
  default: Et,
  Dexie: Et
});
Le.rejectionMapper = function (e, t) {
  if (!e || e instanceof W || e instanceof TypeError || e instanceof SyntaxError || !e.name || !X[e.name]) {
    return e;
  }
  var n = new X[e.name](t || e.message, e);
  if ("stack" in e) {
    f(n, "stack", {
      get: function () {
        return this.inner.stack;
      }
    });
  }
  return n;
};
(ft = new Et("__dbnames")).version(1).stores({
  dbnames: "name"
});
(function () {
  try {
    if (typeof localStorage !== undefined && o.document !== undefined) {
      JSON.parse(localStorage.getItem("Dexie.DatabaseNames") || "[]").forEach(function (e) {
        return ft.dbnames.put({
          name: e
        }).catch(J);
      });
      localStorage.removeItem("Dexie.DatabaseNames");
    }
  } catch (e) {}
})();
exports.default = Et;