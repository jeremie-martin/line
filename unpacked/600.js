var r = require("./601.js");
var i = ["x1", "y1", "x2", "y2", "extended", "flipped", "leftLine", "rightLine", "id", "type"];
module.exports = function (e) {
  let t = r.read(e, function (e) {
    var t;
    var n;
    var r;
    [{
      name: "Magic Number",
      value: 191,
      read: () => e.readUInt16BE(0)
    }, {
      name: "Marker Tag",
      value: "TCSO",
      read: () => {
        e.readUInt32BE(2);
        return e.toString("utf8", 6, 10);
      }
    }, {
      name: "Marker",
      value: 17179869184,
      read: () => e.readUIntBE(10, 6)
    }, {
      name: "Shared Object Name",
      value: "savedLines",
      read: () => {
        t = e.readUInt16BE(16);
        n = 18 + t + 0;
        return e.toString("utf8", 18, n);
      }
    }, {
      name: "Padding",
      value: 0,
      read: () => e.readUInt32BE(n)
    }, {
      name: "Data Name",
      value: "trackList",
      read: () => {
        let n = 18 + t + 4;
        let i = 18 + t + 6;
        let s = e.readUInt16BE(n);
        r = i + s;
        return e.toString("utf8", i, i + s);
      }
    }].forEach(e => {
      let t = e.read();
      if (e.value !== t) {
        let n = e.value;
        let r = t;
        if (typeof n != "string") {
          n = n.toString(16);
          r = r.toString(16);
        }
        throw new Error(`Invalid header. Expected ${e.name} to be ${n}. Instead, got ${r}.`);
      }
    });
    return r;
  }(e));
  if (!(t instanceof Array)) {
    throw new Error("This .sol does not contain tracks: " + t);
  }
  return t.map(e => (e = e) !== null && e !== undefined && e.data instanceof Array ? {
    label: e.label,
    version: e.version,
    startPosition: {
      x: e.startLine[0],
      y: e.startLine[1]
    },
    lines: e.data.map(e => {
      let t = {};
      i.forEach((n, r) => {
        t[n] = e[r];
      });
      return t;
    })
  } : null).filter(e => e !== null);
  var n;
};