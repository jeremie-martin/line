var r = require("./71.js");
var i = require("./649.js");
var o = require("./221.js");
var a = require("./219.js")("IE_PROTO");
function s() {}
function l() {
  var e;
  var t = require("./320.js")("iframe");
  var r = o.length;
  t.style.display = "none";
  require("./650.js").appendChild(t);
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