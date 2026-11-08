// The same vendored artwork is shared by live playback and video rendering.
const {SpriteSheet}=require('native:206');
const sheets=new Map();
export function loadSpriteSheet(url='/mirror/_v2153.0/bosh-sprite.svg'){
  if(!sheets.has(url))sheets.set(url,(async()=>{
    const response=await fetch(url);if(!response.ok)throw new Error(`Cannot load Bosh artwork: ${response.status}`);
    const text=await response.text(),dom=new DOMParser().parseFromString(text,'image/svg+xml');
    if(dom.querySelector('parsererror'))throw new Error('Invalid Bosh artwork');
    const image=new Image();
    image.width=Number(dom.documentElement.getAttribute('width'));image.height=Number(dom.documentElement.getAttribute('height'));
    const blob=URL.createObjectURL(new Blob([text],{type:'image/svg+xml'}));
    try{image.src=blob;await image.decode();}finally{URL.revokeObjectURL(blob);}
    return new SpriteSheet(url,dom,image);
  })().catch(error=>{sheets.delete(url);throw error;}));
  return sheets.get(url);
}
