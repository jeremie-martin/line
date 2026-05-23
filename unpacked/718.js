var r = require("./28.js");
r(r.S, "Number", {
  isNaN: function (e) {
    return e != e;
  }
});