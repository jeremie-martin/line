/** Direct offline rendering with the exporter's vendored drawing and camera code.
 * No editor UI, animation-frame pacing, or browser video encoder. */
import {loadSpriteSheet} from './sprites.js';
const Engine=require('native:505');
const {createLineFromJson}=require('native:502');
const {createInitialScenes}=require('native:365');
const {WebGL1Renderer,Camera}=require('native:168');
const SpriteRenderer=require('native:817');
const Follower=require('native:299');
const EntityGenerator=require('native:823');
const installCameraTools=require('native:633');

function zoomFunction(options){
  if(options.zoomKeyframes?.length){
    // The vendored helper reads only the physics FPS when resolving keyframes.
    const store=window.store;
    try{
      window.store={getState:()=>({player:{settings:{fps:40}}})};
      installCameraTools();
      return window.createZoomer(options.zoomKeyframes,options.zoomSmoothing??0);
    }finally{window.store=store;}
  }
  if(options.autoZoom?.length)return frame=>options.autoZoom[Math.max(0,Math.min(options.autoZoom.length-1,frame|0))];
  return ()=>options.zoom;
}

export async function createVideoView(canvas,options){
  const {track,width,height,fps=60}=options;
  if(track.riders?.length!==1)throw new Error('Video rendering requires one rider');
  if(track.lines.some(line=>line.type!==0||(line.layer??0)!==0))throw new Error('Video rendering requires normal lines on the base layer');
  const engine=new Engine().setRiders(track.riders).addLines(track.lines.map(line=>createLineFromJson({...line})));
  const sheet=await loadSpriteSheet(options.artwork);
  canvas.width=width;canvas.height=height;
  const lines=new WebGL1Renderer(canvas),sprites=new SpriteRenderer(canvas);
  const scene=createInitialScenes(engine.engine.state.lines).playback,generator=new EntityGenerator(0);
  const zoomAt=zoomFunction(options),follow=new Follower();
  // Match mirror/helper.js: follow the mean of all ten rider and sled points.
  follow._getRiderPosition=(track,frame)=>{
    const points=track.getRawRider(frame).points;
    return{x:points.reduce((sum,p)=>sum+p.pos.x,0)/points.length,y:points.reduce((sum,p)=>sum+p.pos.y,0)/points.length};
  };
  const positions=[],previousZoom=window.getAutoZoom;
  try{
    window.getAutoZoom=zoomAt;
    // Resolve history once. Random frame order must not change the camera path.
    for(let frame=0;frame<=Math.ceil(track.duration)+1;frame++)positions.push(follow.getCamera(engine,{width,height,zoom:zoomAt(frame)},frame));
  }finally{window.getAutoZoom=previousZoom;}
  return{
    draw(videoFrame){
      // Preserve the existing exporter's initial repeated frame.
      const frame=Math.max(0,videoFrame-1)*40/fps;
      const at=Math.min(frame,positions.length-1),lo=Math.floor(at),hi=Math.min(lo+1,positions.length-1),mix=at-lo;
      const a=positions[lo],b=positions[hi];
      const camera=new Camera().withAspectRatio(width/height).withFocalPoint(a.x+(b.x-a.x)*mix,a.y+(b.y-a.y)*mix).withZoom(zoomAt(at));
      lines.render(scene,camera,{pixelDensity:1,width,height,shouldUpdate:false,transparent:false});
      const entity=generator.getEntities(engine,undefined,at,false,0,false,0,0);
      sprites.render(entity.background,entity.onionSkin,entity.foreground,sheet,sheet.image,camera,{pixelDensity:1,width,height});
      lines.gl.finish();
    },
    dispose(){sprites.destroy();lines.gl.getExtension('WEBGL_lose_context')?.loseContext();},
  };
}
