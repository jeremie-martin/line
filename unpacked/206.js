Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SpriteSheet = exports.PADDING = undefined;
exports.getMappingProps = function (e, t) {
  let n = e.coords;
  let r = e.opacity && h(e.opacity, t)[0];
  if (r === 0) {
    return {
      coords: n,
      hidden: true
    };
  }
  let i = null;
  for (let o = 0; o < e.transforms.length; o++) {
    let r = e.transforms[o];
    let a = h(r, t);
    if (r.type === "scale" && (a[0] === 0 || a[1] === 0)) {
      return {
        coords: n,
        hidden: true
      };
    }
    if (o === 0) {
      i = l[r.type](a);
    } else {
      s[r.type](i, a);
    }
  }
  return {
    coords: n,
    opacity: r,
    transform: i
  };
};
exports.getSpriteSheetMappings = m;
exports.getCameraMappings = y;
var r = function (e) {
  if (e && e.__esModule) {
    return e;
  }
  var t = {};
  if (e != null) {
    for (var n in e) {
      if (Object.prototype.hasOwnProperty.call(e, n)) {
        t[n] = e[n];
      }
    }
  }
  t.default = e;
  return t;
}(require("./544.js"));
exports.PADDING = 1;
const i = ["FLAG", "START_FLAG", "PEG", "TAIL", "NOSE", "STRING", "BUTT", "SHOULDER", "RHAND", "LHAND", "LFOOT", "RFOOT", "SCARF_0", "SCARF_1", "SCARF_2", "SCARF_3", "SCARF_4", "SCARF_5", "SCARF_6"];
const o = ["rotation", "blinking", "broken", "crashed"];
const a = ["opacity", "translate", "scale", "rotate"];
const s = {
  translate: (e, t) => r.translate(e, e, t),
  scale: (e, t) => r.scale(e, e, t),
  rotate: (e, [t, n, i]) => {
    r.translate(e, e, [n, i]);
    r.rotate(e, e, t / 180 * Math.PI);
    r.translate(e, e, [-n, -i]);
  }
};
const l = {
  translate: e => r.fromTranslation([], e),
  scale: e => r.fromScaling([], e),
  rotate: ([e, t, n]) => {
    let i = r.fromTranslation([], [t, n]);
    r.rotate(i, i, e / 180 * Math.PI);
    r.translate(i, i, [-t, -n]);
    return i;
  }
};
const u = (e, t) => {
  if (e.classList) {
    return e.classList.contains(t);
  }
  let n = e.getAttribute("class");
  return n && n.includes(t);
};
const c = (e, t) => {
  let n = e.getAttributeNS("https://www.linerider.com", t);
  if (n === "") {
    return null;
  } else {
    return n;
  }
};
function d(e, t) {
  if (!i.includes(e) && (!t || e !== null)) {
    throw new Error(`unknown point: ${e}`);
  }
}
function f(e, t) {
  let n = c(e, "anchor");
  let r = c(e, "lookAt");
  let i = c(e, "cam");
  d(n);
  d(r, true);
  let o = {
    anchor: n,
    lookAt: r,
    cam: i
  };
  let a = c(e, "copy");
  if (a) {
    let e = f(t.getElementById(a), t);
    return Object.assign({}, e, o);
  }
  let s = e.querySelector("animate");
  let l = e.querySelectorAll("animateTransform");
  return Object.assign({}, o, {
    stretch: u(e, "lr-stretch"),
    coords: function (e) {
      let t = e.querySelector(".lr-anchor");
      let n = e.querySelector(".lr-bbox");
      return {
        anchor: {
          x: parseFloat(t.getAttribute("x")),
          y: parseFloat(t.getAttribute("y"))
        },
        bbox: {
          x: parseInt(n.getAttribute("x")),
          y: parseInt(n.getAttribute("y")),
          width: parseInt(n.getAttribute("width")),
          height: parseInt(n.getAttribute("height"))
        }
      };
    }(e),
    transforms: [...l].map(p),
    opacity: s && p(s)
  });
}
function p(e) {
  let t = c(e, "param");
  if (!o.includes(t)) {
    throw new Error(`unknown param: ${t}`);
  }
  let n = e.getAttribute("values").split(";");
  let r = e.getAttribute("keyTimes").split(";");
  return {
    param: t,
    type: function (e) {
      let t = e.getAttribute("attributeName");
      switch (t) {
        case "opacity":
          return "opacity";
        case "transform":
          let n = e.getAttribute("type");
          if (!a.includes(n)) {
            throw new Error(`unsupported transform type: ${n}`);
          }
          return n;
        default:
          throw new Error(`unsupported animated attribute: ${t}`);
      }
    }(e),
    keyframes: n.map((e, t) => {
      let n = e.trim().split(/\s/).map(e => parseFloat(e));
      return {
        time: parseFloat(r[t].trim()),
        args: n
      };
    })
  };
}
function h({
  param: e,
  keyframes: t
}, n) {
  let r = n[e];
  switch (r) {
    case 0:
      return t[0].args;
    case 1:
      return t[t.length - 1].args;
  }
  let i = t.findIndex(e => e.time > r);
  let o = t[i - 1];
  let a = t[i];
  let s = (r - o.time) / (a.time - o.time);
  return o.args.map((e, t) => (1 - s) * e + s * a.args[t]);
}
function m(e) {
  let t = {};
  for (let n of e.querySelectorAll(".lr-entity")) {
    let r = c(n, "entity");
    let i = [...n.querySelectorAll(".lr-sprite")];
    i = i.map(t => f(t, e));
    t[r] = i;
  }
  return t;
}
function y(e) {
  let t = {};
  for (let n in e) {
    let r = e[n];
    for (let e of r) {
      if (e.cam) {
        if (!(e.cam in t)) {
          t[e.cam] = [];
        }
        t[e.cam].push(e);
      }
    }
  }
  return t;
}
exports.SpriteSheet = class {
  constructor(e, t, n) {
    this.id = e;
    this.image = n;
    this.mappings = m(t);
    this.cameraMappings = y(this.mappings);
    this.width = n.width;
    this.height = n.height;
  }
  toJSON() {
    return this.id;
  }
};