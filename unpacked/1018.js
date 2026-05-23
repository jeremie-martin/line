var n = ["M", "MM", "Q", "D", "DD", "DDD", "DDDD", "d", "E", "W", "WW", "YY", "YYYY", "GG", "GGGG", "H", "HH", "h", "hh", "m", "mm", "s", "ss", "S", "SS", "SSS", "Z", "ZZ", "X", "x"];
module.exports = function (e) {
  var t = [];
  for (var r in e) {
    if (e.hasOwnProperty(r)) {
      t.push(r);
    }
  }
  var i = n.concat(t).sort().reverse();
  return new RegExp("(\\[[^\\[]*\\])|(\\\\)?(" + i.join("|") + "|.)", "g");
};