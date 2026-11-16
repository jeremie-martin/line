// A caption: a word or two near the lower edge of the picture, for a film that is shown beside another (then and now). Drawn
// last, in the theme's ink of that frame, so it reads on any theme and through a change of theme; no hit effect touches it.
// Design pixels of the 1080 × 1920 frame; ctx is already scaled to them. Pure: the same call draws it on any 2D canvas.
export function drawCaption(ctx, text, colour) {
  ctx.save();
  ctx.font = '800 50px "Helvetica Neue", Helvetica, Arial, sans-serif'; ctx.letterSpacing = '7px';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = colour;
  ctx.fillText(text.toUpperCase(), 540 + 3.5, 1776); // half the last letter's spacing, so the word is centred
  ctx.restore();
}
