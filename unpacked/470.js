module.exports = function () {
  var e = ["bubbles", "cancelable", "view", "detail", "screenX", "screenY", "clientX", "clientY", "ctrlKey", "altKey", "shiftKey", "metaKey", "button", "relatedTarget", "pageX", "pageY"];
  var t = [false, false, null, null, 0, 0, 0, 0, false, false, false, false, 0, null, 0, 0];
  function n(n, r) {
    r = r || Object.create(null);
    var i = document.createEvent("Event");
    i.initEvent(n, r.bubbles || false, r.cancelable || false);
    var o;
    for (var a = 2; a < e.length; a++) {
      o = e[a];
      i[o] = r[o] || t[a];
    }
    i.buttons = r.buttons || 0;
    var s = 0;
    s = r.pressure && i.buttons ? r.pressure : i.buttons ? 0.5 : 0;
    i.x = i.clientX;
    i.y = i.clientY;
    i.pointerId = r.pointerId || 0;
    i.width = r.width || 0;
    i.height = r.height || 0;
    i.pressure = s;
    i.tiltX = r.tiltX || 0;
    i.tiltY = r.tiltY || 0;
    i.twist = r.twist || 0;
    i.tangentialPressure = r.tangentialPressure || 0;
    i.pointerType = r.pointerType || "";
    i.hwTimestamp = r.hwTimestamp || 0;
    i.isPrimary = r.isPrimary || false;
    return i;
  }
  var r = window.Map && window.Map.prototype.forEach ? Map : i;
  function i() {
    this.array = [];
    this.size = 0;
  }
  i.prototype = {
    set: function (e, t) {
      if (t === undefined) {
        return this.delete(e);
      }
      if (!this.has(e)) {
        this.size++;
      }
      this.array[e] = t;
    },
    has: function (e) {
      return this.array[e] !== undefined;
    },
    delete: function (e) {
      if (this.has(e)) {
        delete this.array[e];
        this.size--;
      }
    },
    get: function (e) {
      return this.array[e];
    },
    clear: function () {
      this.array.length = 0;
      this.size = 0;
    },
    forEach: function (e, t) {
      return this.array.forEach(function (n, r) {
        e.call(t, n, r, this);
      }, this);
    }
  };
  var o = ["bubbles", "cancelable", "view", "detail", "screenX", "screenY", "clientX", "clientY", "ctrlKey", "altKey", "shiftKey", "metaKey", "button", "relatedTarget", "buttons", "pointerId", "width", "height", "pressure", "tiltX", "tiltY", "pointerType", "hwTimestamp", "isPrimary", "type", "target", "currentTarget", "which", "pageX", "pageY", "timeStamp"];
  var a = [false, false, null, null, 0, 0, 0, 0, false, false, false, false, 0, null, 0, 0, 0, 0, 0, 0, 0, "", 0, false, "", null, null, 0, 0, 0, 0];
  var s = {
    pointerover: 1,
    pointerout: 1,
    pointerenter: 1,
    pointerleave: 1
  };
  var l = typeof SVGElementInstance != "undefined";
  var u = {
    pointermap: new r(),
    eventMap: Object.create(null),
    captureInfo: Object.create(null),
    eventSources: Object.create(null),
    eventSourceList: [],
    registerSource: function (e, t) {
      var n = t;
      var r = n.events;
      if (r) {
        r.forEach(function (e) {
          if (n[e]) {
            this.eventMap[e] = n[e].bind(n);
          }
        }, this);
        this.eventSources[e] = n;
        this.eventSourceList.push(n);
      }
    },
    register: function (e) {
      for (var t, n = this.eventSourceList.length, r = 0; r < n && (t = this.eventSourceList[r]); r++) {
        t.register.call(t, e);
      }
    },
    unregister: function (e) {
      for (var t, n = this.eventSourceList.length, r = 0; r < n && (t = this.eventSourceList[r]); r++) {
        t.unregister.call(t, e);
      }
    },
    contains: function (e, t) {
      try {
        return e.contains(t);
      } catch (e) {
        return false;
      }
    },
    down: function (e) {
      e.bubbles = true;
      this.fireEvent("pointerdown", e);
    },
    move: function (e) {
      e.bubbles = true;
      this.fireEvent("pointermove", e);
    },
    up: function (e) {
      e.bubbles = true;
      this.fireEvent("pointerup", e);
    },
    enter: function (e) {
      e.bubbles = false;
      this.fireEvent("pointerenter", e);
    },
    leave: function (e) {
      e.bubbles = false;
      this.fireEvent("pointerleave", e);
    },
    over: function (e) {
      e.bubbles = true;
      this.fireEvent("pointerover", e);
    },
    out: function (e) {
      e.bubbles = true;
      this.fireEvent("pointerout", e);
    },
    cancel: function (e) {
      e.bubbles = true;
      this.fireEvent("pointercancel", e);
    },
    leaveOut: function (e) {
      this.out(e);
      this.propagate(e, this.leave, false);
    },
    enterOver: function (e) {
      this.over(e);
      this.propagate(e, this.enter, true);
    },
    eventHandler: function (e) {
      if (!e._handledByPE) {
        var t = e.type;
        var n = this.eventMap && this.eventMap[t];
        if (n) {
          n(e);
        }
        e._handledByPE = true;
      }
    },
    listen: function (e, t) {
      t.forEach(function (t) {
        this.addEvent(e, t);
      }, this);
    },
    unlisten: function (e, t) {
      t.forEach(function (t) {
        this.removeEvent(e, t);
      }, this);
    },
    addEvent: function (e, t) {
      e.addEventListener(t, this.boundHandler);
    },
    removeEvent: function (e, t) {
      e.removeEventListener(t, this.boundHandler);
    },
    makeEvent: function (e, t) {
      if (this.captureInfo[t.pointerId]) {
        t.relatedTarget = null;
      }
      var r = new n(e, t);
      if (t.preventDefault) {
        r.preventDefault = t.preventDefault;
      }
      r._target = r._target || t.target;
      return r;
    },
    fireEvent: function (e, t) {
      var n = this.makeEvent(e, t);
      return this.dispatchEvent(n);
    },
    cloneEvent: function (e) {
      var t;
      var n = Object.create(null);
      for (var r = 0; r < o.length; r++) {
        n[t = o[r]] = e[t] || a[r];
        if (!!l && (t === "target" || t === "relatedTarget")) {
          if (n[t] instanceof SVGElementInstance) {
            n[t] = n[t].correspondingUseElement;
          }
        }
      }
      if (e.preventDefault) {
        n.preventDefault = function () {
          e.preventDefault();
        };
      }
      return n;
    },
    getTarget: function (e) {
      var t = this.captureInfo[e.pointerId];
      if (t) {
        if (e._target !== t && e.type in s) {
          return undefined;
        } else {
          return t;
        }
      } else {
        return e._target;
      }
    },
    propagate: function (e, t, n) {
      for (var r = e.target, i = []; r != null && r !== document && !r.contains(e.relatedTarget);) {
        i.push(r);
        if (!(r = r.parentNode)) {
          return;
        }
      }
      if (n) {
        i.reverse();
      }
      i.forEach(function (n) {
        e.target = n;
        t.call(this, e);
      }, this);
    },
    setCapture: function (e, t, r) {
      if (this.captureInfo[e]) {
        this.releaseCapture(e, r);
      }
      this.captureInfo[e] = t;
      this.implicitRelease = this.releaseCapture.bind(this, e, r);
      document.addEventListener("pointerup", this.implicitRelease);
      document.addEventListener("pointercancel", this.implicitRelease);
      var i = new n("gotpointercapture");
      i.pointerId = e;
      i._target = t;
      if (!r) {
        this.asyncDispatchEvent(i);
      }
    },
    releaseCapture: function (e, t) {
      var r = this.captureInfo[e];
      if (r) {
        this.captureInfo[e] = undefined;
        document.removeEventListener("pointerup", this.implicitRelease);
        document.removeEventListener("pointercancel", this.implicitRelease);
        var i = new n("lostpointercapture");
        i.pointerId = e;
        i._target = r;
        if (!t) {
          this.asyncDispatchEvent(i);
        }
      }
    },
    dispatchEvent: function (e) {
      var t = this.getTarget(e);
      if (t) {
        return t.dispatchEvent(e);
      }
    },
    asyncDispatchEvent: function (e) {
      requestAnimationFrame(this.dispatchEvent.bind(this, e));
    }
  };
  u.boundHandler = u.eventHandler.bind(u);
  var c = {
    shadow: function (e) {
      if (e) {
        return e.shadowRoot || e.webkitShadowRoot;
      }
    },
    canTarget: function (e) {
      return e && Boolean(e.elementFromPoint);
    },
    targetingShadow: function (e) {
      var t = this.shadow(e);
      if (this.canTarget(t)) {
        return t;
      }
    },
    olderShadow: function (e) {
      var t = e.olderShadowRoot;
      if (!t) {
        var n = e.querySelector("shadow");
        if (n) {
          t = n.olderShadowRoot;
        }
      }
      return t;
    },
    allShadows: function (e) {
      var t = [];
      for (var n = this.shadow(e); n;) {
        t.push(n);
        n = this.olderShadow(n);
      }
      return t;
    },
    searchRoot: function (e, t, n) {
      if (e) {
        var r;
        var i;
        var o = e.elementFromPoint(t, n);
        for (i = this.targetingShadow(o); i;) {
          if (r = i.elementFromPoint(t, n)) {
            var a = this.targetingShadow(r);
            return this.searchRoot(a, t, n) || r;
          }
          i = this.olderShadow(i);
        }
        return o;
      }
    },
    owner: function (e) {
      for (var t = e; t.parentNode;) {
        t = t.parentNode;
      }
      if (t.nodeType !== Node.DOCUMENT_NODE && t.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
        t = document;
      }
      return t;
    },
    findTarget: function (e) {
      var t = e.clientX;
      var n = e.clientY;
      var r = this.owner(e.target);
      if (!r.elementFromPoint(t, n)) {
        r = document;
      }
      return this.searchRoot(r, t, n);
    }
  };
  var d = Array.prototype.forEach.call.bind(Array.prototype.forEach);
  var f = Array.prototype.map.call.bind(Array.prototype.map);
  var p = Array.prototype.slice.call.bind(Array.prototype.slice);
  var h = Array.prototype.filter.call.bind(Array.prototype.filter);
  var m = window.MutationObserver || window.WebKitMutationObserver;
  var y = {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["touch-action"]
  };
  function g(e, t, n, r) {
    this.addCallback = e.bind(r);
    this.removeCallback = t.bind(r);
    this.changedCallback = n.bind(r);
    if (m) {
      this.observer = new m(this.mutationWatcher.bind(this));
    }
  }
  function v(e) {
    return "body /shadow-deep/ " + b(e);
  }
  function b(e) {
    return "[touch-action=\"" + e + "\"]";
  }
  function _(e) {
    return "{ -ms-touch-action: " + e + "; touch-action: " + e + "; }";
  }
  g.prototype = {
    watchSubtree: function (e) {
      if (this.observer && c.canTarget(e)) {
        this.observer.observe(e, y);
      }
    },
    enableOnSubtree: function (e) {
      this.watchSubtree(e);
      if (e === document && document.readyState !== "complete") {
        this.installOnLoad();
      } else {
        this.installNewSubtree(e);
      }
    },
    installNewSubtree: function (e) {
      d(this.findElements(e), this.addElement, this);
    },
    findElements: function (e) {
      if (e.querySelectorAll) {
        return e.querySelectorAll("[touch-action]");
      } else {
        return [];
      }
    },
    removeElement: function (e) {
      this.removeCallback(e);
    },
    addElement: function (e) {
      this.addCallback(e);
    },
    elementChanged: function (e, t) {
      this.changedCallback(e, t);
    },
    concatLists: function (e, t) {
      return e.concat(p(t));
    },
    installOnLoad: function () {
      document.addEventListener("readystatechange", function () {
        if (document.readyState === "complete") {
          this.installNewSubtree(document);
        }
      }.bind(this));
    },
    isElement: function (e) {
      return e.nodeType === Node.ELEMENT_NODE;
    },
    flattenMutationTree: function (e) {
      var t = f(e, this.findElements, this);
      t.push(h(e, this.isElement));
      return t.reduce(this.concatLists, []);
    },
    mutationWatcher: function (e) {
      e.forEach(this.mutationHandler, this);
    },
    mutationHandler: function (e) {
      if (e.type === "childList") {
        var t = this.flattenMutationTree(e.addedNodes);
        t.forEach(this.addElement, this);
        var n = this.flattenMutationTree(e.removedNodes);
        n.forEach(this.removeElement, this);
      } else if (e.type === "attributes") {
        this.elementChanged(e.target, e.oldValue);
      }
    }
  };
  var w = ["none", "auto", "pan-x", "pan-y", {
    rule: "pan-x pan-y",
    selectors: ["pan-x pan-y", "pan-y pan-x"]
  }];
  var x = "";
  var E = window.PointerEvent || window.MSPointerEvent;
  var S = !window.ShadowDOMPolyfill && document.head.createShadowRoot;
  var T = u.pointermap;
  var k = [1, 4, 2, 8, 16];
  var O = false;
  try {
    O = new MouseEvent("test", {
      buttons: 1
    }).buttons === 1;
  } catch (e) {}
  var P;
  var C = {
    POINTER_ID: 1,
    POINTER_TYPE: "mouse",
    events: ["mousedown", "mousemove", "mouseup", "mouseover", "mouseout"],
    register: function (e) {
      u.listen(e, this.events);
    },
    unregister: function (e) {
      u.unlisten(e, this.events);
    },
    lastTouches: [],
    isEventSimulatedFromTouch: function (e) {
      for (var t, n = this.lastTouches, r = e.clientX, i = e.clientY, o = 0, a = n.length; o < a && (t = n[o]); o++) {
        var s = Math.abs(r - t.x);
        var l = Math.abs(i - t.y);
        if (s <= 25 && l <= 25) {
          return true;
        }
      }
    },
    prepareEvent: function (e) {
      var t = u.cloneEvent(e);
      var n = t.preventDefault;
      t.preventDefault = function () {
        e.preventDefault();
        n();
      };
      t.pointerId = this.POINTER_ID;
      t.isPrimary = true;
      t.pointerType = this.POINTER_TYPE;
      return t;
    },
    prepareButtonsForMove: function (e, t) {
      var n = T.get(this.POINTER_ID);
      if (t.which !== 0 && n) {
        e.buttons = n.buttons;
      } else {
        e.buttons = 0;
      }
      t.buttons = e.buttons;
    },
    mousedown: function (e) {
      if (!this.isEventSimulatedFromTouch(e)) {
        var t = T.get(this.POINTER_ID);
        var n = this.prepareEvent(e);
        if (!O) {
          n.buttons = k[n.button];
          if (t) {
            n.buttons |= t.buttons;
          }
          e.buttons = n.buttons;
        }
        T.set(this.POINTER_ID, e);
        if (t && t.buttons !== 0) {
          u.move(n);
        } else {
          u.down(n);
        }
      }
    },
    mousemove: function (e) {
      if (!this.isEventSimulatedFromTouch(e)) {
        var t = this.prepareEvent(e);
        if (!O) {
          this.prepareButtonsForMove(t, e);
        }
        t.button = -1;
        T.set(this.POINTER_ID, e);
        u.move(t);
      }
    },
    mouseup: function (e) {
      if (!this.isEventSimulatedFromTouch(e)) {
        var t = T.get(this.POINTER_ID);
        var n = this.prepareEvent(e);
        if (!O) {
          var r = k[n.button];
          n.buttons = t ? t.buttons & ~r : 0;
          e.buttons = n.buttons;
        }
        T.set(this.POINTER_ID, e);
        n.buttons &= ~k[n.button];
        if (n.buttons === 0) {
          u.up(n);
        } else {
          u.move(n);
        }
      }
    },
    mouseover: function (e) {
      if (!this.isEventSimulatedFromTouch(e)) {
        var t = this.prepareEvent(e);
        if (!O) {
          this.prepareButtonsForMove(t, e);
        }
        t.button = -1;
        T.set(this.POINTER_ID, e);
        u.enterOver(t);
      }
    },
    mouseout: function (e) {
      if (!this.isEventSimulatedFromTouch(e)) {
        var t = this.prepareEvent(e);
        if (!O) {
          this.prepareButtonsForMove(t, e);
        }
        t.button = -1;
        u.leaveOut(t);
      }
    },
    cancel: function (e) {
      var t = this.prepareEvent(e);
      u.cancel(t);
      this.deactivateMouse();
    },
    deactivateMouse: function () {
      T.delete(this.POINTER_ID);
    }
  };
  var I = u.captureInfo;
  var M = c.findTarget.bind(c);
  var L = c.allShadows.bind(c);
  var R = u.pointermap;
  var A = {
    events: ["touchstart", "touchmove", "touchend", "touchcancel"],
    register: function (e) {
      P.enableOnSubtree(e);
    },
    unregister: function () {},
    elementAdded: function (e) {
      var t = e.getAttribute("touch-action");
      var n = this.touchActionToScrollType(t);
      if (n) {
        e._scrollType = n;
        u.listen(e, this.events);
        L(e).forEach(function (e) {
          e._scrollType = n;
          u.listen(e, this.events);
        }, this);
      }
    },
    elementRemoved: function (e) {
      e._scrollType = undefined;
      u.unlisten(e, this.events);
      L(e).forEach(function (e) {
        e._scrollType = undefined;
        u.unlisten(e, this.events);
      }, this);
    },
    elementChanged: function (e, t) {
      var n = e.getAttribute("touch-action");
      var r = this.touchActionToScrollType(n);
      var i = this.touchActionToScrollType(t);
      if (r && i) {
        e._scrollType = r;
        L(e).forEach(function (e) {
          e._scrollType = r;
        }, this);
      } else if (i) {
        this.elementRemoved(e);
      } else if (r) {
        this.elementAdded(e);
      }
    },
    scrollTypes: {
      EMITTER: "none",
      XSCROLLER: "pan-x",
      YSCROLLER: "pan-y",
      SCROLLER: /^(?:pan-x pan-y)|(?:pan-y pan-x)|auto$/
    },
    touchActionToScrollType: function (e) {
      var t = e;
      var n = this.scrollTypes;
      if (t === "none") {
        return "none";
      } else if (t === n.XSCROLLER) {
        return "X";
      } else if (t === n.YSCROLLER) {
        return "Y";
      } else if (n.SCROLLER.exec(t)) {
        return "XY";
      } else {
        return undefined;
      }
    },
    POINTER_TYPE: "touch",
    firstTouch: null,
    isPrimaryTouch: function (e) {
      return this.firstTouch === e.identifier;
    },
    setPrimaryTouch: function (e) {
      if (R.size === 0 || R.size === 1 && R.has(1)) {
        this.firstTouch = e.identifier;
        this.firstXY = {
          X: e.clientX,
          Y: e.clientY
        };
        this.scrolling = false;
        this.cancelResetClickCount();
      }
    },
    removePrimaryPointer: function (e) {
      if (e.isPrimary) {
        this.firstTouch = null;
        this.firstXY = null;
        this.resetClickCount();
      }
    },
    clickCount: 0,
    resetId: null,
    resetClickCount: function () {
      var e = function () {
        this.clickCount = 0;
        this.resetId = null;
      }.bind(this);
      this.resetId = setTimeout(e, 200);
    },
    cancelResetClickCount: function () {
      if (this.resetId) {
        clearTimeout(this.resetId);
      }
    },
    typeToButtons: function (e) {
      var t = 0;
      if (e === "touchstart" || e === "touchmove") {
        t = 1;
      }
      return t;
    },
    touchToPointer: function (e) {
      var t = this.currentTouchEvent;
      var n = u.cloneEvent(e);
      var r = n.pointerId = e.identifier + 2;
      n.target = I[r] || M(n);
      n.bubbles = true;
      n.cancelable = true;
      n.detail = this.clickCount;
      n.button = 0;
      n.buttons = this.typeToButtons(t.type);
      n.width = (e.radiusX || e.webkitRadiusX || 0) * 2;
      n.height = (e.radiusY || e.webkitRadiusY || 0) * 2;
      n.pressure = e.force || e.webkitForce || 0.5;
      n.isPrimary = this.isPrimaryTouch(e);
      n.pointerType = this.POINTER_TYPE;
      n.altKey = t.altKey;
      n.ctrlKey = t.ctrlKey;
      n.metaKey = t.metaKey;
      n.shiftKey = t.shiftKey;
      var i = this;
      n.preventDefault = function () {
        i.scrolling = false;
        i.firstXY = null;
        t.preventDefault();
      };
      return n;
    },
    processTouches: function (e, t) {
      var n = e.changedTouches;
      this.currentTouchEvent = e;
      var r;
      for (var i = 0; i < n.length; i++) {
        r = n[i];
        t.call(this, this.touchToPointer(r));
      }
    },
    shouldScroll: function (e) {
      if (this.firstXY) {
        var t;
        var n = e.currentTarget._scrollType;
        if (n === "none") {
          t = false;
        } else if (n === "XY") {
          t = true;
        } else {
          var r = e.changedTouches[0];
          var i = n;
          var o = n === "Y" ? "X" : "Y";
          var a = Math.abs(r["client" + i] - this.firstXY[i]);
          var s = Math.abs(r["client" + o] - this.firstXY[o]);
          t = a >= s;
        }
        this.firstXY = null;
        return t;
      }
    },
    findTouch: function (e, t) {
      for (var n, r = 0, i = e.length; r < i && (n = e[r]); r++) {
        if (n.identifier === t) {
          return true;
        }
      }
    },
    vacuumTouches: function (e) {
      var t = e.touches;
      if (R.size >= t.length) {
        var n = [];
        R.forEach(function (e, r) {
          if (r !== 1 && !this.findTouch(t, r - 2)) {
            var i = e.out;
            n.push(i);
          }
        }, this);
        n.forEach(this.cancelOut, this);
      }
    },
    touchstart: function (e) {
      this.vacuumTouches(e);
      this.setPrimaryTouch(e.changedTouches[0]);
      this.dedupSynthMouse(e);
      if (!this.scrolling) {
        this.clickCount++;
        this.processTouches(e, this.overDown);
      }
    },
    overDown: function (e) {
      R.set(e.pointerId, {
        target: e.target,
        out: e,
        outTarget: e.target
      });
      u.enterOver(e);
      u.down(e);
    },
    touchmove: function (e) {
      if (!this.scrolling) {
        if (this.shouldScroll(e)) {
          this.scrolling = true;
          this.touchcancel(e);
        } else {
          e.preventDefault();
          this.processTouches(e, this.moveOverOut);
        }
      }
    },
    moveOverOut: function (e) {
      var t = e;
      var n = R.get(t.pointerId);
      if (n) {
        var r = n.out;
        var i = n.outTarget;
        u.move(t);
        if (r && i !== t.target) {
          r.relatedTarget = t.target;
          t.relatedTarget = i;
          r.target = i;
          if (t.target) {
            u.leaveOut(r);
            u.enterOver(t);
          } else {
            t.target = i;
            t.relatedTarget = null;
            this.cancelOut(t);
          }
        }
        n.out = t;
        n.outTarget = t.target;
      }
    },
    touchend: function (e) {
      this.dedupSynthMouse(e);
      this.processTouches(e, this.upOut);
    },
    upOut: function (e) {
      if (!this.scrolling) {
        u.up(e);
        u.leaveOut(e);
      }
      this.cleanUpPointer(e);
    },
    touchcancel: function (e) {
      this.processTouches(e, this.cancelOut);
    },
    cancelOut: function (e) {
      u.cancel(e);
      u.leaveOut(e);
      this.cleanUpPointer(e);
    },
    cleanUpPointer: function (e) {
      R.delete(e.pointerId);
      this.removePrimaryPointer(e);
    },
    dedupSynthMouse: function (e) {
      var t = C.lastTouches;
      var n = e.changedTouches[0];
      if (this.isPrimaryTouch(n)) {
        var r = {
          x: n.clientX,
          y: n.clientY
        };
        t.push(r);
        var i = function (e, t) {
          var n = e.indexOf(t);
          if (n > -1) {
            e.splice(n, 1);
          }
        }.bind(null, t, r);
        setTimeout(i, 2500);
      }
    }
  };
  P = new g(A.elementAdded, A.elementRemoved, A.elementChanged, A);
  var D;
  var N;
  var j;
  var F = u.pointermap;
  var B = window.MSPointerEvent && typeof window.MSPointerEvent.MSPOINTER_TYPE_MOUSE == "number";
  var U = {
    events: ["MSPointerDown", "MSPointerMove", "MSPointerUp", "MSPointerOut", "MSPointerOver", "MSPointerCancel", "MSGotPointerCapture", "MSLostPointerCapture"],
    register: function (e) {
      u.listen(e, this.events);
    },
    unregister: function (e) {
      u.unlisten(e, this.events);
    },
    POINTER_TYPES: ["", "unavailable", "touch", "pen", "mouse"],
    prepareEvent: function (e) {
      var t = e;
      if (B) {
        (t = u.cloneEvent(e)).pointerType = this.POINTER_TYPES[e.pointerType];
      }
      return t;
    },
    cleanup: function (e) {
      F.delete(e);
    },
    MSPointerDown: function (e) {
      F.set(e.pointerId, e);
      var t = this.prepareEvent(e);
      u.down(t);
    },
    MSPointerMove: function (e) {
      var t = this.prepareEvent(e);
      u.move(t);
    },
    MSPointerUp: function (e) {
      var t = this.prepareEvent(e);
      u.up(t);
      this.cleanup(e.pointerId);
    },
    MSPointerOut: function (e) {
      var t = this.prepareEvent(e);
      u.leaveOut(t);
    },
    MSPointerOver: function (e) {
      var t = this.prepareEvent(e);
      u.enterOver(t);
    },
    MSPointerCancel: function (e) {
      var t = this.prepareEvent(e);
      u.cancel(t);
      this.cleanup(e.pointerId);
    },
    MSLostPointerCapture: function (e) {
      var t = u.makeEvent("lostpointercapture", e);
      u.dispatchEvent(t);
    },
    MSGotPointerCapture: function (e) {
      var t = u.makeEvent("gotpointercapture", e);
      u.dispatchEvent(t);
    }
  };
  function z(e) {
    if (!u.pointermap.has(e)) {
      var t = new Error("InvalidPointerId");
      t.name = "InvalidPointerId";
      throw t;
    }
  }
  function H(e) {
    for (var t = e.parentNode; t && t !== e.ownerDocument;) {
      t = t.parentNode;
    }
    if (!t) {
      var n = new Error("InvalidStateError");
      n.name = "InvalidStateError";
      throw n;
    }
  }
  function V(e) {
    var t = u.pointermap.get(e);
    return t.buttons !== 0;
  }
  if (window.navigator.msPointerEnabled) {
    D = function (e) {
      z(e);
      H(this);
      if (V(e)) {
        u.setCapture(e, this, true);
        this.msSetPointerCapture(e);
      }
    };
    N = function (e) {
      z(e);
      u.releaseCapture(e, true);
      this.msReleasePointerCapture(e);
    };
  } else {
    D = function (e) {
      z(e);
      H(this);
      if (V(e)) {
        u.setCapture(e, this);
      }
    };
    N = function (e) {
      z(e);
      u.releaseCapture(e);
    };
  }
  j = function (e) {
    return !!u.captureInfo[e];
  };
  (function () {
    if (E) {
      w.forEach(function (e) {
        if (String(e) === e) {
          x += b(e) + _(e) + "\n";
          if (S) {
            x += v(e) + _(e) + "\n";
          }
        } else {
          x += e.selectors.map(b) + _(e.rule) + "\n";
          if (S) {
            x += e.selectors.map(v) + _(e.rule) + "\n";
          }
        }
      });
      var e = document.createElement("style");
      e.textContent = x;
      document.head.appendChild(e);
    }
  })();
  (function () {
    if (!window.PointerEvent) {
      window.PointerEvent = n;
      if (window.navigator.msPointerEnabled) {
        var e = window.navigator.msMaxTouchPoints;
        Object.defineProperty(window.navigator, "maxTouchPoints", {
          value: e,
          enumerable: true
        });
        u.registerSource("ms", U);
      } else {
        Object.defineProperty(window.navigator, "maxTouchPoints", {
          value: 0,
          enumerable: true
        });
        u.registerSource("mouse", C);
        if (window.ontouchstart !== undefined) {
          u.registerSource("touch", A);
        }
      }
      u.register(document);
    }
  })();
  if (window.Element && !Element.prototype.setPointerCapture) {
    Object.defineProperties(Element.prototype, {
      setPointerCapture: {
        value: D
      },
      releasePointerCapture: {
        value: N
      },
      hasPointerCapture: {
        value: j
      }
    });
  }
  return {
    dispatcher: u,
    Installer: g,
    PointerEvent: n,
    PointerMap: r,
    targetFinding: c
  };
}();