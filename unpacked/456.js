var idbModules = {
  util: {
    cleanInterface: false
  }
};
(function () {
  "use strict";

  var e = {
    test: true
  };
  if (Object.defineProperty) {
    try {
      Object.defineProperty(e, "test", {
        enumerable: false
      });
      if (e.test) {
        idbModules.util.cleanInterface = true;
      }
    } catch (e) {}
  }
})();
(function (e) {
  "use strict";

  function t() {
    this.length = 0;
    this._items = [];
    if (e.util.cleanInterface) {
      Object.defineProperty(this, "_items", {
        enumerable: false
      });
    }
  }
  t.prototype = {
    contains: function (e) {
      return this._items.indexOf(e) !== -1;
    },
    item: function (e) {
      return this._items[e];
    },
    indexOf: function (e) {
      return this._items.indexOf(e);
    },
    push: function (e) {
      this._items.push(e);
      this.length += 1;
      for (var t = 0; t < this._items.length; t++) {
        this[t] = this._items[t];
      }
    },
    splice: function () {
      this._items.splice.apply(this._items, arguments);
      this.length = this._items.length;
      for (var e in this) {
        if (e === String(parseInt(e, 10))) {
          delete this[e];
        }
      }
      for (e = 0; e < this._items.length; e++) {
        this[e] = this._items[e];
      }
    }
  };
  if (e.util.cleanInterface) {
    for (var n in {
      indexOf: false,
      push: false,
      splice: false
    }) {
      Object.defineProperty(t.prototype, n, {
        enumerable: false
      });
    }
  }
  e.util.callback = function (e, t, n) {
    n.target = t;
    if (typeof t[e] == "function") {
      t[e].apply(t, [n]);
    }
  };
  e.util.StringList = t;
  e.util.quote = function (e) {
    return "\"" + e + "\"";
  };
})(idbModules);
(function (e) {
  "use strict";

  var t = "__$$compoundKey";
  var n = /\$\$/g;
  var r = "$$$$";
  var i = "$_$";
  function o(e) {
    return e && e.indexOf(t + ".") === 0;
  }
  function a(e) {
    for (var n = 0; n < e.length; n++) {
      e[n] = e[n].replace(/\./g, r);
    }
    return t + "." + e.join(i);
  }
  function s(r, o) {
    var a = function (e) {
      e = (e = e.substr(t.length + 1)).split(i);
      for (var r = 0; r < e.length; r++) {
        e[r] = e[r].replace(n, ".");
      }
      return e;
    }(o);
    var s = u(e.Key.getValue(r, a));
    o = o.substr(t.length + 1);
    r[t] = r[t] || {};
    r[t][o] = s;
  }
  function l(n) {
    if (typeof n == "string" && o(n)) {
      c(r = n);
      r = r.substr(t.length + 1);
      return r = e.Key.decode(r);
    } else {
      if (n && typeof n[t] == "object") {
        delete n[t];
      }
      return n;
    }
    var r;
  }
  function u(n) {
    e.Key.validate(n);
    n = e.Key.encode(n);
    c(n = t + "." + n);
    return n;
  }
  function c(t) {
    if (t.length > 889) {
      throw e.util.createDOMException("DataError", "The encoded key is " + t.length + " characters long, but IE only allows 889 characters. Consider replacing numeric keys with strings to reduce the encoded length.");
    }
  }
  e.polyfill = function () {
    if (navigator.userAgent.match(/MSIE/) || navigator.userAgent.match(/Trident/) || navigator.userAgent.match(/Edge/)) {
      (function () {
        var e = IDBFactory.prototype.cmp;
        var t = IDBDatabase.prototype.createObjectStore;
        var n = IDBObjectStore.prototype.createIndex;
        var r = IDBObjectStore.prototype.add;
        var i = IDBObjectStore.prototype.put;
        var c = IDBIndex.prototype.get;
        var d = IDBIndex.prototype.getKey;
        var f = IDBIndex.prototype.openCursor;
        var p = IDBIndex.prototype.openKeyCursor;
        var h = IDBObjectStore.prototype.get;
        var m = IDBObjectStore.prototype.delete;
        var y = IDBObjectStore.prototype.openCursor;
        var g = IDBObjectStore.prototype.openKeyCursor;
        var v = IDBKeyRange.bound;
        var b = IDBKeyRange.upperBound;
        var _ = IDBKeyRange.lowerBound;
        var w = IDBKeyRange.only;
        var x = Object.getOwnPropertyDescriptor(IDBRequest.prototype, "result");
        var E = Object.getOwnPropertyDescriptor(IDBCursor.prototype, "primaryKey");
        var S = Object.getOwnPropertyDescriptor(IDBCursor.prototype, "key");
        var T = Object.getOwnPropertyDescriptor(IDBCursorWithValue.prototype, "value");
        IDBFactory.prototype.cmp = function (t, n) {
          var r = Array.prototype.slice.call(arguments);
          if (t instanceof Array) {
            r[0] = u(t);
          }
          if (n instanceof Array) {
            r[1] = u(n);
          }
          return e.apply(this, r);
        };
        IDBDatabase.prototype.createObjectStore = function (e, n) {
          if (n && n.keyPath instanceof Array) {
            n.keyPath = a(n.keyPath);
          }
          return t.apply(this, arguments);
        };
        IDBObjectStore.prototype.createIndex = function (e, t, r) {
          var i = Array.prototype.slice.call(arguments);
          if (t instanceof Array) {
            i[1] = a(t);
          }
          return n.apply(this, i);
        };
        IDBObjectStore.prototype.add = function (e, t) {
          return this.__insertData(r, arguments);
        };
        IDBObjectStore.prototype.put = function (e, t) {
          return this.__insertData(i, arguments);
        };
        IDBObjectStore.prototype.__insertData = function (e, t) {
          var n = (t = Array.prototype.slice.call(t))[0];
          var r = t[1];
          if (r instanceof Array) {
            t[1] = u(r);
          }
          if (typeof n == "object") {
            if (o(this.keyPath)) {
              s(n, this.keyPath);
            }
            for (var i = 0; i < this.indexNames.length; i++) {
              var a = this.index(this.indexNames[i]);
              if (o(a.keyPath)) {
                try {
                  s(n, a.keyPath);
                } catch (e) {}
              }
            }
          }
          return e.apply(this, t);
        };
        IDBIndex.prototype.get = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return c.apply(this, t);
        };
        IDBIndex.prototype.getKey = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return d.apply(this, t);
        };
        IDBIndex.prototype.openCursor = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return f.apply(this, t);
        };
        IDBIndex.prototype.openKeyCursor = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return p.apply(this, t);
        };
        IDBObjectStore.prototype.get = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return h.apply(this, t);
        };
        IDBObjectStore.prototype.delete = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return m.apply(this, t);
        };
        IDBObjectStore.prototype.openCursor = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return y.apply(this, t);
        };
        IDBObjectStore.prototype.openKeyCursor = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return g.apply(this, t);
        };
        IDBKeyRange.bound = function (e, t, n, r) {
          var i = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            i[0] = u(e);
          }
          if (t instanceof Array) {
            i[1] = u(t);
          }
          return v.apply(IDBKeyRange, i);
        };
        IDBKeyRange.upperBound = function (e, t) {
          var n = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            n[0] = u(e);
          }
          return b.apply(IDBKeyRange, n);
        };
        IDBKeyRange.lowerBound = function (e, t) {
          var n = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            n[0] = u(e);
          }
          return _.apply(IDBKeyRange, n);
        };
        IDBKeyRange.only = function (e) {
          var t = Array.prototype.slice.call(arguments);
          if (e instanceof Array) {
            t[0] = u(e);
          }
          return w.apply(IDBKeyRange, t);
        };
        Object.defineProperty(IDBRequest.prototype, "result", {
          enumerable: x.enumerable,
          configurable: x.configurable,
          get: function () {
            var e = x.get.call(this);
            return l(e);
          }
        });
        Object.defineProperty(IDBCursor.prototype, "primaryKey", {
          enumerable: E.enumerable,
          configurable: E.configurable,
          get: function () {
            var e = E.get.call(this);
            return l(e);
          }
        });
        Object.defineProperty(IDBCursor.prototype, "key", {
          enumerable: S.enumerable,
          configurable: S.configurable,
          get: function () {
            var e = S.get.call(this);
            return l(e);
          }
        });
        Object.defineProperty(IDBCursorWithValue.prototype, "value", {
          enumerable: T.enumerable,
          configurable: T.configurable,
          get: function () {
            var e = T.get.call(this);
            return l(e);
          }
        });
        try {
          IDBTransaction.VERSION_CHANGE ||= "versionchange";
        } catch (e) {}
      })();
    }
  };
})(idbModules);
(function (idbModules) {
  "use strict";

  var Sca = function () {
    return {
      decycle: function (object, callback) {
        var objects = [];
        var paths = [];
        var queuedObjects = [];
        var returnCallback = callback;
        function checkForCompletion() {
          if (queuedObjects.length === 0) {
            returnCallback(derezObj);
          }
        }
        function readBlobAsDataURL(e, t) {
          var n = new FileReader();
          n.onloadend = function (e) {
            var n = e.target.result;
            File;
            updateEncodedBlob(n, t, "Blob");
          };
          n.readAsDataURL(e);
        }
        function updateEncodedBlob(dataURL, path, blobtype) {
          var encoded = queuedObjects.indexOf(path);
          path = path.replace("$", "derezObj");
          eval(path + ".$enc=\"" + dataURL + "\"");
          eval(path + ".$type=\"" + blobtype + "\"");
          queuedObjects.splice(encoded, 1);
          checkForCompletion();
        }
        function derez(e, t) {
          var n;
          var r;
          var i;
          if (typeof e == "object" && e !== null && !(e instanceof Boolean) && !(e instanceof Date) && !(e instanceof Number) && !(e instanceof RegExp) && !(e instanceof Blob) && !(e instanceof String)) {
            for (n = 0; n < objects.length; n += 1) {
              if (objects[n] === e) {
                return {
                  $ref: paths[n]
                };
              }
            }
            objects.push(e);
            paths.push(t);
            if (Object.prototype.toString.apply(e) === "[object Array]") {
              i = [];
              n = 0;
              for (; n < e.length; n += 1) {
                i[n] = derez(e[n], t + "[" + n + "]");
              }
            } else {
              i = {};
              for (r in e) {
                if (Object.prototype.hasOwnProperty.call(e, r)) {
                  i[r] = derez(e[r], t + "[" + JSON.stringify(r) + "]");
                }
              }
            }
            return i;
          }
          if (e instanceof Blob) {
            queuedObjects.push(t);
            readBlobAsDataURL(e, t);
          } else if (e instanceof Boolean) {
            e = {
              $type: "Boolean",
              $enc: e.toString()
            };
          } else if (e instanceof Date) {
            e = {
              $type: "Date",
              $enc: e.getTime()
            };
          } else if (e instanceof Number) {
            e = {
              $type: "Number",
              $enc: e.toString()
            };
          } else if (e instanceof RegExp) {
            e = {
              $type: "RegExp",
              $enc: e.toString()
            };
          } else if (typeof e == "number") {
            e = {
              $type: "number",
              $enc: e + ""
            };
          } else if (e === undefined) {
            e = {
              $type: "undefined"
            };
          }
          return e;
        }
        var derezObj = derez(object, "$");
        checkForCompletion();
      },
      retrocycle: function retrocycle($) {
        var px = /^\$(?:\[(?:\d+|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;
        function dataURLToBlob(e) {
          var t;
          var n;
          var r;
          if (e.indexOf(";base64,") === -1) {
            t = (n = e.split(","))[0].split(":")[1];
            r = n[1];
            return new Blob([r], {
              type: t
            });
          }
          t = (n = e.split(";base64,"))[0].split(":")[1];
          for (var i = (r = window.atob(n[1])).length, o = new Uint8Array(i), a = 0; a < i; ++a) {
            o[a] = r.charCodeAt(a);
          }
          return new Blob([o.buffer], {
            type: t
          });
        }
        function rez(value) {
          var i;
          var item;
          var name;
          var path;
          if (value && typeof value == "object") {
            if (Object.prototype.toString.apply(value) === "[object Array]") {
              for (i = 0; i < value.length; i += 1) {
                item = value[i];
                if (item && typeof item == "object") {
                  path = item.$ref;
                  if (typeof path == "string" && px.test(path)) {
                    value[i] = eval(path);
                  } else {
                    value[i] = rez(item);
                  }
                }
              }
            } else if (value.$type !== undefined) {
              switch (value.$type) {
                case "Blob":
                case "File":
                  value = dataURLToBlob(value.$enc);
                  break;
                case "Boolean":
                  value = Boolean(value.$enc === "true");
                  break;
                case "Date":
                  value = new Date(value.$enc);
                  break;
                case "Number":
                  value = Number(value.$enc);
                  break;
                case "RegExp":
                  value = eval(value.$enc);
                  break;
                case "number":
                  value = parseFloat(value.$enc);
                  break;
                case "undefined":
                  value = undefined;
              }
            } else {
              for (name in value) {
                if (typeof value[name] == "object") {
                  item = value[name];
                  if (item) {
                    path = item.$ref;
                    if (typeof path == "string" && px.test(path)) {
                      value[name] = eval(path);
                    } else {
                      value[name] = rez(item);
                    }
                  }
                }
              }
            }
          }
          return value;
        }
        return rez($);
      },
      encode: function (e, t) {
        this.decycle(e, function (e) {
          t(JSON.stringify(e));
        });
      },
      decode: function (e) {
        return this.retrocycle(JSON.parse(e));
      }
    };
  }();
  idbModules.Sca = Sca;
})(idbModules);
(function (idbModules) {
  "use strict";

  var collations = ["undefined", "number", "date", "string", "array"];
  var signValues = ["negativeInfinity", "bigNegative", "smallNegative", "smallPositive", "bigPositive", "positiveInfinity"];
  var types = {
    undefined: {
      encode: function (e) {
        return collations.indexOf("undefined") + "-";
      },
      decode: function (e) {}
    },
    date: {
      encode: function (e) {
        return collations.indexOf("date") + "-" + e.toJSON();
      },
      decode: function (e) {
        return new Date(e.substring(2));
      }
    },
    number: {
      encode: function (e) {
        var t = Math.abs(e).toString(32);
        var n = t.indexOf(".");
        var r = (t = n !== -1 ? t.replace(".", "") : t).search(/[^0]/);
        t = t.slice(r);
        var i;
        var o = zeros(2);
        var a = zeros(11);
        if (isFinite(e)) {
          if (e < 0) {
            if (e > -1) {
              i = signValues.indexOf("smallNegative");
              o = padBase32Exponent(r);
              a = flipBase32(padBase32Mantissa(t));
            } else {
              i = signValues.indexOf("bigNegative");
              o = flipBase32(padBase32Exponent(n !== -1 ? n : t.length));
              a = flipBase32(padBase32Mantissa(t));
            }
          } else if (e < 1) {
            i = signValues.indexOf("smallPositive");
            o = flipBase32(padBase32Exponent(r));
            a = padBase32Mantissa(t);
          } else {
            i = signValues.indexOf("bigPositive");
            o = padBase32Exponent(n !== -1 ? n : t.length);
            a = padBase32Mantissa(t);
          }
        } else {
          i = signValues.indexOf(e > 0 ? "positiveInfinity" : "negativeInfinity");
        }
        return collations.indexOf("number") + "-" + i + o + a;
      },
      decode: function (e) {
        var t = +e.substr(2, 1);
        var n = e.substr(3, 2);
        var r = e.substr(5, 11);
        switch (signValues[t]) {
          case "negativeInfinity":
            return -Infinity;
          case "positiveInfinity":
            return Infinity;
          case "bigPositive":
            return pow32(r, n);
          case "smallPositive":
            return pow32(r, n = negate(flipBase32(n)));
          case "smallNegative":
            n = negate(n);
            return -pow32(r = flipBase32(r), n);
          case "bigNegative":
            n = flipBase32(n);
            return -pow32(r = flipBase32(r), n);
          default:
            throw new Error("Invalid number.");
        }
      }
    },
    string: {
      encode: function (e, t) {
        if (t) {
          e = e.replace(/(.)/g, "-$1") + " ";
        }
        return collations.indexOf("string") + "-" + e;
      },
      decode: function (e, t) {
        e = e.substring(2);
        if (t) {
          e = e.substr(0, e.length - 1).replace(/-(.)/g, "$1");
        }
        return e;
      }
    },
    array: {
      encode: function (e) {
        var t = [];
        for (var n = 0; n < e.length; n++) {
          var r = e[n];
          var i = idbModules.Key.encode(r, true);
          t[n] = i;
        }
        t.push(collations.indexOf("undefined") + "-");
        return collations.indexOf("array") + "-" + JSON.stringify(t);
      },
      decode: function (e) {
        var t = JSON.parse(e.substring(2));
        t.pop();
        for (var n = 0; n < t.length; n++) {
          var r = t[n];
          var i = idbModules.Key.decode(r, true);
          t[n] = i;
        }
        return t;
      }
    }
  };
  function padBase32Exponent(e) {
    if ((e = e.toString(32)).length === 1) {
      return "0" + e;
    } else {
      return e;
    }
  }
  function padBase32Mantissa(e) {
    return (e + zeros(11)).slice(0, 11);
  }
  function flipBase32(e) {
    var t = "";
    for (var n = 0; n < e.length; n++) {
      t += (31 - parseInt(e[n], 32)).toString(32);
    }
    return t;
  }
  function pow32(e, t) {
    var n;
    var r;
    var i;
    if ((t = parseInt(t, 32)) < 0) {
      return roundToPrecision(parseInt(e, 32) * Math.pow(32, t - 10));
    } else if (t < 11) {
      n = e.slice(0, t);
      n = parseInt(n, 32);
      r = e.slice(t);
      return roundToPrecision(n + (r = parseInt(r, 32) * Math.pow(32, t - 11)));
    } else {
      i = e + zeros(t - 11);
      return parseInt(i, 32);
    }
  }
  function roundToPrecision(e, t) {
    t = t || 16;
    return parseFloat(e.toPrecision(t));
  }
  function zeros(e) {
    var t = "";
    while (e--) {
      t += "0";
    }
    return t;
  }
  function negate(e) {
    return "-" + e;
  }
  function getType(e) {
    if (e instanceof Date) {
      return "date";
    } else if (e instanceof Array) {
      return "array";
    } else {
      return typeof e;
    }
  }
  function validate(e) {
    var t = getType(e);
    if (t === "array") {
      for (var n = 0; n < e.length; n++) {
        validate(e[n]);
      }
    } else if (!types[t] || t !== "string" && isNaN(e)) {
      throw idbModules.util.createDOMException("DataError", "Not a valid key");
    }
  }
  function getValue(source, keyPath) {
    try {
      if (keyPath instanceof Array) {
        var arrayValue = [];
        for (var i = 0; i < keyPath.length; i++) {
          arrayValue.push(eval("source." + keyPath[i]));
        }
        return arrayValue;
      }
      return eval("source." + keyPath);
    } catch (e) {
      return;
    }
  }
  function setValue(e, t, n) {
    for (var r = t.split("."), i = 0; i < r.length - 1; i++) {
      var o = r[i];
      e = e[o] = e[o] || {};
    }
    e[r[r.length - 1]] = n;
  }
  function isMultiEntryMatch(e, t) {
    if (collations[t.substring(0, 1)] === "array") {
      return t.indexOf(e) > 1;
    } else {
      return t === e;
    }
  }
  function isKeyInRange(e, t) {
    var n = t.lower === undefined;
    var r = t.upper === undefined;
    var i = idbModules.Key.encode(e, true);
    if (t.lower !== undefined) {
      if (t.lowerOpen && i > t.__lower) {
        n = true;
      }
      if (!t.lowerOpen && i >= t.__lower) {
        n = true;
      }
    }
    if (t.upper !== undefined) {
      if (t.upperOpen && i < t.__upper) {
        r = true;
      }
      if (!t.upperOpen && i <= t.__upper) {
        r = true;
      }
    }
    return n && r;
  }
  function findMultiEntryMatches(e, t) {
    var n = [];
    if (e instanceof Array) {
      for (var r = 0; r < e.length; r++) {
        var i = e[r];
        if (i instanceof Array) {
          if (t.lower === t.upper) {
            continue;
          }
          if (i.length !== 1) {
            if (findMultiEntryMatches(i, t).length > 0) {
              n.push(i);
            }
            continue;
          }
          i = i[0];
        }
        if (isKeyInRange(i, t)) {
          n.push(i);
        }
      }
    } else if (isKeyInRange(e, t)) {
      n.push(e);
    }
    return n;
  }
  idbModules.Key = {
    encode: function (e, t) {
      if (e === undefined) {
        return null;
      } else {
        return types[getType(e)].encode(e, t);
      }
    },
    decode: function (e, t) {
      if (typeof e == "string") {
        return types[collations[e.substring(0, 1)]].decode(e, t);
      }
    },
    validate: validate,
    getValue: getValue,
    setValue: setValue,
    isMultiEntryMatch: isMultiEntryMatch,
    findMultiEntryMatches: findMultiEntryMatches
  };
})(idbModules);
(function (e) {
  "use strict";

  function t(e, t) {
    var n = new Event(e);
    n.debug = t;
    Object.defineProperty(n, "target", {
      writable: true
    });
    return n;
  }
  function n(e, t) {
    this.type = e;
    this.debug = t;
    this.bubbles = false;
    this.cancelable = false;
    this.eventPhase = 0;
    this.timeStamp = new Date().valueOf();
  }
  var r = false;
  try {
    var i = t("test type", "test debug");
    var o = {
      test: "test target"
    };
    i.target = o;
    if (i instanceof Event && i.type === "test type" && i.debug === "test debug" && i.target === o) {
      r = true;
    }
  } catch (e) {}
  if (r) {
    e.Event = Event;
    e.IDBVersionChangeEvent = Event;
    e.util.createEvent = t;
  } else {
    e.Event = n;
    e.IDBVersionChangeEvent = n;
    e.util.createEvent = function (e, t) {
      return new n(e, t);
    };
  }
})(idbModules);
(function (e) {
  "use strict";

  function t(e, t) {
    var n = new DOMException.prototype.constructor(0, t);
    n.name = e || "DOMException";
    n.message = t;
    return n;
  }
  function n(e, t) {
    e = e || "DOMError";
    var n = new DOMError(e, t);
    if (n.name !== e) {
      n.name = e;
    }
    if (n.message !== t) {
      n.message = t;
    }
    return n;
  }
  function r(e, t) {
    var n = new Error(t);
    n.name = e || "DOMException";
    n.message = t;
    return n;
  }
  e.util.logError = function (t, n, r) {
    if (e.DEBUG) {
      if (r && r.message) {
        r = r.message;
      }
      var i = typeof console.error == "function" ? "error" : "log";
      console[i](t + ": " + n + ". " + (r || ""));
      if (console.trace) {
        console.trace();
      }
    }
  };
  e.util.findError = function (e) {
    var t;
    if (e) {
      if (e.length === 1) {
        return e[0];
      }
      for (var n = 0; n < e.length; n++) {
        var r = e[n];
        if (r instanceof Error || r instanceof DOMException) {
          return r;
        }
        if (r && typeof r.message == "string") {
          t = r;
        }
      }
    }
    return t;
  };
  var i;
  var o = false;
  var a = false;
  try {
    if ((i = t("test name", "test message")) instanceof DOMException && i.name === "test name" && i.message === "test message") {
      o = true;
    }
  } catch (e) {}
  try {
    if ((i = n("test name", "test message")) instanceof DOMError && i.name === "test name" && i.message === "test message") {
      a = true;
    }
  } catch (e) {}
  if (o) {
    e.DOMException = DOMException;
    e.util.createDOMException = function (n, r, i) {
      e.util.logError(n, r, i);
      return t(n, r);
    };
  } else {
    e.DOMException = Error;
    e.util.createDOMException = function (t, n, i) {
      e.util.logError(t, n, i);
      return r(t, n);
    };
  }
  if (a) {
    e.DOMError = DOMError;
    e.util.createDOMError = function (t, r, i) {
      e.util.logError(t, r, i);
      return n(t, r);
    };
  } else {
    e.DOMError = Error;
    e.util.createDOMError = function (t, n, i) {
      e.util.logError(t, n, i);
      return r(t, n);
    };
  }
})(idbModules);
(function (e) {
  "use strict";

  function t() {
    this.onsuccess = this.onerror = this.result = this.error = this.source = this.transaction = null;
    this.readyState = "pending";
  }
  function n() {
    this.onblocked = this.onupgradeneeded = null;
  }
  n.prototype = new t();
  n.prototype.constructor = n;
  e.IDBRequest = t;
  e.IDBOpenDBRequest = n;
})(idbModules);
(function (e, t) {
  "use strict";

  function n(n, r, i, o) {
    if (n !== t) {
      e.Key.validate(n);
    }
    if (r !== t) {
      e.Key.validate(r);
    }
    this.lower = n;
    this.upper = r;
    this.lowerOpen = !!i;
    this.upperOpen = !!o;
  }
  n.only = function (e) {
    return new n(e, e, false, false);
  };
  n.lowerBound = function (e, r) {
    return new n(e, t, r, t);
  };
  n.upperBound = function (e, r) {
    return new n(t, e, t, r);
  };
  n.bound = function (e, t, r, i) {
    return new n(e, t, r, i);
  };
  e.IDBKeyRange = n;
})(idbModules);
(function (e, t) {
  "use strict";

  function n(n, r, i, o, a, s, l) {
    if (n === null) {
      n = t;
    }
    if (n !== t && !(n instanceof e.IDBKeyRange)) {
      n = new e.IDBKeyRange(n, n, false, false);
    }
    i.transaction.__assertActive();
    if (r !== t && ["next", "prev", "nextunique", "prevunique"].indexOf(r) === -1) {
      throw new TypeError(r + "is not a valid cursor direction");
    }
    this.source = o;
    this.direction = r || "next";
    this.key = t;
    this.primaryKey = t;
    this.__store = i;
    this.__range = n;
    this.__req = new e.IDBRequest();
    this.__keyColumnName = a;
    this.__valueColumnName = s;
    this.__valueDecoder = s === "value" ? e.Sca : e.Key;
    this.__count = l;
    this.__offset = -1;
    this.__lastKeyContinued = t;
    this.__multiEntryIndex = o instanceof e.IDBIndex && o.multiEntry;
    this.__unique = this.direction.indexOf("unique") !== -1;
    if (n !== t) {
      n.__lower = n.lower !== t && e.Key.encode(n.lower, this.__multiEntryIndex);
      n.__upper = n.upper !== t && e.Key.encode(n.upper, this.__multiEntryIndex);
    }
    this.continue();
  }
  n.prototype.__find = function () {
    var e = Array.prototype.slice.call(arguments);
    if (this.__multiEntryIndex) {
      this.__findMultiEntry.apply(this, e);
    } else {
      this.__findBasic.apply(this, e);
    }
  };
  n.prototype.__findBasic = function (n, r, i, o, a) {
    a = a || 1;
    var s = this;
    var l = e.util.quote(s.__keyColumnName);
    var u = ["SELECT * FROM", e.util.quote(s.__store.name)];
    var c = [];
    u.push("WHERE", l, "NOT NULL");
    if (!!s.__range && (s.__range.lower !== t || s.__range.upper !== t)) {
      u.push("AND");
      if (s.__range.lower !== t) {
        u.push(l, s.__range.lowerOpen ? ">" : ">=", "?");
        c.push(s.__range.__lower);
      }
      if (s.__range.lower !== t && s.__range.upper !== t) {
        u.push("AND");
      }
      if (s.__range.upper !== t) {
        u.push(l, s.__range.upperOpen ? "<" : "<=", "?");
        c.push(s.__range.__upper);
      }
    }
    if (n !== undefined) {
      s.__lastKeyContinued = n;
      s.__offset = 0;
    }
    if (s.__lastKeyContinued !== t) {
      u.push("AND", l, ">= ?");
      e.Key.validate(s.__lastKeyContinued);
      c.push(e.Key.encode(s.__lastKeyContinued));
    }
    var d = s.direction === "prev" || s.direction === "prevunique" ? "DESC" : "ASC";
    if (!s.__count) {
      u.push("ORDER BY", l, d);
      u.push("LIMIT", a, "OFFSET", s.__offset);
    }
    u = u.join(" ");
    if (e.DEBUG) {
      console.log(u, c);
    }
    s.__prefetchedData = null;
    s.__prefetchedIndex = 0;
    r.executeSql(u, c, function (n, r) {
      if (s.__count) {
        i(t, r.rows.length, t);
      } else if (r.rows.length > 1) {
        s.__prefetchedData = r.rows;
        s.__prefetchedIndex = 0;
        if (e.DEBUG) {
          console.log("Preloaded " + s.__prefetchedData.length + " records for cursor");
        }
        s.__decode(r.rows.item(0), i);
      } else if (r.rows.length === 1) {
        s.__decode(r.rows.item(0), i);
      } else {
        if (e.DEBUG) {
          console.log("Reached end of cursors");
        }
        i(t, t, t);
      }
    }, function (t, n) {
      if (e.DEBUG) {
        console.log("Could not execute Cursor.continue", u, c);
      }
      o(n);
    });
  };
  n.prototype.__findMultiEntry = function (n, r, i, o) {
    var a = this;
    if (a.__prefetchedData && a.__prefetchedData.length === a.__prefetchedIndex) {
      if (e.DEBUG) {
        console.log("Reached end of multiEntry cursor");
      }
      i(t, t, t);
      return;
    }
    var s = e.util.quote(a.__keyColumnName);
    var l = ["SELECT * FROM", e.util.quote(a.__store.name)];
    var u = [];
    l.push("WHERE", s, "NOT NULL");
    if (a.__range && a.__range.lower !== t && a.__range.upper !== t && a.__range.upper.indexOf(a.__range.lower) === 0) {
      l.push("AND", s, "LIKE ?");
      u.push("%" + a.__range.__lower.slice(0, -1) + "%");
    }
    if (n !== undefined) {
      a.__lastKeyContinued = n;
      a.__offset = 0;
    }
    if (a.__lastKeyContinued !== t) {
      l.push("AND", s, ">= ?");
      e.Key.validate(a.__lastKeyContinued);
      u.push(e.Key.encode(a.__lastKeyContinued));
    }
    var c = a.direction === "prev" || a.direction === "prevunique" ? "DESC" : "ASC";
    if (!a.__count) {
      l.push("ORDER BY key", c);
    }
    l = l.join(" ");
    if (e.DEBUG) {
      console.log(l, u);
    }
    a.__prefetchedData = null;
    a.__prefetchedIndex = 0;
    r.executeSql(l, u, function (n, r) {
      a.__multiEntryOffset = r.rows.length;
      if (r.rows.length > 0) {
        var o = [];
        for (var s = 0; s < r.rows.length; s++) {
          var l = r.rows.item(s);
          var u = e.Key.decode(l[a.__keyColumnName], true);
          for (var c = e.Key.findMultiEntryMatches(u, a.__range), d = 0; d < c.length; d++) {
            var f = c[d];
            var p = {
              matchingKey: e.Key.encode(f, true),
              key: l.key
            };
            p[a.__keyColumnName] = l[a.__keyColumnName];
            p[a.__valueColumnName] = l[a.__valueColumnName];
            o.push(p);
          }
        }
        var h = a.direction.indexOf("prev") === 0;
        o.sort(function (e, t) {
          if (e.matchingKey.replace("[", "z") < t.matchingKey.replace("[", "z")) {
            if (h) {
              return 1;
            } else {
              return -1;
            }
          } else if (e.matchingKey.replace("[", "z") > t.matchingKey.replace("[", "z")) {
            if (h) {
              return -1;
            } else {
              return 1;
            }
          } else if (e.key < t.key) {
            if (a.direction === "prev") {
              return 1;
            } else {
              return -1;
            }
          } else if (e.key > t.key) {
            if (a.direction === "prev") {
              return -1;
            } else {
              return 1;
            }
          } else {
            return 0;
          }
        });
        a.__prefetchedData = {
          data: o,
          length: o.length,
          item: function (e) {
            return this.data[e];
          }
        };
        a.__prefetchedIndex = 0;
        if (a.__count) {
          i(t, o.length, t);
        } else if (o.length > 1) {
          if (e.DEBUG) {
            console.log("Preloaded " + a.__prefetchedData.length + " records for multiEntry cursor");
          }
          a.__decode(o[0], i);
        } else if (o.length === 1) {
          if (e.DEBUG) {
            console.log("Reached end of multiEntry cursor");
          }
          a.__decode(o[0], i);
        } else {
          if (e.DEBUG) {
            console.log("Reached end of multiEntry cursor");
          }
          i(t, t, t);
        }
      } else {
        if (e.DEBUG) {
          console.log("Reached end of multiEntry cursor");
        }
        i(t, t, t);
      }
    }, function (t, n) {
      if (e.DEBUG) {
        console.log("Could not execute Cursor.continue", l, u);
      }
      o(n);
    });
  };
  n.prototype.__onsuccess = function (e) {
    var n = this;
    return function (r, i, o) {
      if (n.__count) {
        e(i, n.__req);
      } else {
        n.key = r === t ? null : r;
        n.value = i === t ? null : i;
        n.primaryKey = o === t ? null : o;
        e(r === t ? null : n, n.__req);
      }
    };
  };
  n.prototype.__decode = function (n, r) {
    if (this.__multiEntryIndex && this.__unique) {
      this.__matchedKeys ||= {};
      if (this.__matchedKeys[n.matchingKey]) {
        r(t, t, t);
        return;
      }
      this.__matchedKeys[n.matchingKey] = true;
    }
    r(e.Key.decode(this.__multiEntryIndex ? n.matchingKey : n[this.__keyColumnName], this.__multiEntryIndex), this.__valueDecoder.decode(n[this.__valueColumnName]), e.Key.decode(n.key));
  };
  n.prototype.continue = function (t) {
    var n = e.cursorPreloadPackSize || 100;
    var r = this;
    this.__store.transaction.__pushToQueue(r.__req, function (e, i, o, a) {
      r.__offset++;
      if (r.__prefetchedData && (r.__prefetchedIndex++, r.__prefetchedIndex < r.__prefetchedData.length)) {
        r.__decode(r.__prefetchedData.item(r.__prefetchedIndex), r.__onsuccess(o));
      } else {
        r.__find(t, e, r.__onsuccess(o), a, n);
      }
    });
  };
  n.prototype.advance = function (n) {
    if (n <= 0) {
      throw e.util.createDOMException("Type Error", "Count is invalid - 0 or negative", n);
    }
    var r = this;
    this.__store.transaction.__pushToQueue(r.__req, function (e, i, o, a) {
      r.__offset += n;
      r.__find(t, e, r.__onsuccess(o), a);
    });
  };
  n.prototype.update = function (n) {
    var r = this;
    r.__store.transaction.__assertWritable();
    return r.__store.transaction.__addToTransactionQueue(function (i, o, a, s) {
      e.Sca.encode(n, function (o) {
        r.__find(t, i, function (t, l, u) {
          var c = r.__store;
          var d = [o];
          var f = ["UPDATE", e.util.quote(c.name), "SET value = ?"];
          e.Key.validate(u);
          for (var p = 0; p < c.indexNames.length; p++) {
            var h = c.__indexes[c.indexNames[p]];
            var m = e.Key.getValue(n, h.keyPath);
            f.push(",", e.util.quote(h.name), "= ?");
            d.push(e.Key.encode(m, h.multiEntry));
          }
          f.push("WHERE key = ?");
          d.push(e.Key.encode(u));
          if (e.DEBUG) {
            console.log(f.join(" "), o, t, u);
          }
          i.executeSql(f.join(" "), d, function (e, n) {
            r.__prefetchedData = null;
            r.__prefetchedIndex = 0;
            if (n.rowsAffected === 1) {
              a(t);
            } else {
              s("No rows with key found" + t);
            }
          }, function (e, t) {
            s(t);
          });
        }, s);
      });
    });
  };
  n.prototype.delete = function () {
    var n = this;
    n.__store.transaction.__assertWritable();
    return this.__store.transaction.__addToTransactionQueue(function (r, i, o, a) {
      n.__find(t, r, function (i, s, l) {
        var u = "DELETE FROM  " + e.util.quote(n.__store.name) + " WHERE key = ?";
        if (e.DEBUG) {
          console.log(u, i, l);
        }
        e.Key.validate(l);
        r.executeSql(u, [e.Key.encode(l)], function (e, r) {
          n.__prefetchedData = null;
          n.__prefetchedIndex = 0;
          if (r.rowsAffected === 1) {
            n.__offset--;
            o(t);
          } else {
            a("No rows with key found" + i);
          }
        }, function (e, t) {
          a(t);
        });
      }, a);
    });
  };
  e.IDBCursor = n;
})(idbModules);
(function (e, t) {
  "use strict";

  function n(e, t) {
    this.objectStore = e;
    this.name = t.columnName;
    this.keyPath = t.keyPath;
    this.multiEntry = t.optionalParams && t.optionalParams.multiEntry;
    this.unique = t.optionalParams && t.optionalParams.unique;
    this.__deleted = !!t.__deleted;
  }
  n.__clone = function (e, t) {
    return new n(t, {
      columnName: e.name,
      keyPath: e.keyPath,
      optionalParams: {
        multiEntry: e.multiEntry,
        unique: e.unique
      }
    });
  };
  n.__createIndex = function (t, r) {
    var i = !!t.__indexes[r.name] && t.__indexes[r.name].__deleted;
    t.__indexes[r.name] = r;
    t.indexNames.push(r.name);
    t.transaction.__addToTransactionQueue(function (o, a, s, l) {
      function u(t, n) {
        l(e.util.createDOMException(0, "Could not create index \"" + r.name + "\"", n));
      }
      function c(i) {
        n.__updateIndexList(t, i, function () {
          i.executeSql("SELECT * FROM " + e.util.quote(t.name), [], function (n, i) {
            if (e.DEBUG) {
              console.log("Adding existing " + t.name + " records to the " + r.name + " index");
            }
            (function o(a) {
              if (a < i.rows.length) {
                try {
                  var l = e.Sca.decode(i.rows.item(a).value);
                  var c = e.Key.getValue(l, r.keyPath);
                  c = e.Key.encode(c, r.multiEntry);
                  n.executeSql("UPDATE " + e.util.quote(t.name) + " set " + e.util.quote(r.name) + " = ? where key = ?", [c, i.rows.item(a).key], function (e, t) {
                    o(a + 1);
                  }, u);
                } catch (e) {
                  o(a + 1);
                }
              } else {
                s(t);
              }
            })(0);
          }, u);
        }, u);
      }
      if (i) {
        c(o);
      } else {
        var d = ["ALTER TABLE", e.util.quote(t.name), "ADD", e.util.quote(r.name), "BLOB"].join(" ");
        if (e.DEBUG) {
          console.log(d);
        }
        o.executeSql(d, [], c, u);
      }
    });
  };
  n.__deleteIndex = function (t, r) {
    t.__indexes[r.name].__deleted = true;
    t.indexNames.splice(t.indexNames.indexOf(r.name), 1);
    t.transaction.__addToTransactionQueue(function (i, o, a, s) {
      n.__updateIndexList(t, i, a, function (t, n) {
        s(e.util.createDOMException(0, "Could not delete index \"" + r.name + "\"", n));
      });
    });
  };
  n.__updateIndexList = function (t, n, r, i) {
    var o = {};
    for (var a = 0; a < t.indexNames.length; a++) {
      var s = t.__indexes[t.indexNames[a]];
      o[s.name] = {
        columnName: s.name,
        keyPath: s.keyPath,
        optionalParams: {
          unique: s.unique,
          multiEntry: s.multiEntry
        },
        deleted: !!s.deleted
      };
    }
    if (e.DEBUG) {
      console.log("Updating the index list for " + t.name, o);
    }
    n.executeSql("UPDATE __sys__ set indexList = ? where name = ?", [JSON.stringify(o), t.name], function () {
      r(t);
    }, i);
  };
  n.prototype.__fetchIndexData = function (t, n) {
    var r;
    var i;
    var o = this;
    if (arguments.length === 1) {
      n = t;
      r = false;
    } else {
      e.Key.validate(t);
      i = e.Key.encode(t, o.multiEntry);
      r = true;
    }
    return o.objectStore.transaction.__addToTransactionQueue(function (t, a, s, l) {
      var u = ["SELECT * FROM", e.util.quote(o.objectStore.name), "WHERE", e.util.quote(o.name), "NOT NULL"];
      var c = [];
      if (r) {
        if (o.multiEntry) {
          u.push("AND", e.util.quote(o.name), "LIKE ?");
          c.push("%" + i + "%");
        } else {
          u.push("AND", e.util.quote(o.name), "= ?");
          c.push(i);
        }
      }
      if (e.DEBUG) {
        console.log("Trying to fetch data for Index", u.join(" "), c);
      }
      t.executeSql(u.join(" "), c, function (t, a) {
        var l = 0;
        var u = null;
        if (o.multiEntry) {
          for (var c = 0; c < a.rows.length; c++) {
            var d = a.rows.item(c);
            var f = e.Key.decode(d[o.name]);
            if (r && e.Key.isMultiEntryMatch(i, d[o.name])) {
              l++;
              u = u || d;
            } else if (!r && f !== undefined) {
              l += f instanceof Array ? f.length : 1;
              u = u || d;
            }
          }
        } else {
          u = (l = a.rows.length) && a.rows.item(0);
        }
        s(n === "count" ? l : l === 0 ? undefined : n === "key" ? e.Key.decode(u.key) : e.Sca.decode(u.value));
      }, l);
    });
  };
  n.prototype.openCursor = function (t, n) {
    return new e.IDBCursor(t, n, this.objectStore, this, this.name, "value").__req;
  };
  n.prototype.openKeyCursor = function (t, n) {
    return new e.IDBCursor(t, n, this.objectStore, this, this.name, "key").__req;
  };
  n.prototype.get = function (e) {
    if (arguments.length === 0) {
      throw new TypeError("No key was specified");
    }
    return this.__fetchIndexData(e, "value");
  };
  n.prototype.getKey = function (e) {
    if (arguments.length === 0) {
      throw new TypeError("No key was specified");
    }
    return this.__fetchIndexData(e, "key");
  };
  n.prototype.count = function (t) {
    if (t === undefined) {
      return this.__fetchIndexData("count");
    } else if (t instanceof e.IDBKeyRange) {
      return new e.IDBCursor(t, "next", this.objectStore, this, this.name, "value", true).__req;
    } else {
      return this.__fetchIndexData(t, "count");
    }
  };
  e.IDBIndex = n;
})(idbModules);
(function (e) {
  "use strict";

  function t(t, n) {
    this.name = t.name;
    this.keyPath = JSON.parse(t.keyPath);
    this.transaction = n;
    this.autoIncrement = typeof t.autoInc == "string" ? t.autoInc === "true" : !!t.autoInc;
    this.__indexes = {};
    this.indexNames = new e.util.StringList();
    var r = JSON.parse(t.indexList);
    for (var i in r) {
      if (r.hasOwnProperty(i)) {
        var o = new e.IDBIndex(this, r[i]);
        this.__indexes[o.name] = o;
        if (!o.__deleted) {
          this.indexNames.push(o.name);
        }
      }
    }
  }
  t.__clone = function (e, n) {
    var r = new t({
      name: e.name,
      keyPath: JSON.stringify(e.keyPath),
      autoInc: JSON.stringify(e.autoIncrement),
      indexList: "{}"
    }, n);
    r.__indexes = e.__indexes;
    r.indexNames = e.indexNames;
    return r;
  };
  t.__createObjectStore = function (t, n) {
    t.__objectStores[n.name] = n;
    t.objectStoreNames.push(n.name);
    var r = t.__versionTransaction;
    e.IDBTransaction.__assertVersionChange(r);
    r.__addToTransactionQueue(function (t, r, i, o) {
      function a(t, r) {
        throw e.util.createDOMException(0, "Could not create object store \"" + n.name + "\"", r);
      }
      var s = ["CREATE TABLE", e.util.quote(n.name), "(key BLOB", n.autoIncrement ? "UNIQUE, inc INTEGER PRIMARY KEY AUTOINCREMENT" : "PRIMARY KEY", ", value BLOB)"].join(" ");
      if (e.DEBUG) {
        console.log(s);
      }
      t.executeSql(s, [], function (e, t) {
        e.executeSql("INSERT INTO __sys__ VALUES (?,?,?,?)", [n.name, JSON.stringify(n.keyPath), n.autoIncrement, "{}"], function () {
          i(n);
        }, a);
      }, a);
    });
  };
  t.__deleteObjectStore = function (t, n) {
    t.__objectStores[n.name] = undefined;
    t.objectStoreNames.splice(t.objectStoreNames.indexOf(n.name), 1);
    var r = t.__versionTransaction;
    e.IDBTransaction.__assertVersionChange(r);
    r.__addToTransactionQueue(function (t, r, i, o) {
      function a(t, n) {
        o(e.util.createDOMException(0, "Could not delete ObjectStore", n));
      }
      t.executeSql("SELECT * FROM __sys__ where name = ?", [n.name], function (t, r) {
        if (r.rows.length > 0) {
          t.executeSql("DROP TABLE " + e.util.quote(n.name), [], function () {
            t.executeSql("DELETE FROM __sys__ WHERE name = ?", [n.name], function () {
              i();
            }, a);
          }, a);
        }
      });
    });
  };
  t.prototype.__validateKey = function (t, n) {
    if (this.keyPath) {
      if (n !== undefined) {
        throw e.util.createDOMException("DataError", "The object store uses in-line keys and the key parameter was provided", this);
      }
      if (!t || typeof t != "object") {
        throw e.util.createDOMException("DataError", "KeyPath was specified, but value was not an object");
      }
      if ((n = e.Key.getValue(t, this.keyPath)) === undefined) {
        if (this.autoIncrement) {
          return;
        }
        throw e.util.createDOMException("DataError", "Could not eval key from keyPath");
      }
    } else if (n === undefined) {
      if (this.autoIncrement) {
        return;
      }
      throw e.util.createDOMException("DataError", "The object store uses out-of-line keys and has no key generator and the key parameter was not provided. ", this);
    }
    e.Key.validate(n);
  };
  t.prototype.__deriveKey = function (t, n, r, i, o) {
    var a = this;
    function s(n) {
      t.executeSql("SELECT * FROM sqlite_sequence where name like ?", [a.name], function (e, t) {
        if (t.rows.length !== 1) {
          n(1);
        } else {
          n(t.rows.item(0).seq + 1);
        }
      }, function (t, n) {
        o(e.util.createDOMException("DataError", "Could not get the auto increment value for key", n));
      });
    }
    if (a.keyPath) {
      var l = e.Key.getValue(n, a.keyPath);
      if (l === undefined && a.autoIncrement) {
        s(function (t) {
          try {
            e.Key.setValue(n, a.keyPath, t);
            i(t);
          } catch (t) {
            o(e.util.createDOMException("DataError", "Could not assign a generated value to the keyPath", t));
          }
        });
      } else {
        i(l);
      }
    } else if (r === undefined && a.autoIncrement) {
      s(i);
    } else {
      i(r);
    }
  };
  t.prototype.__insertData = function (t, n, r, i, o, a) {
    try {
      var s = {};
      if (i !== undefined) {
        e.Key.validate(i);
        s.key = e.Key.encode(i);
      }
      for (var l = 0; l < this.indexNames.length; l++) {
        var u = this.__indexes[this.indexNames[l]];
        s[u.name] = e.Key.encode(e.Key.getValue(r, u.keyPath), u.multiEntry);
      }
      var c = ["INSERT INTO ", e.util.quote(this.name), "("];
      var d = [" VALUES ("];
      var f = [];
      for (var p in s) {
        c.push(e.util.quote(p) + ",");
        d.push("?,");
        f.push(s[p]);
      }
      c.push("value )");
      d.push("?)");
      f.push(n);
      var h = c.join(" ") + d.join(" ");
      if (e.DEBUG) {
        console.log("SQL for adding", h, f);
      }
      t.executeSql(h, f, function (t, n) {
        e.Sca.encode(i, function (t) {
          t = e.Sca.decode(t);
          o(t);
        });
      }, function (t, n) {
        a(e.util.createDOMError("ConstraintError", n.message, n));
      });
    } catch (e) {
      a(e);
    }
  };
  t.prototype.add = function (t, n) {
    var r = this;
    if (arguments.length === 0) {
      throw new TypeError("No value was specified");
    }
    this.__validateKey(t, n);
    r.transaction.__assertWritable();
    var i = r.transaction.__createRequest();
    r.transaction.__pushToQueue(i, function (i, o, a, s) {
      r.__deriveKey(i, t, n, function (n) {
        e.Sca.encode(t, function (e) {
          r.__insertData(i, e, t, n, a, s);
        });
      }, s);
    });
    return i;
  };
  t.prototype.put = function (t, n) {
    var r = this;
    if (arguments.length === 0) {
      throw new TypeError("No value was specified");
    }
    this.__validateKey(t, n);
    r.transaction.__assertWritable();
    var i = r.transaction.__createRequest();
    r.transaction.__pushToQueue(i, function (i, o, a, s) {
      r.__deriveKey(i, t, n, function (n) {
        e.Sca.encode(t, function (o) {
          e.Key.validate(n);
          var l = "DELETE FROM " + e.util.quote(r.name) + " where key = ?";
          i.executeSql(l, [e.Key.encode(n)], function (i, l) {
            if (e.DEBUG) {
              console.log("Did the row with the", n, "exist? ", l.rowsAffected);
            }
            r.__insertData(i, o, t, n, a, s);
          }, function (e, t) {
            s(t);
          });
        });
      }, s);
    });
    return i;
  };
  t.prototype.get = function (t) {
    var n = this;
    if (arguments.length === 0) {
      throw new TypeError("No key was specified");
    }
    e.Key.validate(t);
    var r = e.Key.encode(t);
    return n.transaction.__addToTransactionQueue(function (t, i, o, a) {
      if (e.DEBUG) {
        console.log("Fetching", n.name, r);
      }
      t.executeSql("SELECT * FROM " + e.util.quote(n.name) + " where key = ?", [r], function (t, n) {
        var r;
        if (e.DEBUG) {
          console.log("Fetched data", n);
        }
        try {
          if (n.rows.length === 0) {
            return o();
          }
          r = e.Sca.decode(n.rows.item(0).value);
        } catch (t) {
          if (e.DEBUG) {
            console.log(t);
          }
        }
        o(r);
      }, function (e, t) {
        a(t);
      });
    });
  };
  t.prototype.delete = function (t) {
    var n = this;
    if (arguments.length === 0) {
      throw new TypeError("No key was specified");
    }
    n.transaction.__assertWritable();
    e.Key.validate(t);
    var r = e.Key.encode(t);
    return n.transaction.__addToTransactionQueue(function (t, i, o, a) {
      if (e.DEBUG) {
        console.log("Fetching", n.name, r);
      }
      t.executeSql("DELETE FROM " + e.util.quote(n.name) + " where key = ?", [r], function (t, n) {
        if (e.DEBUG) {
          console.log("Deleted from database", n.rowsAffected);
        }
        o();
      }, function (e, t) {
        a(t);
      });
    });
  };
  t.prototype.clear = function () {
    var t = this;
    t.transaction.__assertWritable();
    return t.transaction.__addToTransactionQueue(function (n, r, i, o) {
      n.executeSql("DELETE FROM " + e.util.quote(t.name), [], function (t, n) {
        if (e.DEBUG) {
          console.log("Cleared all records from database", n.rowsAffected);
        }
        i();
      }, function (e, t) {
        o(t);
      });
    });
  };
  t.prototype.count = function (t) {
    if (t instanceof e.IDBKeyRange) {
      return new e.IDBCursor(t, "next", this, this, "key", "value", true).__req;
    }
    var n = this;
    var r = false;
    if (t !== undefined) {
      r = true;
      e.Key.validate(t);
    }
    return n.transaction.__addToTransactionQueue(function (i, o, a, s) {
      var l = "SELECT * FROM " + e.util.quote(n.name) + (r ? " WHERE key = ?" : "");
      var u = [];
      if (r) {
        u.push(e.Key.encode(t));
      }
      i.executeSql(l, u, function (e, t) {
        a(t.rows.length);
      }, function (e, t) {
        s(t);
      });
    });
  };
  t.prototype.openCursor = function (t, n) {
    return new e.IDBCursor(t, n, this, this, "key", "value").__req;
  };
  t.prototype.index = function (t) {
    if (arguments.length === 0) {
      throw new TypeError("No index name was specified");
    }
    var n = this.__indexes[t];
    if (!n) {
      throw e.util.createDOMException("NotFoundError", "Index \"" + t + "\" does not exist on " + this.name);
    }
    return e.IDBIndex.__clone(n, this);
  };
  t.prototype.createIndex = function (t, n, r) {
    if (arguments.length === 0) {
      throw new TypeError("No index name was specified");
    }
    if (arguments.length === 1) {
      throw new TypeError("No key path was specified");
    }
    if (n instanceof Array && r && r.multiEntry) {
      throw e.util.createDOMException("InvalidAccessError", "The keyPath argument was an array and the multiEntry option is true.");
    }
    if (this.__indexes[t] && !this.__indexes[t].__deleted) {
      throw e.util.createDOMException("ConstraintError", "Index \"" + t + "\" already exists on " + this.name);
    }
    this.transaction.__assertVersionChange();
    var i = {
      columnName: t,
      keyPath: n,
      optionalParams: {
        unique: !!(r = r || {}).unique,
        multiEntry: !!r.multiEntry
      }
    };
    var o = new e.IDBIndex(this, i);
    e.IDBIndex.__createIndex(this, o);
    return o;
  };
  t.prototype.deleteIndex = function (t) {
    if (arguments.length === 0) {
      throw new TypeError("No index name was specified");
    }
    var n = this.__indexes[t];
    if (!n) {
      throw e.util.createDOMException("NotFoundError", "Index \"" + t + "\" does not exist on " + this.name);
    }
    this.transaction.__assertVersionChange();
    e.IDBIndex.__deleteIndex(this, n);
  };
  e.IDBObjectStore = t;
})(idbModules);
(function (e) {
  "use strict";

  var t = 0;
  function n(e, n, r) {
    this.__id = ++t;
    this.__active = true;
    this.__running = false;
    this.__errored = false;
    this.__requests = [];
    this.__storeNames = n;
    this.mode = r;
    this.db = e;
    this.error = null;
    this.onabort = this.onerror = this.oncomplete = null;
    var i = this;
    setTimeout(function () {
      i.__executeRequests();
    }, 0);
  }
  n.prototype.__executeRequests = function () {
    if (this.__running) {
      if (e.DEBUG) {
        console.log("Looks like the request set is already running", this.mode);
      }
    } else {
      this.__running = true;
      var t = this;
      t.db.__db.transaction(function (r) {
        t.__tx = r;
        var i = null;
        var o = 0;
        function a(t, n) {
          if (n) {
            i.req = n;
          }
          i.req.readyState = "done";
          i.req.result = t;
          delete i.req.error;
          var r = e.util.createEvent("success");
          e.util.callback("onsuccess", i.req, r);
          o++;
          l();
        }
        function s(t, r) {
          r = e.util.findError(arguments);
          try {
            i.req.readyState = "done";
            i.req.error = r || "DOMError";
            i.req.result = undefined;
            var o = e.util.createEvent("error", r);
            e.util.callback("onerror", i.req, o);
          } finally {
            n(r);
          }
        }
        function l() {
          if (o >= t.__requests.length) {
            t.__requests = [];
            if (t.__active) {
              t.__active = false;
              (function () {
                if (e.DEBUG) {
                  console.log("Transaction completed");
                }
                var n = e.util.createEvent("complete");
                try {
                  e.util.callback("oncomplete", t, n);
                  e.util.callback("__oncomplete", t, n);
                } catch (e) {
                  t.__errored = true;
                  throw e;
                }
              })();
            }
          } else {
            try {
              (i = t.__requests[o]).op(r, i.args, a, s);
            } catch (e) {
              s(e);
            }
          }
        }
        l();
      }, function (e) {
        n(e);
      });
    }
    function n(n) {
      e.util.logError("Error", "An error occurred in a transaction", n);
      if (!t.__errored) {
        t.__errored = true;
        if (!t.__active) {
          throw n;
        }
        try {
          t.error = n;
          var r = e.util.createEvent("error");
          e.util.callback("onerror", t, r);
          e.util.callback("onerror", t.db, r);
        } finally {
          t.abort();
        }
      }
    }
  };
  n.prototype.__createRequest = function () {
    var t = new e.IDBRequest();
    t.source = this.db;
    t.transaction = this;
    return t;
  };
  n.prototype.__addToTransactionQueue = function (e, t) {
    var n = this.__createRequest();
    this.__pushToQueue(n, e, t);
    return n;
  };
  n.prototype.__pushToQueue = function (e, t, n) {
    this.__assertActive();
    this.__requests.push({
      op: t,
      args: n,
      req: e
    });
  };
  n.prototype.__assertActive = function () {
    if (!this.__active) {
      throw e.util.createDOMException("TransactionInactiveError", "A request was placed against a transaction which is currently not active, or which is finished");
    }
  };
  n.prototype.__assertWritable = function () {
    if (this.mode === n.READ_ONLY) {
      throw e.util.createDOMException("ReadOnlyError", "The transaction is read only");
    }
  };
  n.prototype.__assertVersionChange = function () {
    n.__assertVersionChange(this);
  };
  n.__assertVersionChange = function (t) {
    if (!t || t.mode !== n.VERSION_CHANGE) {
      throw e.util.createDOMException("InvalidStateError", "Not a version transaction");
    }
  };
  n.prototype.objectStore = function (t) {
    if (arguments.length === 0) {
      throw new TypeError("No object store name was specified");
    }
    if (!this.__active) {
      throw e.util.createDOMException("InvalidStateError", "A request was placed against a transaction which is currently not active, or which is finished");
    }
    if (this.__storeNames.indexOf(t) === -1 && this.mode !== n.VERSION_CHANGE) {
      throw e.util.createDOMException("NotFoundError", t + " is not participating in this transaction");
    }
    var r = this.db.__objectStores[t];
    if (!r) {
      throw e.util.createDOMException("NotFoundError", t + " does not exist in " + this.db.name);
    }
    return e.IDBObjectStore.__clone(r, this);
  };
  n.prototype.abort = function () {
    var t = this;
    if (e.DEBUG) {
      console.log("The transaction was aborted", t);
    }
    t.__active = false;
    var n = e.util.createEvent("abort");
    setTimeout(function () {
      e.util.callback("onabort", t, n);
    }, 0);
  };
  n.READ_ONLY = "readonly";
  n.READ_WRITE = "readwrite";
  n.VERSION_CHANGE = "versionchange";
  e.IDBTransaction = n;
})(idbModules);
(function (e) {
  "use strict";

  function t(t, n, r, i) {
    this.__db = t;
    this.__closed = false;
    this.version = r;
    this.name = n;
    this.onabort = this.onerror = this.onversionchange = null;
    this.__objectStores = {};
    this.objectStoreNames = new e.util.StringList();
    for (var o = 0; o < i.rows.length; o++) {
      var a = new e.IDBObjectStore(i.rows.item(o));
      this.__objectStores[a.name] = a;
      this.objectStoreNames.push(a.name);
    }
  }
  t.prototype.createObjectStore = function (t, n) {
    if (arguments.length === 0) {
      throw new TypeError("No object store name was specified");
    }
    if (this.__objectStores[t]) {
      throw e.util.createDOMException("ConstraintError", "Object store \"" + t + "\" already exists in " + this.name);
    }
    this.__versionTransaction.__assertVersionChange();
    n = n || {};
    var r = {
      name: t,
      keyPath: JSON.stringify(n.keyPath || null),
      autoInc: JSON.stringify(n.autoIncrement),
      indexList: "{}"
    };
    var i = new e.IDBObjectStore(r, this.__versionTransaction);
    e.IDBObjectStore.__createObjectStore(this, i);
    return i;
  };
  t.prototype.deleteObjectStore = function (t) {
    if (arguments.length === 0) {
      throw new TypeError("No object store name was specified");
    }
    var n = this.__objectStores[t];
    if (!n) {
      throw e.util.createDOMException("NotFoundError", "Object store \"" + t + "\" does not exist in " + this.name);
    }
    this.__versionTransaction.__assertVersionChange();
    e.IDBObjectStore.__deleteObjectStore(this, n);
  };
  t.prototype.close = function () {
    this.__closed = true;
  };
  t.prototype.transaction = function (t, n) {
    if (this.__closed) {
      throw e.util.createDOMException("InvalidStateError", "An attempt was made to start a new transaction on a database connection that is not open");
    }
    if (typeof n == "number") {
      n = n === 1 ? IDBTransaction.READ_WRITE : IDBTransaction.READ_ONLY;
      if (e.DEBUG) {
        console.log("Mode should be a string, but was specified as ", n);
      }
    } else {
      n = n || IDBTransaction.READ_ONLY;
    }
    if (n !== IDBTransaction.READ_ONLY && n !== IDBTransaction.READ_WRITE) {
      throw new TypeError("Invalid transaction mode: " + n);
    }
    if ((t = typeof t == "string" ? [t] : t).length === 0) {
      throw e.util.createDOMException("InvalidAccessError", "No object store names were specified");
    }
    for (var r = 0; r < t.length; r++) {
      if (!this.objectStoreNames.contains(t[r])) {
        throw e.util.createDOMException("NotFoundError", "The \"" + t[r] + "\" object store does not exist");
      }
    }
    return new e.IDBTransaction(this, t, n);
  };
  e.IDBDatabase = t;
})(idbModules);
(function (e) {
  "use strict";

  var t;
  var n = 4194304;
  function r(r, i) {
    function o(t, n) {
      n = e.util.findError(arguments);
      if (e.DEBUG) {
        console.log("Error in sysdb transaction - when creating dbVersions", n);
      }
      i(n);
    }
    if (t) {
      r();
    } else {
      (t = window.openDatabase("__sysdb__", 1, "System Database", n)).transaction(function (e) {
        e.executeSql("CREATE TABLE IF NOT EXISTS dbVersions (name VARCHAR(255), version INT);", [], r, o);
      }, o);
    }
  }
  function i() {
    this.modules = e;
  }
  i.prototype.open = function (i, o) {
    var a = new e.IDBOpenDBRequest();
    var s = false;
    if (arguments.length === 0) {
      throw new TypeError("Database name is required");
    }
    if (arguments.length === 2 && (o = parseFloat(o), isNaN(o) || !isFinite(o) || o <= 0)) {
      throw new TypeError("Invalid database version: " + o);
    }
    function l(t, n) {
      if (!s) {
        n = e.util.findError(arguments);
        s = true;
        var r = e.util.createEvent("error", arguments);
        a.readyState = "done";
        a.error = n || "DOMError";
        e.util.callback("onerror", a, r);
      }
    }
    function u(r) {
      var s = window.openDatabase(i, 1, i, n);
      a.readyState = "done";
      if (o === undefined) {
        o = r || 1;
      }
      if (o <= 0 || r > o) {
        l(e.util.createDOMError("VersionError", "An attempt was made to open a database using a lower version than the existing version.", o));
      } else {
        s.transaction(function (n) {
          n.executeSql("CREATE TABLE IF NOT EXISTS __sys__ (name VARCHAR(255), keyPath VARCHAR(255), autoInc BOOLEAN, indexList BLOB)", [], function () {
            n.executeSql("SELECT * FROM __sys__", [], function (n, u) {
              var c = e.util.createEvent("success");
              a.source = a.result = new e.IDBDatabase(s, i, o, u);
              if (r < o) {
                t.transaction(function (t) {
                  t.executeSql("UPDATE dbVersions set version = ? where name = ?", [o, i], function () {
                    var t = e.util.createEvent("upgradeneeded");
                    t.oldVersion = r;
                    t.newVersion = o;
                    a.transaction = a.result.__versionTransaction = new e.IDBTransaction(a.source, [], e.IDBTransaction.VERSION_CHANGE);
                    a.transaction.__addToTransactionQueue(function (n, r, i) {
                      e.util.callback("onupgradeneeded", a, t);
                      i();
                    });
                    a.transaction.__oncomplete = function () {
                      a.transaction = null;
                      var t = e.util.createEvent("success");
                      e.util.callback("onsuccess", a, t);
                    };
                  }, l);
                }, l);
              } else {
                e.util.callback("onsuccess", a, c);
              }
            }, l);
          }, l);
        }, l);
      }
    }
    i += "";
    r(function () {
      t.transaction(function (e) {
        e.executeSql("SELECT * FROM dbVersions where name = ?", [i], function (e, t) {
          if (t.rows.length === 0) {
            e.executeSql("INSERT INTO dbVersions VALUES (?,?)", [i, o || 1], function () {
              u(0);
            }, l);
          } else {
            u(t.rows.item(0).version);
          }
        }, l);
      }, l);
    }, l);
    return a;
  };
  i.prototype.deleteDatabase = function (i) {
    var o = new e.IDBOpenDBRequest();
    var a = false;
    var s = null;
    if (arguments.length === 0) {
      throw new TypeError("Database name is required");
    }
    function l(t, n) {
      if (!a) {
        n = e.util.findError(arguments);
        o.readyState = "done";
        o.error = n || "DOMError";
        var r = e.util.createEvent("error");
        r.debug = arguments;
        e.util.callback("onerror", o, r);
        a = true;
      }
    }
    function u() {
      t.transaction(function (t) {
        t.executeSql("DELETE FROM dbVersions where name = ? ", [i], function () {
          o.result = undefined;
          var t = e.util.createEvent("success");
          t.newVersion = null;
          t.oldVersion = s;
          e.util.callback("onsuccess", o, t);
        }, l);
      }, l);
    }
    i += "";
    r(function () {
      t.transaction(function (t) {
        t.executeSql("SELECT * FROM dbVersions where name = ?", [i], function (t, r) {
          if (r.rows.length === 0) {
            o.result = undefined;
            var a = e.util.createEvent("success");
            a.newVersion = null;
            a.oldVersion = s;
            e.util.callback("onsuccess", o, a);
            return;
          }
          s = r.rows.item(0).version;
          window.openDatabase(i, 1, i, n).transaction(function (t) {
            t.executeSql("SELECT * FROM __sys__", [], function (t, n) {
              var r = n.rows;
              (function n(i) {
                if (i >= r.length) {
                  t.executeSql("DROP TABLE IF EXISTS __sys__", [], function () {
                    u();
                  }, l);
                } else {
                  t.executeSql("DROP TABLE " + e.util.quote(r.item(i).name), [], function () {
                    n(i + 1);
                  }, function () {
                    n(i + 1);
                  });
                }
              })(0);
            }, function (e) {
              u();
            });
          });
        }, l);
      }, l);
    }, l);
    return o;
  };
  i.prototype.cmp = function (t, n) {
    if (arguments.length < 2) {
      throw new TypeError("You must provide two keys to be compared");
    }
    e.Key.validate(t);
    e.Key.validate(n);
    var r = e.Key.encode(t);
    var i = e.Key.encode(n);
    var o = r > i ? 1 : r === i ? 0 : -1;
    if (e.DEBUG) {
      var a = e.Key.decode(r);
      var s = e.Key.decode(i);
      if (typeof t == "object") {
        t = JSON.stringify(t);
        a = JSON.stringify(a);
      }
      if (typeof n == "object") {
        n = JSON.stringify(n);
        s = JSON.stringify(s);
      }
      if (a !== t) {
        console.warn(t + " was incorrectly encoded as " + a);
      }
      if (s !== n) {
        console.warn(n + " was incorrectly encoded as " + s);
      }
    }
    return o;
  };
  e.shimIndexedDB = new i();
  e.IDBFactory = i;
})(idbModules);
(function (e, t) {
  "use strict";

  function n(t, n) {
    try {
      e[t] = n;
    } catch (e) {}
    if (e[t] !== n && Object.defineProperty) {
      try {
        Object.defineProperty(e, t, {
          value: n
        });
      } catch (e) {}
      if (e[t] !== n && e.console && console.warn) {
        console.warn("Unable to shim " + t);
      }
    }
  }
  n("shimIndexedDB", t.shimIndexedDB);
  if (e.shimIndexedDB) {
    e.shimIndexedDB.__useShim = function () {
      if (e.openDatabase !== undefined) {
        n("indexedDB", t.shimIndexedDB);
        n("IDBFactory", t.IDBFactory);
        n("IDBDatabase", t.IDBDatabase);
        n("IDBObjectStore", t.IDBObjectStore);
        n("IDBIndex", t.IDBIndex);
        n("IDBTransaction", t.IDBTransaction);
        n("IDBCursor", t.IDBCursor);
        n("IDBKeyRange", t.IDBKeyRange);
        n("IDBRequest", t.IDBRequest);
        n("IDBOpenDBRequest", t.IDBOpenDBRequest);
        n("IDBVersionChangeEvent", t.IDBVersionChangeEvent);
      } else if (typeof e.indexedDB == "object") {
        t.polyfill();
      }
    };
    e.shimIndexedDB.__debug = function (e) {
      t.DEBUG = e;
    };
  }
  if (!("indexedDB" in e)) {
    e.indexedDB = e.indexedDB || e.webkitIndexedDB || e.mozIndexedDB || e.oIndexedDB || e.msIndexedDB;
  }
  var r = false;
  if (navigator.userAgent.match(/Android 2/) || navigator.userAgent.match(/Android 3/) || navigator.userAgent.match(/Android 4\.[0-3]/)) {
    if (!navigator.userAgent.match(/Chrome/)) {
      r = true;
    }
  }
  if (e.indexedDB !== undefined && e.indexedDB && !r || e.openDatabase === undefined) {
    e.IDBDatabase = e.IDBDatabase || e.webkitIDBDatabase;
    e.IDBTransaction = e.IDBTransaction || e.webkitIDBTransaction;
    e.IDBCursor = e.IDBCursor || e.webkitIDBCursor;
    e.IDBKeyRange = e.IDBKeyRange || e.webkitIDBKeyRange;
    e.IDBTransaction ||= {};
    try {
      e.IDBTransaction.READ_ONLY = e.IDBTransaction.READ_ONLY || "readonly";
      e.IDBTransaction.READ_WRITE = e.IDBTransaction.READ_WRITE || "readwrite";
    } catch (e) {}
  } else {
    e.shimIndexedDB.__useShim();
  }
})(window, idbModules);