Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var i = s(require("./0.js"));
var o = s(require("./128.js"));
var a = require("./43.js");
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.default = class extends i.default.PureComponent {
  constructor(e) {
    super(e);
    const t = i.default.Children.toArray(e.children);
    const n = document.createElementNS("http://www.w3.org/2000/svg", "path");
    let r = 0;
    let o = 0;
    this.childElements = [];
    this.styleText = "";
    for (let a of t) {
      n.setAttribute("d", a.props.d);
      const t = n.getTotalLength() + 1;
      const s = t * e.rate;
      const l = `${this.props.uniqueId}-class-${o}`;
      const u = `${this.props.uniqueId}-anim-${o}`;
      const c = [`keyframes ${u} { from { stroke-dashoffset: ${t}; } to { stroke-dashoffset: 0; } }`, `animation: ${u} ${s}ms cubic-bezier(0.47, 0, 0.745, 0.715) forwards;`, `animation-delay: ${r}ms;`];
      this.styleText += `\n      @-webkit-${c[0]}\n      @${c[0]}\n      .${l} {\n        -webkit-${c[1]}\n        -webkit-${c[2]}\n        ${c[1]}\n        ${c[2]}\n        stroke-dasharray: ${t};\n        stroke-dashoffset: ${t};\n      }`;
      this.childElements.push(i.default.createElement(a.type, Object.assign({}, a.props, {
        key: o,
        className: l
      })));
      r += s + 33.4;
      ++o;
    }
  }
  render() {
    var e = this.props;
    const t = e.viewBox;
    e.children;
    e.uniqueId;
    const n = e.in;
    const s = e.onExited;
    const l = function (e, t) {
      var n = {};
      for (var r in e) {
        if (!(t.indexOf(r) >= 0)) {
          if (Object.prototype.hasOwnProperty.call(e, r)) {
            n[r] = e[r];
          }
        }
      }
      return n;
    }(e, ["viewBox", "children", "uniqueId", "in", "onExited"]);
    return i.default.createElement(o.default, {
      in: n,
      onExited: s,
      timeout: {
        enter: 0,
        exit: a.duration.standard
      }
    }, i.default.createElement("svg", r({
      viewBox: t
    }, l), i.default.createElement("style", null, this.styleText), this.childElements));
  }
};
module.exports = exports.default;