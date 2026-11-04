import {expect,it} from 'vitest';
import {detect,type Detection} from '../scripts/lib/detector.ts';
import {measureGapAxes,measureTrajectoryAxes,withGrain} from '../scripts/v0/core/measure.ts';
import {measureGapAxes as referenceAxes} from './fixtures/gap_axes_reference.ts';
import type {Gap,TrackLine} from '../scripts/v0/types.ts';

it('preserves full axis values and field order when geometry is measured at reporting',()=>{
  const full=detect({duration:120,frames:Array.from({length:121},(_,frame)=>({
    frame,position:{x:frame*5,y:-10*frame+.0875*frame*frame},velocity:{x:5,y:-10+.175*frame},
    sledContacts:frame%20<8?['PEG']:[],contactLineIds:frame%20<8?[1]:[],sledBroken:false,riderEjected:false,
  }))});
  const variants:Detection[]=[full];
  for(const offset of [1,30,120]) variants.push({...full,frameOffset:offset,measurements:{
    position:full.measurements.position.slice(offset),velocity:full.measurements.velocity.slice(offset),
    speed:full.measurements.speed.slice(offset),airborne:full.measurements.airborne.slice(offset),
    sledContacts:full.measurements.sledContacts.slice(offset),contactLineIds:full.measurements.contactLineIds.slice(offset),
  }} as Detection);
  for(const value of [undefined,NaN,Infinity,-0]){
    const velocity=full.measurements.velocity.slice();
    if(value===undefined)delete velocity[40];else velocity[40]={x:value,y:value};
    variants.push({...full,measurements:{...full.measurements,velocity}});
  }
  const line=(length:number,id:number):TrackLine=>({id,type:0,x1:0,y1:0,x2:length,y2:0});
  const geometries=[[],[line(20,1)],[line(20,1),line(10,2)],
    [line(0,1),line(20,2),line(10,3)],[line(Infinity,1)],[line(NaN,1)]];
  for(const det of variants)for(const [start,end] of [[0,0],[0,20],[0,80],[30,80],[40,39],[119,140],[130,140]])
    for(const impact of [undefined,.5]){
      const gap:Gap={index:0,startFrame:start,endFrame:120,endsWithContact:true,targets:{impact}};
      const trajectory=Object.freeze(measureTrajectoryAxes(det,gap,end));
      for(const lines of geometries){
        const expected=referenceAxes(det,gap,lines,end),actual=withGrain(trajectory,lines);
        expect(actual).toStrictEqual(expected);
        expect(Object.keys(actual)).toStrictEqual(Object.keys(expected));
        expect(measureGapAxes(det,gap,lines,end)).toStrictEqual(expected);
      }
    }
});
