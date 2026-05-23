Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SceneryLine = exports.AccLine = exports.SolidLine = exports.LineTypes = undefined;
exports.createLineFromJson = function (e) {
  if (e.extended) {
    e.leftExtended = !!(l & e.extended);
    e.rightExtended = !!(u & e.extended);
  }
  switch (e.type) {
    case undefined:
      console.log("data", e);
      throw new TypeError(`Line JSON requires type: ${e.toString()}`);
    case r.default.SOLID:
      return new i.default(e);
    case r.default.ACC:
      return new o.default(e);
    case r.default.SCENERY:
      return new a.default(e);
    default:
      console.warn(`Line JSON has unknown type, creating as scenery line: ${e.toString()}`);
      return new a.default(e);
  }
};
var r = s(require("./145.js"));
var i = s(require("./285.js"));
var o = s(require("./503.js"));
var a = s(require("./504.js"));
function s(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
exports.LineTypes = r.default;
exports.SolidLine = i.default;
exports.AccLine = o.default;
exports.SceneryLine = a.default;
const l = 1;
const u = 2;