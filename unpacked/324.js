require("./651.js");
var r = require("./41.js");
var i = require("./58.js");
var o = require("./118.js");
var a = require("./31.js")("toStringTag");
for (var s = "CSSRuleList,CSSStyleDeclaration,CSSValueList,ClientRectList,DOMRectList,DOMStringList,DOMTokenList,DataTransferItemList,FileList,HTMLAllCollection,HTMLCollection,HTMLFormElement,HTMLSelectElement,MediaList,MimeTypeArray,NamedNodeMap,NodeList,PaintRequestList,Plugin,PluginArray,SVGLengthList,SVGNumberList,SVGPathSegList,SVGPointList,SVGStringList,SVGTransformList,SourceBufferList,StyleSheetList,TextTrackCueList,TextTrackList,TouchList".split(","), l = 0; l < s.length; l++) {
  var u = s[l];
  var c = r[u];
  var d = c && c.prototype;
  if (d && !d[a]) {
    i(d, a, u);
  }
  o[u] = o.Array;
}