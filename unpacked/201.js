function r(e, t, n) {
  this.index = e;
  this.value = t;
  this._inverse = n;
}
function i(e, t, n) {
  this.index = e;
  this.value = t;
  this._inverse = n;
}
function o(e, t) {
  this.patches = e;
  this._inverse = t;
}
function a(e, t, n, r) {
  this.index = e;
  this.oldValue = t;
  this.newValue = n;
  this._inverse = r;
}
r.prototype.apply = function (e) {
  e.splice(this.index, 0, this.value);
};
r.prototype.inverse = function () {
  this._inverse ||= new i(this.index, this.value, this);
  return this._inverse;
};
r.prototype.toPrimitives = function () {
  return [this];
};
r.prototype.forEachPrimitive = function (e) {
  e(this);
};
exports.Add = r;
i.prototype.apply = function (e) {
  e.splice(this.index, 1);
};
i.prototype.inverse = function () {
  this._inverse ||= new r(this.index, this.value, this);
  return this._inverse;
};
i.prototype.toPrimitives = function () {
  return [this];
};
i.prototype.forEachPrimitive = function (e) {
  e(this);
};
exports.Remove = i;
o.prototype.apply = function (e) {
  var t;
  for (t = 0; t < this.patches.length; ++t) {
    this.patches[t].apply(e);
  }
};
o.prototype.inverse = function () {
  if (!this._inverse) {
    var e;
    var t = [];
    for (e = this.patches.length - 1; e >= 0; --e) {
      t.push(this.patches[e].inverse());
    }
    this._inverse = new o(t, this);
  }
  return this._inverse;
};
o.prototype.toPrimitives = function () {
  var e;
  var t = [];
  for (e = 0; e < this.patches.length; ++e) {
    Array.prototype.push.apply(t, this.patches[e].toPrimitives());
  }
  return t;
};
o.prototype.forEachPrimitive = function (e) {
  var t;
  for (t = 0; t < this.patches.length; ++t) {
    this.patches[t].forEachPrimitive(e);
  }
};
exports.Sequence = o;
a.prototype.apply = function (e) {
  e[this.index] = this.newValue;
};
a.prototype.inverse = function () {
  this._inverse ||= new a(this.index, this.newValue, this.oldValue, this);
  return this._inverse;
};
a.prototype.toPrimitives = function () {
  return [new i(this.index, this.oldValue), new r(this.index, this.newValue)];
};
a.prototype.forEachPrimitive = function (e) {
  e(new i(this.index, this.oldValue));
  e(new r(this.index, this.newValue));
};
exports.Replace = a;