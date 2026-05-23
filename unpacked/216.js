var r = require("./217.js");
module.exports = Object("z").propertyIsEnumerable(0) ? Object : function (e) {
  if (r(e) == "String") {
    return e.split("");
  } else {
    return Object(e);
  }
};