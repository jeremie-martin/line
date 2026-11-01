/** Player shortcuts leave editable fields and native interactive controls alone. */
export function playerShortcut(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('input,textarea,select,button,a,summary,video,[role="textbox"],[role="slider"]')) return;
  if (event.code === 'Space' || event.key === ' ') return {type: event.repeat ? 'ignore' : 'toggle'};
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    return {type: 'seek', delta: (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 1 : 5)};
}
