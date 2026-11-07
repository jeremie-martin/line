// The vendored Line Rider rider artwork, sprite mapping and follow camera,
// unchanged, exposed for the concept lab. Physics replay uses the gallery worker.
import {loadSpriteSheet} from '../../../scripts/gallery/native/sprites.js';
import {bodyCentre, createCamera} from '../../../scripts/gallery/native/camera.js';
const {render: drawSprites, setupSprites} = require('native:806');
const EntityGenerator = require('native:823');
const followStep = require('native:560');

export async function loadSheet() {
  return setupSprites({spriteSvg: await loadSpriteSheet(), hq: false});
}
export function follower(traceFrames) {
  return createCamera(followStep, traceFrames.map(bodyCentre));
}
export function riderPainter() {
  const generator = new EntityGenerator(0);
  // camera {x,y,z,w,h,r}; drawSprites clears `context` before drawing.
  return (context, camera, sheet, rider, frame) => {
    const entity = generator.makeRider({getRawRiders: () => [rider]}, undefined, frame, 1);
    drawSprites(context, camera, sheet, [entity]);
  };
}
