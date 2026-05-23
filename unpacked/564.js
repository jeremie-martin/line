Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.progress = function (e = {
  [i.SAVE_TRACK]: o,
  [i.LOAD_TRACK]: o,
  [i.AUTOSAVE]: o
}, {
  type: t,
  payload: n,
  error: a,
  meta: s
}) {
  switch (t) {
    case r.PROGRESS:
      return Object.assign({}, e, {
        [s.id]: {
          status: n.status,
          percent: n.percent,
          error: null
        }
      });
    case r.PROGRESS_DONE:
      return Object.assign({}, e, {
        [s.id]: {
          status: null,
          percent: null,
          error: a ? n.message : null
        }
      });
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
}(require("./109.js"));
var i = require("./7.js");
const o = {
  status: null,
  percent: null,
  error: null
};