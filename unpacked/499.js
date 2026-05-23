Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.LineTypes = undefined;
var r = require("./144.js");
Object.defineProperty(exports, "LineTypes", {
  enumerable: true,
  get: function () {
    return l(r).default;
  }
});
exports.createLineFromJson = function (e) {
  if (e.extended) {
    e.leftExtended = !!(u & e.extended);
    e.rightExtended = !!(c & e.extended);
  }
  switch (e.type) {
    case undefined:
      throw new TypeError(`Line JSON requires type: ${e.toString()}`);
    case i.default.SOLID:
      return new o.default(e);
    case i.default.ACC:
      return new a.default(e);
    case i.default.SCENERY:
      return new s.default(e);
    default:
      console.warn(`Line JSON has unknown type, creating as scenery line: ${e.toString()}`);
  }
};
var i = l(r);
var o = l(require("./283.js"));
var a = l(require("./500.js"));
var s = l(require("./501.js"));
function l(e) {
  if (e && e.__esModule) {
    return e;
  } else {
    return {
      default: e
    };
  }
}
const u = 1;
const c = 2;