Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getLines = exports.clearLines = exports.removeLines = exports.addLines = exports.getAutosaveTable = exports.isOpen = exports.open = undefined;
var r;
var i = require("./305.js");
let o = new ((r = i) && r.__esModule ? r : {
  default: r
}).default("autosave");
o.version(1).stores({
  lines: "&id"
});
exports.open = () => o.open();
exports.isOpen = () => o.isOpen();
const a = exports.getAutosaveTable = () => o.table("lines");
exports.addLines = e => a().bulkPut(e.map(e => e.toJSON()));
exports.removeLines = e => a().bulkPut(e.map(({
  id: e
}) => ({
  id: e,
  removed: true
})));
exports.clearLines = () => a().clear();
exports.getLines = () => a().filter(e => !e.removed).toArray();