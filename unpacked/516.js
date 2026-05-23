var n = function () {
  return Object.prototype.toString.call(arguments);
}() == "[object Arguments]";
function r(e) {
  return Object.prototype.toString.call(e) == "[object Arguments]";
}
function i(e) {
  return e && typeof e == "object" && typeof e.length == "number" && Object.prototype.hasOwnProperty.call(e, "callee") && !Object.prototype.propertyIsEnumerable.call(e, "callee") || false;
}
(exports = module.exports = n ? r : i).supported = r;
exports.unsupported = i;