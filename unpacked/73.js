Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.convertHexToRGB = a;
exports.decomposeColor = s;
exports.recomposeColor = l;
exports.getContrastRatio = function (e, t) {
  var n = u(e);
  var r = u(t);
  return (Math.max(n, r) + 0.05) / (Math.min(n, r) + 0.05);
};
exports.getLuminance = u;
exports.emphasize = function (e, t = 0.15) {
  if (u(e) > 0.5) {
    return c(e, t);
  } else {
    return d(e, t);
  }
};
exports.fade = function (e, t) {
  if (!e) {
    return e;
  }
  e = s(e);
  t = o(t);
  if (e.type === "rgb" || e.type === "hsl") {
    e.type += "a";
  }
  e.values[3] = t;
  return l(e);
};
exports.darken = c;
exports.lighten = d;
var r;
var i = require("./14.js");
if (r = i) {
  r.__esModule;
}
function o(e, t = 0, n = 1) {
  if (e < t) {
    return t;
  } else if (e > n) {
    return n;
  } else {
    return e;
  }
}
function a(e) {
  e = e.substr(1);
  var t = new RegExp(".{1," + e.length / 3 + "}", "g");
  var n = e.match(t);
  if (n && n[0].length === 1) {
    n = n.map(function (e) {
      return e + e;
    });
  }
  if (n) {
    return "rgb(" + n.map(function (e) {
      return parseInt(e, 16);
    }).join(", ") + ")";
  } else {
    return "";
  }
}
function s(e) {
  if (e.charAt(0) === "#") {
    return s(a(e));
  }
  var t = e.indexOf("(");
  var n = e.substring(0, t);
  var r = e.substring(t + 1, e.length - 1).split(",");
  return {
    type: n,
    values: r = r.map(function (e) {
      return parseFloat(e);
    })
  };
}
function l(e) {
  var t = e.type;
  var n = e.values;
  if (t.indexOf("rgb") > -1) {
    n = n.map(function (e, t) {
      if (t < 3) {
        return parseInt(e, 10);
      } else {
        return e;
      }
    });
  }
  if (t.indexOf("hsl") > -1) {
    n[1] = n[1] + "%";
    n[2] = n[2] + "%";
  }
  return e.type + "(" + n.join(", ") + ")";
}
function u(e) {
  var t = s(e);
  if (t.type.indexOf("rgb") > -1) {
    var n = t.values.map(function (e) {
      if ((e /= 255) <= 0.03928) {
        return e / 12.92;
      } else {
        return Math.pow((e + 0.055) / 1.055, 2.4);
      }
    });
    return Number((n[0] * 0.2126 + n[1] * 0.7152 + n[2] * 0.0722).toFixed(3));
  }
  if (t.type.indexOf("hsl") > -1) {
    return t.values[2] / 100;
  }
  throw new Error("Material-UI: unsupported `" + e + "` color.");
}
function c(e, t) {
  if (!e) {
    return e;
  }
  e = s(e);
  t = o(t);
  if (e.type.indexOf("hsl") > -1) {
    e.values[2] *= 1 - t;
  } else if (e.type.indexOf("rgb") > -1) {
    for (var n = 0; n < 3; n += 1) {
      e.values[n] *= 1 - t;
    }
  }
  return l(e);
}
function d(e, t) {
  if (!e) {
    return e;
  }
  e = s(e);
  t = o(t);
  if (e.type.indexOf("hsl") > -1) {
    e.values[2] += (100 - e.values[2]) * t;
  } else if (e.type.indexOf("rgb") > -1) {
    for (var n = 0; n < 3; n += 1) {
      e.values[n] += (255 - e.values[n]) * t;
    }
  }
  return l(e);
}