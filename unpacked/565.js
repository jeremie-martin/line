Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hint = function (e = o, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.TRIGGER_HINT:
      return Object.assign({}, e, {
        queue: [...e.queue, n]
      });
    case r.SHOW_HINT:
      return Object.assign({}, e, {
        queue: e.queue.slice(1)
      });
    case i.SHOW_NOTIFICATION:
      return Object.assign({}, e, {
        visible: false
      });
    case i.HIDE_NOTIFICATION:
      return Object.assign({}, e, {
        visible: true
      });
    default:
      return e;
  }
};
var r = require("./209.js");
var i = require("./29.js");
const o = {
  queue: [],
  visible: true
};