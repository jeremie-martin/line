import * as r from "./0.js";
var i = r;
import * as o from "./1.js";
var a = o;
import * as s from "./419.js";
var l = s;
var u = typeof document == "undefined" || !document || !document.createElement || "multiple" in document.createElement("input");
function c(e) {
  var t = [];
  if (e.dataTransfer) {
    var n = e.dataTransfer;
    if (n.files && n.files.length) {
      t = n.files;
    } else if (n.items && n.items.length) {
      t = n.items;
    }
  } else if (e.target && e.target.files) {
    t = e.target.files;
  }
  return Array.prototype.slice.call(t);
}
function d(e, t) {
  return e.type === "application/x-moz-file" || l(e, t);
}
function f(e) {
  e.preventDefault();
}
var p = {
  borderStyle: "solid",
  borderColor: "#c66",
  backgroundColor: "#eee"
};
var h = {
  opacity: 0.5
};
var m = {
  borderStyle: "solid",
  borderColor: "#6c6",
  backgroundColor: "#eee"
};
var y = {
  width: 200,
  height: 200,
  borderWidth: 2,
  borderColor: "#666",
  borderStyle: "dashed",
  borderRadius: 5
};
var g = Object.assign || function (e) {
  for (var t = 1; t < arguments.length; t++) {
    var n = arguments[t];
    for (var r in n) {
      if (Object.prototype.hasOwnProperty.call(n, r)) {
        e[r] = n[r];
      }
    }
  }
  return e;
};
var v = function () {
  function e(e, t) {
    for (var n = 0; n < t.length; n++) {
      var r = t[n];
      r.enumerable = r.enumerable || false;
      r.configurable = true;
      if ("value" in r) {
        r.writable = true;
      }
      Object.defineProperty(e, r.key, r);
    }
  }
  return function (t, n, r) {
    if (n) {
      e(t.prototype, n);
    }
    if (r) {
      e(t, r);
    }
    return t;
  };
}();
function b(e, t) {
  var n = {};
  for (var r in e) {
    if (!(t.indexOf(r) >= 0)) {
      if (Object.prototype.hasOwnProperty.call(e, r)) {
        n[r] = e[r];
      }
    }
  }
  return n;
}
var _ = function (e) {
  function t(e, n) {
    (function (e, t) {
      if (!(e instanceof t)) {
        throw new TypeError("Cannot call a class as a function");
      }
    })(this, t);
    var r = function (e, t) {
      if (!e) {
        throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
      }
      if (!t || typeof t != "object" && typeof t != "function") {
        return e;
      } else {
        return t;
      }
    }(this, (t.__proto__ || Object.getPrototypeOf(t)).call(this, e, n));
    r.renderChildren = function (e, t, n, i) {
      if (typeof e == "function") {
        return e(g({}, r.state, {
          isDragActive: t,
          isDragAccept: n,
          isDragReject: i
        }));
      } else {
        return e;
      }
    };
    r.composeHandlers = r.composeHandlers.bind(r);
    r.onClick = r.onClick.bind(r);
    r.onDocumentDrop = r.onDocumentDrop.bind(r);
    r.onDragEnter = r.onDragEnter.bind(r);
    r.onDragLeave = r.onDragLeave.bind(r);
    r.onDragOver = r.onDragOver.bind(r);
    r.onDragStart = r.onDragStart.bind(r);
    r.onDrop = r.onDrop.bind(r);
    r.onFileDialogCancel = r.onFileDialogCancel.bind(r);
    r.onInputElementClick = r.onInputElementClick.bind(r);
    r.setRef = r.setRef.bind(r);
    r.setRefs = r.setRefs.bind(r);
    r.isFileDialogActive = false;
    r.state = {
      draggedFiles: [],
      acceptedFiles: [],
      rejectedFiles: []
    };
    return r;
  }
  (function (e, t) {
    if (typeof t != "function" && t !== null) {
      throw new TypeError("Super expression must either be null or a function, not " + typeof t);
    }
    e.prototype = Object.create(t && t.prototype, {
      constructor: {
        value: e,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
    if (t) {
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(e, t);
      } else {
        e.__proto__ = t;
      }
    }
  })(t, i.Component);
  v(t, [{
    key: "componentDidMount",
    value: function () {
      var e = this.props.preventDropOnDocument;
      this.dragTargets = [];
      if (e) {
        document.addEventListener("dragover", f, false);
        document.addEventListener("drop", this.onDocumentDrop, false);
      }
      this.fileInputEl.addEventListener("click", this.onInputElementClick, false);
      document.body.onfocus = this.onFileDialogCancel;
    }
  }, {
    key: "componentWillUnmount",
    value: function () {
      if (this.props.preventDropOnDocument) {
        document.removeEventListener("dragover", f);
        document.removeEventListener("drop", this.onDocumentDrop);
      }
      if (this.fileInputEl != null) {
        this.fileInputEl.removeEventListener("click", this.onInputElementClick, false);
      }
      if (document != null) {
        document.body.onfocus = null;
      }
    }
  }, {
    key: "composeHandlers",
    value: function (e) {
      if (this.props.disabled) {
        return null;
      } else {
        return e;
      }
    }
  }, {
    key: "onDocumentDrop",
    value: function (e) {
      if (!this.node || !this.node.contains(e.target)) {
        e.preventDefault();
        this.dragTargets = [];
      }
    }
  }, {
    key: "onDragStart",
    value: function (e) {
      if (this.props.onDragStart) {
        this.props.onDragStart.call(this, e);
      }
    }
  }, {
    key: "onDragEnter",
    value: function (e) {
      e.preventDefault();
      if (this.dragTargets.indexOf(e.target) === -1) {
        this.dragTargets.push(e.target);
      }
      this.setState({
        isDragActive: true,
        draggedFiles: c(e)
      });
      if (this.props.onDragEnter) {
        this.props.onDragEnter.call(this, e);
      }
    }
  }, {
    key: "onDragOver",
    value: function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.dataTransfer.dropEffect = this.isFileDialogActive ? "none" : "copy";
      } catch (e) {}
      if (this.props.onDragOver) {
        this.props.onDragOver.call(this, e);
      }
      return false;
    }
  }, {
    key: "onDragLeave",
    value: function (e) {
      var t = this;
      e.preventDefault();
      this.dragTargets = this.dragTargets.filter(function (n) {
        return n !== e.target && t.node.contains(n);
      });
      if (!(this.dragTargets.length > 0)) {
        this.setState({
          isDragActive: false,
          draggedFiles: []
        });
        if (this.props.onDragLeave) {
          this.props.onDragLeave.call(this, e);
        }
      }
    }
  }, {
    key: "onDrop",
    value: function (e) {
      var t = this;
      var n = this.props;
      var r = n.onDrop;
      var i = n.onDropAccepted;
      var o = n.onDropRejected;
      var a = n.multiple;
      var s = n.disablePreview;
      var l = n.accept;
      var u = c(e);
      var f = [];
      var p = [];
      e.preventDefault();
      this.dragTargets = [];
      this.isFileDialogActive = false;
      u.forEach(function (e) {
        if (!s) {
          try {
            e.preview = window.URL.createObjectURL(e);
          } catch (e) {
            0;
          }
        }
        if (d(e, l) && function (e, t, n) {
          return e.size <= t && e.size >= n;
        }(e, t.props.maxSize, t.props.minSize)) {
          f.push(e);
        } else {
          p.push(e);
        }
      });
      if (!a) {
        p.push.apply(p, function (e) {
          if (Array.isArray(e)) {
            for (var t = 0, n = Array(e.length); t < e.length; t++) {
              n[t] = e[t];
            }
            return n;
          }
          return Array.from(e);
        }(f.splice(1)));
      }
      if (r) {
        r.call(this, f, p, e);
      }
      if (p.length > 0 && o) {
        o.call(this, p, e);
      }
      if (f.length > 0 && i) {
        i.call(this, f, e);
      }
      this.draggedFiles = null;
      this.setState({
        isDragActive: false,
        draggedFiles: [],
        acceptedFiles: f,
        rejectedFiles: p
      });
    }
  }, {
    key: "onClick",
    value: function (e) {
      var t = this.props;
      var n = t.onClick;
      if (!t.disableClick) {
        e.stopPropagation();
        if (n) {
          n.call(this, e);
        }
        if (!function (e = window.navigator.userAgent) {
          return function (e) {
            return e.indexOf("MSIE") !== -1 || e.indexOf("Trident/") !== -1;
          }(e) || function (e) {
            return e.indexOf("Edge/") !== -1;
          }(e);
        }()) {
          this.open();
        } else {
          setTimeout(this.open.bind(this), 0);
        }
      }
    }
  }, {
    key: "onInputElementClick",
    value: function (e) {
      e.stopPropagation();
      if (this.props.inputProps && this.props.inputProps.onClick) {
        this.props.inputProps.onClick();
      }
    }
  }, {
    key: "onFileDialogCancel",
    value: function () {
      var e = this;
      var t = this.props.onFileDialogCancel;
      if (this.isFileDialogActive) {
        setTimeout(function () {
          if (e.fileInputEl != null) {
            if (!e.fileInputEl.files.length) {
              e.isFileDialogActive = false;
            }
          }
          if (typeof t == "function") {
            t();
          }
        }, 300);
      }
    }
  }, {
    key: "setRef",
    value: function (e) {
      this.node = e;
    }
  }, {
    key: "setRefs",
    value: function (e) {
      this.fileInputEl = e;
    }
  }, {
    key: "open",
    value: function () {
      this.isFileDialogActive = true;
      this.fileInputEl.value = null;
      this.fileInputEl.click();
    }
  }, {
    key: "render",
    value: function () {
      var e = this.props;
      var t = e.accept;
      var n = e.acceptClassName;
      var r = e.activeClassName;
      var o = e.children;
      var a = e.disabled;
      var s = e.disabledClassName;
      var l = e.inputProps;
      var c = e.multiple;
      var f = e.name;
      var v = e.rejectClassName;
      var _ = b(e, ["accept", "acceptClassName", "activeClassName", "children", "disabled", "disabledClassName", "inputProps", "multiple", "name", "rejectClassName"]);
      var w = _.acceptStyle;
      var x = _.activeStyle;
      var E = _.className;
      var S = E === undefined ? "" : E;
      var T = _.disabledStyle;
      var k = _.rejectStyle;
      var O = _.style;
      var P = b(_, ["acceptStyle", "activeStyle", "className", "disabledStyle", "rejectStyle", "style"]);
      var C = this.state;
      var I = C.isDragActive;
      var M = C.draggedFiles;
      var L = M.length;
      var R = c || L <= 1;
      var A = L > 0 && function (e, t) {
        return e.every(function (e) {
          return d(e, t);
        });
      }(M, this.props.accept);
      var D = L > 0 && (!A || !R);
      var N = !S && !O && !x && !w && !k && !T;
      if (I && r) {
        S += " " + r;
      }
      if (A && n) {
        S += " " + n;
      }
      if (D && v) {
        S += " " + v;
      }
      if (a && s) {
        S += " " + s;
      }
      if (N) {
        x = m;
        w = (O = y).active;
        k = p;
        T = h;
      }
      var j = g({}, O);
      if (x && I) {
        j = g({}, O, x);
      }
      if (w && A) {
        j = g({}, j, w);
      }
      if (k && D) {
        j = g({}, j, k);
      }
      if (T && a) {
        j = g({}, O, T);
      }
      var F = {
        accept: t,
        disabled: a,
        type: "file",
        style: {
          display: "none"
        },
        multiple: u && c,
        ref: this.setRefs,
        onChange: this.onDrop,
        autoComplete: "off"
      };
      if (f && f.length) {
        F.name = f;
      }
      P.acceptedFiles;
      P.preventDropOnDocument;
      P.disablePreview;
      P.disableClick;
      P.onDropAccepted;
      P.onDropRejected;
      P.onFileDialogCancel;
      P.maxSize;
      P.minSize;
      var B = b(P, ["acceptedFiles", "preventDropOnDocument", "disablePreview", "disableClick", "onDropAccepted", "onDropRejected", "onFileDialogCancel", "maxSize", "minSize"]);
      return i.createElement("div", g({
        className: S,
        style: j
      }, B, {
        onClick: this.composeHandlers(this.onClick),
        onDragStart: this.composeHandlers(this.onDragStart),
        onDragEnter: this.composeHandlers(this.onDragEnter),
        onDragOver: this.composeHandlers(this.onDragOver),
        onDragLeave: this.composeHandlers(this.onDragLeave),
        onDrop: this.composeHandlers(this.onDrop),
        ref: this.setRef,
        "aria-disabled": a
      }), this.renderChildren(o, I, A, D), i.createElement("input", g({}, l, F)));
    }
  }]);
  return t;
}();
exports.default = _;
_.propTypes = {
  accept: a.string,
  children: a.oneOfType([a.node, a.func]),
  disableClick: a.bool,
  disabled: a.bool,
  disablePreview: a.bool,
  preventDropOnDocument: a.bool,
  inputProps: a.object,
  multiple: a.bool,
  name: a.string,
  maxSize: a.number,
  minSize: a.number,
  className: a.string,
  activeClassName: a.string,
  acceptClassName: a.string,
  rejectClassName: a.string,
  disabledClassName: a.string,
  style: a.object,
  activeStyle: a.object,
  acceptStyle: a.object,
  rejectStyle: a.object,
  disabledStyle: a.object,
  onClick: a.func,
  onDrop: a.func,
  onDropAccepted: a.func,
  onDropRejected: a.func,
  onDragStart: a.func,
  onDragEnter: a.func,
  onDragOver: a.func,
  onDragLeave: a.func,
  onFileDialogCancel: a.func
};
_.defaultProps = {
  preventDropOnDocument: true,
  disabled: false,
  disablePreview: false,
  disableClick: false,
  multiple: true,
  maxSize: Infinity,
  minSize: 0
};