module.exports = !require("./42.js") && !require("./72.js")(function () {
  return Object.defineProperty(require("./320.js")("div"), "a", {
    get: function () {
      return 7;
    }
  }).a != 7;
});