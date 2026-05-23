Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getTypeInfo = exports.SCENERY_LINE = exports.ACC_LINE = exports.SOLID_LINE = undefined;
var r = require("./143.js");
var i = require("./48.js");
const o = r.LineTypes.SOLID;
const a = r.LineTypes.ACC;
const s = r.LineTypes.SCENERY;
exports.SOLID_LINE = o;
exports.ACC_LINE = a;
exports.SCENERY_LINE = s;
const l = (...e) => {
  e.css = `rgb(${e.join()})`;
  return e;
};
const u = {
  [o]: {
    name: "normal",
    color: l(...i.Blue)
  },
  [a]: {
    name: "accel",
    color: l(...i.Red)
  },
  [s]: {
    name: "scenery",
    color: l(...i.Green)
  },
  default: {
    name: "??? (type)",
    color: l(...i.Grey)
  }
};
exports.getTypeInfo = e => e in u ? u[e] : {
  name: `??? (${e})`,
  color: u.default.color
};