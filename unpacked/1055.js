Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  let t;
  let n = o.default.getItem(s);
  if (n) {
    e.dispatch((0, a.loadSettings)(JSON.parse(n)));
  }
  e.subscribe(() => {
    const n = e.getState().settings;
    if (n !== t) {
      o.default.setItem(s, JSON.stringify(n));
      t = n;
    }
  });
};
var r;
var i = require("./111.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./7.js");
const s = "SETTINGS";
module.exports = exports.default;