/** Saved shared-account observations on the existing native/audio player. */
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';
export function createContactImpactReview({seek}){
 const host=document.createElement('details');host.id='contact-impact-review';host.hidden=true;
 host.append(node('summary','Musical impacts'));
 const description=node('p'),chart=node('div'),summary=node('p'),label=node('label'),small=node('input');
 chart.className='contact-impact-chart';small.type='checkbox';label.append(small,document.createTextNode(' Include very small extra responses'));
 const table=node('table'),head=node('thead'),heading=node('tr');
 for(const title of ['Interaction','Target time','Observed time','Offset','Wanted strength','Measured strength'])heading.append(node('th',title));
 head.append(heading);const body=node('tbody');table.append(head,body);const wrap=node('div');wrap.className='table-wrap';wrap.append(table);
 host.append(description,summary,chart,label,wrap);document.getElementById('motion-detail').before(host);
 let record,cursor,extent=1;
 const svgNode=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 const rebuild=()=>{
  if(!record)return;
  const {events,targets,account}=record.impactEvaluation,rows=[];
  for(const [i,target]of targets.entries()){
   const match=account.matches.find(m=>m.target===i),event=match?events[match.event]:undefined;
   rows.push({time:target.frame/40,label:`Beat ${i+1}`,target:target.frame/40,actual:event?.onset/40,
    offset:match?match.offset*25:undefined,wanted:target.impact,strength:event?.strength});
  }
  for(const i of account.unmatchedEvents){const e=events[i];if(small.checked||e.strength>=.05)rows.push({time:e.onset/40,label:'Extra response',actual:e.onset/40,strength:e.strength});}
  body.replaceChildren(...rows.sort((a,b)=>a.time-b.time).map(r=>{
   const tr=node('tr'),link=node('button',r.label);link.onclick=()=>seek(Math.max(0,r.time-.2));const cell=node('td');cell.append(link);tr.append(cell);
   for(const value of [fmt(r.target),fmt(r.actual),Number.isFinite(r.offset)?`${r.offset>0?'+':''}${r.offset} ms`:'—',fmt(r.wanted),fmt(r.strength)])tr.append(node('td',value));
   return tr;
  }));
 };
 small.onchange=rebuild;
 return {
  clear(){record=undefined;cursor=undefined;chart.replaceChildren();body.replaceChildren();description.textContent='';summary.textContent='';host.hidden=true;},
  bind(r){
   if(!r.impactEvaluation)return;
   record=r;extent=r.case.durationFrames/40;const {events,targets,account}=r.impactEvaluation;
   host.hidden=false;description.textContent='Experimental measurement. Gray marks show requested beats; blue marks show matched responses; orange marks show extra responses. All event strengths contribute to the account, including small responses hidden from the table. Click the chart or a row to inspect the actual ride.';
   const onsetRms=25*Math.sqrt(account.matches.reduce((n,m)=>n+m.offset*m.offset,0)/Math.max(1,account.matches.length));
   summary.textContent=`${account.matches.length}/${targets.length} beats matched · strength RMS ${fmt(Math.sqrt(account.strengthMse))} · onset RMS ${fmt(onsetRms,1)} ms · extra-response RMS ${fmt(Math.sqrt(account.extraMse))}. These are separate observations, not an aesthetic rating.`;
   const svg=svgNode('svg',{viewBox:'0 0 1000 170',role:'img','aria-label':'Requested beats and measured impact strengths through the complete song'});
   svg.append(svgNode('line',{x1:0,x2:1000,y1:145,y2:145,stroke:'#999'}));
   for(const target of targets){const x=1000*target.frame/40/extent;svg.append(svgNode('line',{x1:x,x2:x,y1:145,y2:145-125*(target.impact??0),stroke:'#999','stroke-width':3}));}
   const matched=new Set(account.matches.map(m=>m.event));
   for(const [i,e]of events.entries()){
    const x=1000*e.onset/40/extent,y=145-125*e.strength,color=matched.has(i)?'#287aa6':'#bb5c23';
    svg.append(svgNode('line',{x1:x,x2:x,y1:145,y2:y,stroke:color,'stroke-width':1}));
    const point=svgNode('circle',{cx:x,cy:y,r:2.5,fill:color});const title=svgNode('title',{});title.textContent=`${fmt(e.onset/40)} s · ${fmt(e.strength)} · ${matched.has(i)?'matched':'extra'}`;point.append(title);svg.append(point);
   }
   cursor=svgNode('line',{x1:0,x2:0,y1:0,y2:150,stroke:'#111','stroke-width':2});svg.append(cursor);
   for(const t of [0,extent/4,extent/2,3*extent/4,extent]){const label=svgNode('text',{x:Math.min(995,Math.max(5,1000*t/extent)),y:167,'text-anchor':t===0?'start':t===extent?'end':'middle',fill:'currentColor','font-size':12});label.textContent=fmt(t,1)+'s';svg.append(label);}
   svg.onclick=e=>{const b=svg.getBoundingClientRect();seek(Math.max(0,Math.min(extent,(e.clientX-b.left)/b.width*extent)));};
   chart.replaceChildren(svg);rebuild();
  },
  draw(seconds){if(cursor){const x=1000*seconds/extent;cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);}},
 };
}
