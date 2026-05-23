if (typeof Object.create == "function") {
  module.exports = function (e, t) {
    e.super_ = t;
    e.prototype = Object.create(t.prototype, {
      constructor: {
        value: e,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  module.exports = function (e, t) {
    e.super_ = t;
    function n() {}
    n.prototype = t.prototype;
    e.prototype = new n();
    e.prototype.constructor = e;
  };
}