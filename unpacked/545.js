Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fetchTextResource = function (e) {
  return window.fetch(e, {
    credentials: "same-origin"
  }).then(e => e.text());
};