import {inspectRailContacts} from '../contacts.ts';
export {selectGuideAlternative} from '../../v0/optimizer/arc_guide_choice.ts';
// These are the mirror's actual Canvas drawing and sprite-mapping functions.
// Keep them unmodified; the surrounding gallery owns only loading and cameras.
const {render:drawLines}=require('native:805');
const {render:drawSprites,setupSprites}=require('native:806');
const {SpriteSheet}=require('native:206');
const EntityGenerator=require('native:823');
let sheetPromise;
export function loadRider(){
  return sheetPromise??=(async()=>{
    const url='/mirror/_v2153.0/bosh-sprite.svg';
    const response=await fetch(url);if(!response.ok)throw new Error(`Cannot load Bosh artwork: ${response.status}`);
    const text=await response.text(),dom=new DOMParser().parseFromString(text,'image/svg+xml');
    if(dom.querySelector('parsererror'))throw new Error('Invalid Bosh artwork');
    const image=new Image();
    image.width=Number(dom.documentElement.getAttribute('width'));image.height=Number(dom.documentElement.getAttribute('height'));
    const blob=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));
    try {image.src=blob;await image.decode();}finally{URL.revokeObjectURL(blob);}
    return setupSprites({spriteSvg:new SpriteSheet(url,dom,image),hq:true});
  })().catch(error=>{sheetPromise=undefined;throw error;});
}
// Same interpolation of points and state counters as mirror module 506.
// Gallery tracks contain one rider, so there is no cross-rider sled exchange.
export function riderAt(frames,at){
  const clamped=Math.max(0,Math.min(at,frames.length-1)),index=Math.floor(clamped),t=clamped-index;
  const a=frames[index],b=frames[Math.min(index+1,frames.length-1)];
  if(!t)return a;
  const mix=(a,b)=>a+(b-a)*t;
  return {points:a.points.map((p,i)=>({name:p.name,pos:{x:mix(p.pos.x,b.points[i].pos.x),y:mix(p.pos.y,b.points[i].pos.y)}})),
    framesSinceUnmount:mix(a.framesSinceUnmount,b.framesSinceUnmount),framesSinceSledBreak:mix(a.framesSinceSledBreak,b.framesSinceSledBreak),framesSinceStringDetached:mix(a.framesSinceStringDetached,b.framesSinceStringDetached)};
}
export function createView(record,native,sheet){
  const {track}=record,{frames,contacts}=native;
  if(contacts.length!==frames.length)throw new Error('Incomplete collision replay');
  const inspection=inspectRailContacts(record,contacts);
  const lines=track.lines.map(l=>({...l,p1:{x:l.x1,y:l.y1},p2:{x:l.x2,y:l.y2}}));
  const generator=new EntityGenerator(0),overlay=document.createElement('canvas');
  const byId=new Map(lines.map(line=>[line.id,line]));
  const highlight=(context,camera,ids,color)=>{
    const scale=camera.z*camera.r;
    context.setTransform(scale,0,0,scale,camera.w*camera.r/2-camera.x*scale,camera.h*camera.r/2-camera.y*scale);
    context.lineWidth=2;context.lineCap='round';context.strokeStyle=color;context.beginPath();
    for(const id of ids){const l=byId.get(id);context.moveTo(l.x1,l.y1);context.lineTo(l.x2,l.y2);}
    context.stroke();context.setTransform(1,0,0,1,0,0);
  };
  return {inspection,draw(canvas,camera,at,inspect=false){
    const frame=Math.max(0,Math.min(at,frames.length-1));
    const entity=generator.makeRider({getRawRiders:()=>[riderAt(frames,frame)]},undefined,frame,1);
    const width=Math.round(camera.w*camera.r),height=Math.round(camera.h*camera.r);
    if(width<=0||height<=0)return; // Detached or hidden comparison panel.
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    if(overlay.width!==width||overlay.height!==height){overlay.width=width;overlay.height=height;}
    const context=canvas.getContext('2d');
    drawLines(context,camera,{color:false},lines);
    if(inspect)highlight(context,camera,inspection.guideIds,'#2468ba');
    drawSprites(overlay.getContext('2d'),camera,sheet,[entity]);
    context.setTransform(1,0,0,1,0,0);context.globalAlpha=1;context.drawImage(overlay,0,0);
    // Keep the collided segments visible even when Bosh's artwork covers them.
    if(inspect)highlight(context,camera,inspection.byFrame[Math.floor(frame)].all,'#d35400');
  }};
}
