import {expect, it} from 'vitest';
import {drawCaption} from '../scripts/video/caption.js';

it('draws a caption once, in capitals, in the colour it is given, and leaves the canvas state as it found it', () => {
  const calls: string[] = [], ctx: any = {save: () => calls.push('save'), restore: () => calls.push('restore'),
    fillText: (text: string, x: number, y: number) => calls.push(`${text}@${x},${y}:${ctx.fillStyle}`)};
  drawCaption(ctx, 'now', '#123456');
  expect(calls).toEqual(['save', 'NOW@543.5,1776:#123456', 'restore']);
});
