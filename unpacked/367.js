exports.padRect = function (e, t) {
  return {
    x: e.x - t,
    y: e.y - t,
    width: e.width + t * 2,
    height: e.height + t * 2
  };
};
exports.rotateAboutOrigin = function (e, t) {
  const n = Math.cos(t);
  const r = Math.sin(t);
  return {
    x: e.x * n - e.y * r,
    y: e.y * n + e.x * r
  };
};
exports.fitBoundingBoxToPoint = function (e, t) {
  if (t.x < e.x) {
    e.width += e.x - t.x;
    e.x = t.x;
  } else if (t.x > e.x + e.width) {
    e.width = t.x - e.x;
  }
  if (t.y < e.y) {
    e.height += e.y - t.y;
    e.y = t.y;
  } else if (t.y > e.y + e.height) {
    e.height = t.y - e.y;
  }
};