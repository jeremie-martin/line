function n(e) {
  this.name = "RavenConfigError";
  this.message = e;
}
n.prototype = new Error();
n.prototype.constructor = n;
module.exports = n;