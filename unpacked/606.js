var t = require("./308.js").Buffer;
var r = require("./309.js");
var i = require("./212.js").amf0Types;
function o(e, t, n) {
  if (typeof n == "number") {
    n = {
      offset: n
    };
  }
  n ||= {};
  if (n.offset == null) {
    n.offset = 0;
  }
  var r = n.type == null ? function (e, t) {
    if (e === null) {
      return i.kNullType;
    }
    if (e === undefined) {
      return i.kUndefinedType;
    }
    if (u === e) {
      return i.kObjectEndType;
    }
    var n = typeof e;
    if (n === "number") {
      return i.kNumberType;
    }
    if (n === "boolean") {
      return i.kBooleanType;
    }
    if (n === "string") {
      return i.kStringType;
    }
    if (n === "object") {
      if (function (e, t) {
        var n = false;
        var r = t.references;
        if (r) {
          for (var i = 0; i < r.length; i++) {
            if (r[i] === e) {
              n = true;
              break;
            }
          }
        }
        return n;
      }(e, t)) {
        return i.kReferenceType;
      } else if (Array.isArray(e)) {
        return i.kECMAArrayType;
      } else {
        return i.kObjectType;
      }
    }
    throw new Error("could not infer AMF \"type\" for " + e);
  }(t, n) : n.type;
  n.byteLength = 0;
  e.writeUInt8(r, n.offset);
  a(n, 1);
  switch (r) {
    case i.kNumberType:
      (function (e, t, n) {
        var r = n.offset;
        a(n, 8);
        e.writeDoubleBE(t, r);
      })(e, t, n);
      break;
    case i.kBooleanType:
      (function (e, t, n) {
        var r = n.offset;
        a(n, 1);
        e.writeUInt8(t ? 1 : 0, r);
      })(e, t, n);
      break;
    case i.kStringType:
      s(e, t, n);
      break;
    case i.kObjectType:
      l(e, t, n);
      break;
    case i.kNullType:
    case i.kUndefinedType:
      break;
    case i.kReferenceType:
      (function (e, t, n) {
        for (var r = n.references, i = n.offset, o = 0; o < r.length && r[o] !== t; o++);
        a(n, 2);
        e.writeUInt16BE(o, i);
      })(e, t, n);
      break;
    case i.kECMAArrayType:
      (function (e, t, n) {
        e.writeUInt32BE(t.length, n.offset);
        a(n, 4);
        l(e, t, n);
      })(e, t, n);
      break;
    case i.kObjectEndType:
      break;
    case i.kStrictArrayType:
      writeStrictArray(e, t, n);
      break;
    case i.kDateType:
      writeDate(e, t, n);
      break;
    case i.kTypedObjectType:
      writeTypedObject(e, t, n);
      break;
    default:
      throw new Error("\"type\" not yet implemented: " + r);
  }
}
function a(e, t) {
  e.offset += t;
  e.byteLength += t;
}
function s(e, n, i) {
  var o = i.offset;
  var s = t.byteLength(n, "utf8");
  e.writeUInt16BE(s, o);
  a(i, 2);
  o = i.offset;
  a(i, s);
  var l = e.write(n, o, s, "utf8");
  r.equal(l, s, "failed to write entire String " + JSON.stringify(n) + " to Buffer with length " + e.length + " at offset " + o + ". Wrote " + l + " bytes, expected " + s);
  return l;
}
function l(e, t, n) {
  var r;
  var i = Object.keys(t);
  n.references ||= [];
  n.references.push(t);
  var l = {};
  for (var c = 0; c < i.length; c++) {
    l.offset = n.offset;
    l.byteLength = 0;
    s(e, r = i[c], l);
    a(n, l.byteLength);
    l.offset = n.offset;
    l.references = n.references;
    o(e, t[r], l);
    a(n, l.byteLength);
  }
  l.offset = n.offset;
  l.byteLength = 0;
  s(e, "", l);
  a(n, l.byteLength);
  l.offset = n.offset;
  o(e, u, l);
  a(n, l.byteLength);
}
module.exports = o;
var u = {
  endObject: true
};