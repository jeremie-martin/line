Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = o(require("./4.js"));
exports.default = function (e, t) {
  var n = typeof t == "function" ? t(e) : t;
  var o = n.fontFamily;
  var s = o === undefined ? "\"Roboto\", \"Helvetica\", \"Arial\", sans-serif" : o;
  var l = n.fontSize;
  var u = l === undefined ? 14 : l;
  var c = n.fontWeightLight;
  var d = c === undefined ? 300 : c;
  var f = n.fontWeightRegular;
  var p = f === undefined ? 400 : f;
  var h = n.fontWeightMedium;
  var m = h === undefined ? 500 : h;
  var y = n.htmlFontSize;
  var g = y === undefined ? 16 : y;
  var v = (0, r.default)(n, ["fontFamily", "fontSize", "fontWeightLight", "fontWeightRegular", "fontWeightMedium", "htmlFontSize"]);
  function b(e) {
    return e / g + "rem";
  }
  return (0, i.default)({
    pxToRem: b,
    round: a,
    fontFamily: s,
    fontSize: u,
    fontWeightLight: d,
    fontWeightRegular: p,
    fontWeightMedium: m,
    display4: {
      fontSize: b(112),
      fontWeight: d,
      fontFamily: s,
      letterSpacing: "-.04em",
      lineHeight: a(128 / 112) + "em",
      marginLeft: "-.06em",
      color: e.text.secondary
    },
    display3: {
      fontSize: b(56),
      fontWeight: p,
      fontFamily: s,
      letterSpacing: "-.02em",
      lineHeight: a(73 / 56) + "em",
      marginLeft: "-.04em",
      color: e.text.secondary
    },
    display2: {
      fontSize: b(45),
      fontWeight: p,
      fontFamily: s,
      lineHeight: a(48 / 45) + "em",
      marginLeft: "-.04em",
      color: e.text.secondary
    },
    display1: {
      fontSize: b(34),
      fontWeight: p,
      fontFamily: s,
      lineHeight: a(41 / 34) + "em",
      marginLeft: "-.04em",
      color: e.text.secondary
    },
    headline: {
      fontSize: b(24),
      fontWeight: p,
      fontFamily: s,
      lineHeight: a(32.5 / 24) + "em",
      color: e.text.primary
    },
    title: {
      fontSize: b(21),
      fontWeight: m,
      fontFamily: s,
      lineHeight: a(24.5 / 21) + "em",
      color: e.text.primary
    },
    subheading: {
      fontSize: b(16),
      fontWeight: p,
      fontFamily: s,
      lineHeight: a(1.5) + "em",
      color: e.text.primary
    },
    body2: {
      fontSize: b(14),
      fontWeight: m,
      fontFamily: s,
      lineHeight: a(24 / 14) + "em",
      color: e.text.primary
    },
    body1: {
      fontSize: b(14),
      fontWeight: p,
      fontFamily: s,
      lineHeight: a(20.5 / 14) + "em",
      color: e.text.primary
    },
    caption: {
      fontSize: b(12),
      fontWeight: p,
      fontFamily: s,
      lineHeight: a(1.375) + "em",
      color: e.text.secondary
    },
    button: {
      fontSize: b(u),
      textTransform: "uppercase",
      fontWeight: m,
      fontFamily: s
    }
  }, v, {
    clone: false
  });
};
var i = o(require("./162.js"));
function o(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
function a(e) {
  return Math.round(e * 100000) / 100000;
}