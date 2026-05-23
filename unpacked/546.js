Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.audioFileLoader = function (e = i, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.LOAD_AUDIO_PENDING:
      return Object.assign({}, e, {
        loadingFile: true,
        error: null
      });
    case r.LOAD_AUDIO:
    case r.LOAD_LOCAL_AUDIO:
      return Object.assign({}, e, {
        loadingFile: false,
        error: null
      });
    case r.LOAD_AUDIO_FAIL:
      return Object.assign({}, e, {
        loadingFile: false,
        error: !n || n.message
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
}(require("./7.js"));
const i = {
  loadingFile: false,
  error: null
};