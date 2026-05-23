Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.notifications = function (e = i, {
  type: t,
  payload: n
}) {
  switch (t) {
    case r.SHOW_NOTIFICATION:
      if (n.message === e.message) {
        return Object.assign({}, e, {
          autoHide: n.autoHide,
          count: e.count + 1
        });
      } else if (e.open) {
        return Object.assign({}, e, {
          open: true,
          queue: [...e.queue, {
            message: n.message,
            autoHide: n.autoHide,
            progressId: n.progressId
          }]
        });
      } else {
        return Object.assign({}, e, {
          message: n.message,
          autoHide: n.autoHide,
          progressId: n.progressId,
          open: true,
          count: e.count + 1
        });
      }
    case r.HIDE_NOTIFICATION:
      if (n && n !== e.message) {
        let t = e.queue.findIndex(({
          message: e
        }) => n === e);
        if (t > -1) {
          let n = [...e.queue];
          n.splice(t, 1);
          return Object.assign({}, e, {
            queue: n
          });
        }
        return e;
      }
      if (e.queue.length > 0) {
        a = e.queue;
        var o = Array.isArray(a) ? a : Array.from(a);
        let t = o[0];
        let n = o.slice(1);
        return {
          message: t.message,
          autoHide: t.autoHide,
          progressId: t.progressId,
          open: true,
          queue: n,
          count: e.count + 1
        };
      }
      return Object.assign({}, e, {
        message: i.message,
        autoHide: i.autoHide,
        progressId: i.progressId,
        open: false
      });
    default:
      return e;
  }
  var a;
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
}(require("./29.js"));
const i = {
  message: "",
  autoHide: false,
  open: false,
  queue: [],
  count: 0,
  progressId: null
};