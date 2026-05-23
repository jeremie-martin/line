if (require("./52.js") && /./g.flags != "g") {
  require("./54.js").f(RegExp.prototype, "flags", {
    configurable: true,
    get: require("./437.js")
  });
}