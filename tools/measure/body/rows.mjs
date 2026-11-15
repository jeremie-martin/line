// usage: rows.mjs DIR from to : per frame T (travel push), S (spin push), D (shape push), M (2-frame whole-body, account scale), sled angle
import {load,visual} from './visual.mjs';
const p=load(process.argv[2]),r=visual(p),a=Math.round(+process.argv[3]*r.fps),b=Math.round(+process.argv[4]*r.fps);
const evAt=new Map();r.ev.forEach((e,i)=>evAt.set(e.onset,(r.asked.has(i)?'ASKED '+r.asked.get(i).impact:'extra')+' rec '+e.strength.toFixed(2)));
for(let i=a;i<=b;i++){const fr=r.F[i],ang=Math.atan2(fr[5]-fr[3],fr[4]-fr[2])*180/Math.PI;
 console.log(i,(i/r.fps).toFixed(3),r.contact[i]?'c':' ','T',r.T[i].toFixed(2),'S',r.s[i].toFixed(2).padStart(5),'D',r.D[i].toFixed(2),'M',r.M[i].toFixed(2),'ang',ang.toFixed(0).padStart(4),'#'.repeat(Math.min(30,Math.round(r.M[i]*60))).padEnd(31),evAt.get(i)??'');}
