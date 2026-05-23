Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.adjustStartPositions = exports.setNumRiders = undefined;
var r;
var i = require("./7.js");
var o = require("./8.js");
var a = require("./27.js");
var s = require("./16.js");
var l = (r = s) && r.__esModule ? r : {
  default: r
};
function u(e, t) {
  var n = {};
  for (var r in e) {
    if (!(t.indexOf(r) >= 0)) {
      if (Object.prototype.hasOwnProperty.call(e, r)) {
        n[r] = e[r];
      }
    }
  }
  return n;
}
exports.setNumRiders = e => function (t, n) {
  let r = (0, o.getRiders)(n());
  if (e < r.length) {
    r = r.slice(0, e);
    t((0, i.setRiders)(r));
    t((0, i.commitTrackChanges)());
  } else if (e > r.length) {
    for (let t = (r = [...r]).length; t < e; t++) {
      var a = r[t - 1];
      let e = a.startPosition;
      let n = u(a, ["startPosition"]);
      (e = new l.default(e)).y += -50;
      r.push(Object.assign({}, n, {
        startPosition: e
      }));
    }
    t((0, i.setRiders)(r));
    t((0, i.commitTrackChanges)());
  }
};
exports.adjustStartPositions = () => function (e, t) {
  e((0, i.closeSidebar)());
  e((0, i.setTool)(a.ADJUST_START_TOOL));
};