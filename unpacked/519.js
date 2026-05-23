Object.defineProperty(exports, "__esModule", {
  value: true
});
var r;
var i = require("./290.js");
var o = (r = i) && r.__esModule ? r : {
  default: r
};
var a = require("./291.js");
const s = 14;
exports.default = class extends o.default {
  constructor(e = s) {
    super(e);
  }
  getGridCellCoordsForLine(e) {
    return (0, a.legacyCells)(e, this.gridSize);
  }
};
module.exports = exports.default;