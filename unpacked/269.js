var r = require("./100.js");
var i = require("./432.js");
var o = require("./191.js");
var a = require("./190.js")("IE_PROTO");
function s() {}
function l() {
  var e;
  var t = require("./184.js")("iframe");
  var r = o.length;
  t.style.display = "none";
  require("./270.js").appendChild(t);
  t.src = "javascript:";
  (e = t.contentWindow.document).open();
  e.write("<script>document.F=Object</script>");
  e.close();
  l = e.F;
  while (r--) {
    delete l.prototype[o[r]];
  }
  return l();
}
module.exports = Object.create || function (e, t) {
  var n;
  if (e !== null) {
    s.prototype = r(e);
    n = new s();
    s.prototype = null;
    n[a] = e;
  } else {
    n = l();
  }
  if (t === undefined) {
    return n;
  } else {
    return i(n, t);
  }
};