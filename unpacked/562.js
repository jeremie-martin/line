Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.views = function (e = o, {
  type: t,
  payload: n
}) {
  switch (t) {
    case i.OPEN_TUTORIAL:
      return Object.assign({}, e, {
        tutorial: n
      });
    case i.SET_VIEWS:
      if (n[r.Sidebar] === e[r.Sidebar]) {
        return Object.assign({}, e, n, {
          [r.Sidebar]: null
        });
      } else {
        return Object.assign({}, e, n);
      }
    default:
      return e;
  }
};
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
}(require("./80.js"));
var i = require("./279.js");
const o = {
  tutorial: null,
  [r.Main]: null,
  [r.Sidebar]: null,
  [r.Entry]: r.Pages.Entry.Launch,
  [r.TrackLoader]: null,
  [r.TrackSaver]: null,
  [r.Dialog]: null
};