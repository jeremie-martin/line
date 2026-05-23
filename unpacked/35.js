Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getCommandHotkeys = e => e.command.hotkeys;
exports.getTriggerCounts = (e, t) => e.command.triggerCounts.get(t, 0);
const r = exports.getModifier = (e, t) => e.command.activeModifiers.has(t);
exports.getModifiersActive = e => !e.command.activeModifiers.isEmpty();
exports.getZoomSliderActive = e => r(e, "modifiers.zoom");
exports.getCommandTags = e => e.command.tags;