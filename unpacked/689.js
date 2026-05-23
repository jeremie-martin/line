Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./1.js");
exports.default = {
  jss: (0, r.shape)({
    options: (0, r.shape)({
      createGenerateClassName: r.func.isRequired
    }).isRequired,
    createStyleSheet: r.func.isRequired,
    removeStyleSheet: r.func.isRequired
  }),
  registry: (0, r.shape)({
    add: r.func.isRequired,
    toString: r.func.isRequired
  })
};