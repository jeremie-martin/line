var n;
var r;
var i = module.exports = {};
function o() {
  throw new Error("setTimeout has not been defined");
}
function a() {
  throw new Error("clearTimeout has not been defined");
}
function s(e) {
  if (n === setTimeout) {
    return setTimeout(e, 0);
  }
  if ((n === o || !n) && setTimeout) {
    n = setTimeout;
    return setTimeout(e, 0);
  }
  try {
    return n(e, 0);
  } catch (t) {
    try {
      return n.call(null, e, 0);
    } catch (t) {
      return n.call(this, e, 0);
    }
  }
}
(function () {
  try {
    n = typeof setTimeout == "function" ? setTimeout : o;
  } catch (e) {
    n = o;
  }
  try {
    r = typeof clearTimeout == "function" ? clearTimeout : a;
  } catch (e) {
    r = a;
  }
})();
var l;
var u = [];
var c = false;
var d = -1;
function f() {
  if (c && l) {
    c = false;
    if (l.length) {
      u = l.concat(u);
    } else {
      d = -1;
    }
    if (u.length) {
      p();
    }
  }
}
function p() {
  if (!c) {
    var e = s(f);
    c = true;
    for (var t = u.length; t;) {
      l = u;
      u = [];
      while (++d < t) {
        if (l) {
          l[d].run();
        }
      }
      d = -1;
      t = u.length;
    }
    l = null;
    c = false;
    (function (e) {
      if (r === clearTimeout) {
        return clearTimeout(e);
      }
      if ((r === a || !r) && clearTimeout) {
        r = clearTimeout;
        return clearTimeout(e);
      }
      try {
        r(e);
      } catch (t) {
        try {
          return r.call(null, e);
        } catch (t) {
          return r.call(this, e);
        }
      }
    })(e);
  }
}
function h(e, t) {
  this.fun = e;
  this.array = t;
}
function m() {}
i.nextTick = function (e) {
  var t = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var n = 1; n < arguments.length; n++) {
      t[n - 1] = arguments[n];
    }
  }
  u.push(new h(e, t));
  if (u.length === 1 && !c) {
    s(p);
  }
};
h.prototype.run = function () {
  this.fun.apply(null, this.array);
};
i.title = "browser";
i.browser = true;
i.env = {};
i.argv = [];
i.version = "";
i.versions = {};
i.on = m;
i.addListener = m;
i.once = m;
i.off = m;
i.removeListener = m;
i.removeAllListeners = m;
i.emit = m;
i.prependListener = m;
i.prependOnceListener = m;
i.listeners = function (e) {
  return [];
};
i.binding = function (e) {
  throw new Error("process.binding is not supported");
};
i.cwd = function () {
  return "/";
};
i.chdir = function (e) {
  throw new Error("process.chdir is not supported");
};
i.umask = function () {
  return 0;
};