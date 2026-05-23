Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e, t) {
  e.renderable = t;
  if (e.rules && t.cssRules) {
    e.rules.link(t.cssRules);
  }
};