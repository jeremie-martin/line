function n(e) {
  var t = [];
  for (var n in e) {
    t.push(n);
  }
  return t;
}
(module.exports = typeof Object.keys == "function" ? Object.keys : n).shim = n;