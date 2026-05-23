Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.triggerCommand = function (e) {
  return {
    type: r,
    payload: e,
    meta: {
      ignorable: true
    }
  };
};
exports.beginModifierCommand = function (e, t) {
  return {
    type: i,
    payload: e,
    meta: {
      ignorable: true,
      event: t
    }
  };
};
exports.endModifierCommand = function (e) {
  return {
    type: o,
    payload: e,
    meta: {
      ignorable: true
    }
  };
};
exports.toggleModifierCommand = function (e) {
  return {
    type: a,
    payload: e,
    meta: {
      ignorable: true
    }
  };
};
exports.setCommandHotkeys = function (e) {
  return {
    type: s,
    payload: e
  };
};
exports.initCommandHotkeys = function (e) {
  return {
    type: u,
    payload: e
  };
};
exports.restoreDefaultKeys = function () {
  return {
    type: l
  };
};
exports.replaceCtrlKey = function (e) {
  return {
    type: c,
    payload: e
  };
};
const r = exports.TRIGGER_COMMAND = "TRIGGER_COMMAND";
const i = exports.BEGIN_MODIFIER_COMMAND = "BEGIN_MODIFIER_COMMAND";
const o = exports.END_MODIFIER_COMMAND = "END_MODIFIER_COMMAND";
const a = exports.TOGGLE_MODIFIER_COMMAND = "TOGGLE_MODIFIER_COMMAND";
const s = exports.SET_COMMAND_HOTKEYS = "SET_COMMAND_HOTKEYS";
const l = exports.RESTORE_DEFAULT_HOTKEYS = "RESTORE_DEFAULT_HOTKEYS";
const u = exports.INIT_COMMAND_HOTKEYS = "INIT_COMMAND_HOTKEYS";
const c = exports.REPLACE_CTRL_KEY = "REPLACE_CTRL_KEY";