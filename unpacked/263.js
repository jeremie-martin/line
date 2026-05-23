module.exports = !require("./52.js") && !require("./99.js")(function () {
  return Object.defineProperty(require("./184.js")("div"), "a", {
    get: function () {
      return 7;
    }
  }).a != 7;
});