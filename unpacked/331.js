module.exports = function (e, t, n, r) {
  if (!(e instanceof t) || r !== undefined && r in e) {
    throw TypeError(n + ": incorrect invocation!");
  }
  return e;
};