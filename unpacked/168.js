exports.Color = require("./66.js");
exports.Scene = require("./207.js");
exports.Line = require("./61.js");
exports.Arc = require("./366.js");
exports.Triangle = require("./368.js");
exports.Camera = require("./807.js");
exports.WebGL1Renderer = require("./808.js");
exports.LineCaps = require("./371.js");
exports.createRenderer = function (e) {
  return new (exports.getBestSupportedRenderer())(e);
};
exports.getBestSupportedRenderer = function () {
  if (exports.WebGL1Renderer.isSupported() && exports.WebGL1Renderer.isHardwareAccelerated()) {
    return exports.WebGL1Renderer;
  }
  throw new Error("no renderer is supported by your browser");
};
window.Millions = exports;