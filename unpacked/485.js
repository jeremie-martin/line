module.exports = function (e) {
  if ((e = e || (typeof document != "undefined" ? document : undefined)) === undefined) {
    return null;
  }
  try {
    return e.activeElement || e.body;
  } catch (t) {
    return e.body;
  }
};