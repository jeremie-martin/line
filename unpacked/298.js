Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.setCustomRiders = exports.loadSpriteSheets = undefined;
var r;
var i = require("./147.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./206.js");
var s = require("./103.js");
var l = require("./26.js");
async function u(e, t = null) {
  let n = await (0, l.fetchTextResource)(e);
  let r = new DOMParser().parseFromString(n, "image/svg+xml");
  if (t) {
    const e = r.getElementsByTagName("style")[0];
    e.textContent = e.textContent + t;
    n = new XMLSerializer().serializeToString(r);
  }
  let i = parseFloat(r.querySelector("svg").getAttribute("width"));
  let o = parseFloat(r.querySelector("svg").getAttribute("height"));
  let s = await function (e, t, n) {
    return new Promise(r => {
      let i = new window.Image();
      i.width = t;
      i.height = n;
      let o = new window.Blob([e], {
        type: "image/svg+xml"
      });
      let a = window.URL.createObjectURL(o);
      i.onload = () => {
        window.URL.revokeObjectURL(a);
        r(i);
      };
      i.src = a;
    });
  }(n, i, o);
  return new a.SpriteSheet(e, r, s);
}
exports.loadSpriteSheets = e => async function (t) {
  t((0, s.setSpriteSheets)(await Promise.all(e.map(u))));
};
const c = exports.setCustomRiders = async (e, t = window.store) => {
  const n = (0, o.default)("bosh-sprite.svg");
  const r = await Promise.all(e.map(e => u(n, e)));
  t.dispatch((0, s.setSpriteSheets)(r));
};
window.setCustomRiders = c;
Object.defineProperty(c, "help", {
  get() {
    console.log("Takes an array of CSS to customize the rider(s).\n\nExample:\n\nsetCustomRiders([\n  \".scarfOdd { fill: grey; }\",\n  \".scarfOdd { fill: red; } .scarfEven { fill: green; }\"]\n)\n\nsetCustomRiders(setCustomRiders.default)\n\nInitial CSS, to be overridden: setCustomRiders.initial\nDefault CSS overrides: setCustomRiders.default\nAvailable CSS classes: setCustomRiders.parts\n");
  }
});
Object.defineProperty(c, "parts", {
  get() {
    console.log("\n<!-- head parts -->\n<g id=\"head\">\n  <rect class=\"skin\"/>\n  <rect class=\"hair\"/>\n</g>\n<rect id=\"face-outline\" class=\"hair\"/>\n<rect id=\"hair\" class=\"fill\"/>\n<polygon id=\"eye\"/>\n<path id=\"nose\" class=\"outline skin\"/>\n\n<!-- sled parts -->\n<g>\n  <path id=\"sled-top\" class=\"sled outline\"/>\n  <path id=\"sled-middle\" class=\"sled outline\"/>\n  <path id=\"sled-tail\" class=\"sled outline\"/>\n  <path id=\"sled-nose\" class=\"sled outline\"/>\n  <path id=\"sled\" class=\"sled outline\"/>\n</g>\n\n<g id=\"arm\" class=\"arm outline\">\n  <path class=\"sleeve\"/>\n  <path class=\"hand\"/>\n</g>\n\n<g id=\"leg\" class=\"leg outline\">\n  <path class=\"pants\"/>\n  <path class=\"foot\"/>\n</g>\n\n<g id=\"body\">\n  <rect class=\"torso outline\"/>\n  <g class=\"neck\">\n    <rect class=\"scarf1 scarfOdd\"/>\n    <rect class=\"scarf2 scarfEven\"/>\n    <rect class=\"scarf3 scarfOdd\"/>\n    <rect class=\"scarf4 scarfEven\"/>\n    <rect class=\"scarf5 scarfOdd\"/>\n  </g>\n  <g class=\"hat\">\n    <path class=\"top outline\"/>\n    <path class=\"bottom\"/>\n    <circle class=\"ball\"/>\n  </g>\n</g>\n\n<rect id=\"scarf0\" class=\"scarf0 scarfEven\"/>\n<rect id=\"scarf1\" class=\"scarf1 scarfOdd\"/>\n<rect id=\"scarf2\" class=\"scarf2 scarfEven\"/>\n<rect id=\"scarf3\" class=\"scarf3 scarfOdd\"/>\n<rect id=\"scarf4\" class=\"scarf4 scarfEven\"/>\n<rect id=\"scarf5\" class=\"scarf5 scarfOdd\"/>\n");
  }
});
Object.defineProperty(c, "initial", {
  get() {
    console.log("\n.flag {\n  fill: rgba(0,0,0,0.4);\n}\n.outline {\n  stroke: black;\n  stroke-width: 0.3;\n}\n.skin {\n  fill: white;\n}\n.hair {\n  fill: black;\n}\n.eye {\n  fill: black;\n}\n.torso {\n  fill: white;\n}\n.scarfEven {\n  fill: white;\n}\n.scarf1 {\n  fill: #FD4F38;\n}\n.scarf3 {\n  fill: #06A725;\n}\n.scarf5 {\n  fill: #3995FD;\n}\n.hat .ball {\n  fill: black;\n}\n.hat .top {\n  fill: white;\n}\n.hat .bottom {\n  stroke: black;\n  stroke-width: 1;\n  stroke-linecap: round;\n}\n.sled {\n  fill: white;\n}\n.arm .sleeve {\n  fill: black;\n}\n.arm .hand {\n  fill: white;\n}\n.leg .pants {\n  fill: black;\n}\n.leg .foot {\n  fill: white;\n}\n");
  }
});