var r = require("./309.js");
var i = require("./212.js").amf0Types;
function o(e, t) {
  if (typeof t == "number") {
    t = {
      offset: t
    };
  }
  t ||= {};
  if (t.offset == null) {
    t.offset = 0;
  }
  t.byteLength = 0;
  var n = e.readUInt8(t.offset);
  a(t, 1);
  switch (n) {
    case i.kNumberType:
      return function (e, t) {
        var n = t.offset;
        a(t, 8);
        return e.readDoubleBE(n);
      }(e, t);
    case i.kBooleanType:
      return function (e, t) {
        var n = t.offset;
        a(t, 1);
        return e.readUInt8(n) !== 0;
      }(e, t);
    case i.kStringType:
      return s(e, t);
    case i.kObjectType:
      return l(e, t);
    case i.kNullType:
      return null;
    case i.kUndefinedType:
      return;
    case i.kReferenceType:
      return function (e, t) {
        var n = e.readUInt16BE(t.offset);
        a(t, 2);
        return t.references[n];
      }(e, t);
    case i.kECMAArrayType:
      return function (e, t, n) {
        if (!Array.isArray(n)) {
          n = [];
        }
        e.readUInt32BE(t.offset);
        a(t, 4);
        l(e, t, n);
        return n;
      }(e, t);
    case i.kObjectEndType:
      return u;
    case i.kStrictArrayType:
      return function (e, t, n) {
        var r;
        var i;
        if (!Array.isArray(n)) {
          n = [];
        }
        t.references ||= [];
        t.references.push(n);
        var s = e.readUInt32BE(t.offset);
        a(t, 4);
        i = {};
        for (var l = 0; l < s; l++) {
          i.offset = t.offset;
          i.references = t.references;
          r = o(e, i);
          a(t, i.byteLength);
          n.push(r);
        }
        return n;
      }(e, t);
    case i.kDateType:
      return function (e, t) {
        var n = e.readDoubleBE(t.offset);
        a(t, 8);
        e.readInt16BE(t.offset);
        a(t, 2);
        return new Date(n);
      }(e, t);
    case i.kTypedObjectType:
      return function (e, t) {
        var n = s(e, t);
        var r = l(e, t);
        r.__className__ = n;
        return r;
      }(e, t);
    default:
      throw new Error("\"type\" not yet implemented: " + n);
  }
}
function a(e, t) {
  e.offset += t;
  e.byteLength += t;
}
function s(e, t) {
  var n = t.offset;
  var r = e.readUInt16BE(n);
  a(t, 2);
  n = t.offset;
  a(t, r);
  return e.toString("utf8", n, n + r);
}
function l(e, t, n) {
  var i;
  var l;
  n ||= {};
  t.references ||= [];
  t.references.push(n);
  var c = {};
  while (l !== u) {
    c.offset = t.offset;
    c.byteLength = 0;
    i = s(e, c);
    a(t, c.byteLength);
    c.offset = t.offset;
    c.references = t.references;
    l = o(e, c);
    a(t, c.byteLength);
    if (l !== u) {
      n[i] = l;
    }
  }
  r.strictEqual(i, "");
  r.strictEqual(l, u);
  return n;
}
module.exports = o;
var u = {
  endObject: true
};