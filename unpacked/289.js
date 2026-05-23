function r(e, t, n) {
  this.key = e;
  this.oldValue = t;
  this.newValue = n;
}
function i(e) {
  this.patches = e;
}
r.prototype.apply = function (e) {
  if (this.newValue === undefined) {
    e.delete(this.key);
  } else {
    e.set(this.key, this.newValue);
  }
};
r.prototype.inverse = function () {
  return new r(this.key, this.newValue, this.oldValue);
};
r.prototype.toPrimitives = function () {
  return [this];
};
r.prototype.forEachPrimitive = function (e) {
  e(this);
};
exports.Set = r;
i.prototype.apply = function (e) {
  var t;
  for (t = 0; t < this.patches.length; ++t) {
    this.patches[t].apply(e);
  }
};
i.prototype.inverse = function () {
  var e;
  var t = [];
  for (e = this.patches.length - 1; e >= 0; --e) {
    t.push(this.patches[e].inverse());
  }
  return new i(t);
};
i.prototype.toPrimitives = function () {
  var e;
  var t = [];
  for (e = 0; e < this.patches.length; ++e) {
    Array.prototype.push.apply(t, this.patches[e].toPrimitives());
  }
  return t;
};
i.prototype.forEachPrimitive = function (e) {
  var t;
  for (t = 0; t < this.patches.length; ++t) {
    this.patches[t].forEachPrimitive(e);
  }
};
exports.Sequence = i;