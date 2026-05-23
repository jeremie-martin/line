var r = require("./137.js");
module.exports = Object("z").propertyIsEnumerable(0) ? Object : function (e) {
  if (r(e) == "String") {
    return e.split("");
  } else {
    return Object(e);
  }
};