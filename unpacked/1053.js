Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = function (e) {
  {
    const t = t => {
      let n = e.getState();
      if ((e => !(0, i.getAutosaveEnabled)(e) && (0, r.getTrackIsDirty)(e))(n)) {
        t.returnValue = "Are you sure you want to exit? You have unsaved changes";
        return t.returnValue;
      } else if ((e => (0, r.getInEditor)(e) && (0, o.getModifiersActive)(e) && !(0, r.getTrackIsEmpty)(e))(n)) {
        t.returnValue = "Are you sure you want to exit?";
        return t.returnValue;
      } else {
        return undefined;
      }
    };
    window.addEventListener("beforeunload", t);
  }
};
var r = require("./8.js");
var i = require("./112.js");
var o = require("./35.js");
module.exports = exports.default;