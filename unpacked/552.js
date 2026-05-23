Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.selectedTool = function (e = a, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.NEW_TRACK:
      return a;
    case r.LOAD_TRACK:
      return i.PAN_TOOL;
    case r.SET_TOOL:
      return n;
    default:
      return e;
  }
};
var r = o(require("./7.js"));
var i = o(require("./27.js"));
function o(e) {
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
}
const a = i.PENCIL_TOOL;