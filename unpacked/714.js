Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.dark = exports.light = undefined;
var r = f(require("./3.js"));
var i = f(require("./4.js"));
exports.default = function (e) {
  var t = e.primary;
  var n = t === undefined ? {
    light: a.default[300],
    main: a.default[500],
    dark: a.default[700]
  } : t;
  var f = e.secondary;
  var y = f === undefined ? {
    light: s.default.A200,
    main: s.default.A400,
    dark: s.default.A700
  } : f;
  var g = e.error;
  var v = g === undefined ? {
    light: u.default[300],
    main: u.default[500],
    dark: u.default[700]
  } : g;
  var b = e.type;
  var _ = b === undefined ? "light" : b;
  var w = e.contrastThreshold;
  var x = w === undefined ? 3 : w;
  var E = e.tonalOffset;
  var S = E === undefined ? 0.2 : E;
  var T = (0, i.default)(e, ["primary", "secondary", "error", "type", "contrastThreshold", "tonalOffset"]);
  function k(e) {
    var t = (0, d.getContrastRatio)(e, h.text.primary) >= x ? h.text.primary : p.text.primary;
    return t;
  }
  function O(e, t, n, r) {
    if (!e.main && e[t]) {
      e.main = e[t];
    }
    m(e, "light", n, S);
    m(e, "dark", r, S);
    e.contrastText ||= k(e.main);
  }
  O(n, 500, 300, 700);
  O(y, "A400", "A200", "A700");
  O(v, 500, 300, 700);
  var P = {
    dark: h,
    light: p
  };
  return (0, o.default)((0, r.default)({
    common: c.default,
    type: _,
    primary: n,
    secondary: y,
    error: v,
    grey: l.default,
    contrastThreshold: x,
    getContrastText: k,
    tonalOffset: S
  }, P[_]), T, {
    clone: false
  });
};
f(require("./14.js"));
var o = f(require("./162.js"));
var a = f(require("./352.js"));
var s = f(require("./353.js"));
var l = f(require("./354.js"));
var u = f(require("./355.js"));
var c = f(require("./236.js"));
var d = require("./73.js");
function f(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
var p = exports.light = {
  text: {
    primary: "rgba(0, 0, 0, 0.87)",
    secondary: "rgba(0, 0, 0, 0.54)",
    disabled: "rgba(0, 0, 0, 0.38)",
    hint: "rgba(0, 0, 0, 0.38)"
  },
  divider: "rgba(0, 0, 0, 0.12)",
  background: {
    paper: c.default.white,
    default: l.default[50]
  },
  action: {
    active: "rgba(0, 0, 0, 0.54)",
    hover: "rgba(0, 0, 0, 0.14)",
    selected: "rgba(0, 0, 0, 0.08)",
    disabled: "rgba(0, 0, 0, 0.26)",
    disabledBackground: "rgba(0, 0, 0, 0.12)"
  }
};
var h = exports.dark = {
  text: {
    primary: c.default.white,
    secondary: "rgba(255, 255, 255, 0.7)",
    disabled: "rgba(255, 255, 255, 0.5)",
    hint: "rgba(255, 255, 255, 0.5)",
    icon: "rgba(255, 255, 255, 0.5)"
  },
  divider: "rgba(255, 255, 255, 0.12)",
  background: {
    paper: l.default[800],
    default: "#303030"
  },
  action: {
    active: c.default.white,
    hover: "rgba(255, 255, 255, 0.2)",
    selected: "rgba(255, 255, 255, 0.1)",
    disabled: "rgba(255, 255, 255, 0.3)",
    disabledBackground: "rgba(255, 255, 255, 0.12)"
  }
};
function m(e, t, n, r) {
  if (!e[t]) {
    if (e.hasOwnProperty(n)) {
      e[t] = e[n];
    } else if (t === "light") {
      e.light = (0, d.lighten)(e.main, r);
    } else if (t === "dark") {
      e.dark = (0, d.darken)(e.main, r * 1.5);
    }
  }
}