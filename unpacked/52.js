module.exports = !require("./99.js")(function () {
  return Object.defineProperty({}, "a", {
    get: function () {
      return 7;
    }
  }).a != 7;
});