var r = require("./449.js");
var i = require("./136.js");
var o = require("./101.js");
var a = require("./30.js");
var s = require("./53.js");
var l = require("./193.js");
var u = require("./47.js");
var c = u("iterator");
var d = u("toStringTag");
var f = l.Array;
var p = {
  CSSRuleList: true,
  CSSStyleDeclaration: false,
  CSSValueList: false,
  ClientRectList: false,
  DOMRectList: false,
  DOMStringList: false,
  DOMTokenList: true,
  DataTransferItemList: false,
  FileList: false,
  HTMLAllCollection: false,
  HTMLCollection: false,
  HTMLFormElement: false,
  HTMLSelectElement: false,
  MediaList: true,
  MimeTypeArray: false,
  NamedNodeMap: false,
  NodeList: true,
  PaintRequestList: false,
  Plugin: false,
  PluginArray: false,
  SVGLengthList: false,
  SVGNumberList: false,
  SVGPathSegList: false,
  SVGPointList: false,
  SVGStringList: false,
  SVGTransformList: false,
  SourceBufferList: false,
  StyleSheetList: true,
  TextTrackCueList: false,
  TextTrackList: false,
  TouchList: false
};
for (var h = i(p), m = 0; m < h.length; m++) {
  var y;
  var g = h[m];
  var v = p[g];
  var b = a[g];
  var _ = b && b.prototype;
  if (_ && (_[c] || s(_, c, f), _[d] || s(_, d, g), l[g] = f, v)) {
    for (y in r) {
      if (!_[y]) {
        o(_, y, r[y], true);
      }
    }
  }
}