Object.defineProperty(exports, "__esModule", {
  value: true
});
var r = require("./8.js");
const i = {
  setDocumentTitle: e => {
    document.title = e ? `${e} - Line Rider` : "Line Rider";
  }
};
exports.default = ({
  setDocumentTitle: e
} = i) => ({
  getState: t
}) => n => function (i) {
  let o = (0, r.getTrackIsEmpty)(t());
  let a = (0, r.getTrackIsDirty)(t());
  let s = (0, r.getTrackDetails)(t());
  let l = n(i);
  let u = (0, r.getTrackIsEmpty)(t());
  let c = (0, r.getTrackIsDirty)(t());
  let d = (0, r.getTrackDetails)(t());
  if (s.title !== d.title || a !== c || o !== u) {
    if (u) {
      e();
    } else {
      e((c ? "*" : "") + d.title);
    }
  }
  return l;
};
module.exports = exports.default;