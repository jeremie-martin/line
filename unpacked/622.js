Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = a;
var r = require("./34.js");
const i = 10;
function o(e) {
  let t = (e = e.toJSON()).lines;
  t = e.lines.length > i ? [...t.slice(0, i / 2).map(r.toLineArray), `omitted ${t.length - i} lines`, ...t.slice(-i / 2).map(r.toLineArray)] : t.map(r.toLineArray);
  return Object.assign({}, e, {
    lines: t
  });
}
function a(e) {
  var t = e.simulator;
  let n = t.engine;
  let r = t.committedEngine;
  return Object.assign({}, e, {
    simulator: {
      engine: o(n),
      committedEngine: o(r)
    }
  });
}
window.truncateState = a;
module.exports = exports.default;