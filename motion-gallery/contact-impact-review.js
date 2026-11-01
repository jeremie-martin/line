/** Saved shared-account observations on the existing native/audio player. */
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const fmt=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';
/** Fixed eight-second inspection window, including the final partial window. */
export function impactWindow(seconds,duration){
 const start=Math.floor(Math.max(0,Math.min(seconds,duration-.001))/8)*8;
 return {start,end:Math.min(duration,start+8)};
}
export function impactTimeAt(fraction,start,end){return start+Math.max(0,Math.min(1,fraction))*(end-start);}
export function createContactImpactReview({seek}){
 const host=document.createElement('aside');host.id='contact-impact-review';host.hidden=true;host.setAttribute('aria-label','Musical impacts');
 host.append(node('h3','Musical impacts'));
 const legend=node('div');legend.className='impact-legend';
 for(const [text,cls]of [['Requested','requested'],['Realized','realized'],['Extra','extra']]){const item=node('span',text);item.className=cls;legend.append(item);}
 host.append(legend);
 const description=node('p'),chart=node('div'),summary=node('p'),label=node('label'),small=node('input');
 const overviewTitle=node('p','Whole ride'),detailTitle=node('p'),detailChart=node('div');overviewTitle.className=detailTitle.className='impact-chart-title';detailChart.className='contact-impact-chart';
 chart.className='contact-impact-chart';small.type='checkbox';label.append(small,document.createTextNode(' Include very small extra responses'));
 const table=node('table'),head=node('thead'),heading=node('tr');
 for(const title of ['Interaction','Target time','Observed time','Onset offset','Contact-force peak offset','Wanted strength','Measured strength'])heading.append(node('th',title));
 head.append(heading);const body=node('tbody');table.append(head,body);const wrap=node('div');wrap.className='table-wrap';wrap.append(table);
 const hint=node('p','Click an impact to jump there.');hint.className='impact-hint';
 host.append(overviewTitle,chart,detailTitle,detailChart,hint);document.getElementById('watch-layout').append(host);
 const details=node('details');details.id='impact-measurements';details.hidden=true;details.append(node('summary','Impact measurements'),description,summary,label,wrap);document.getElementById('motion-detail').before(details);
 let record,cursor,detailCursor,windowMark,detailStart=-1,extent=1,shown=0,chartWidth=360;
 new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width>0&&width!==chartWidth){chartWidth=width;if(record)drawChart();}}).observe(chart);
 const svgNode=(tag,attrs)=>{const e=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 const rebuild=()=>{
  if(!record)return;
  const {events,targets,account}=record.impactEvaluation,rows=[];
  for(const [i,target]of targets.entries()){
   const match=account.matches.find(m=>m.target===i),event=match?events[match.event]:undefined;
   rows.push({time:target.frame/40,label:`Beat ${i+1}`,target:target.frame/40,actual:event?.onset/40,
    offset:match?match.offset*25:undefined,peak:event?.peakFrame!==undefined?(event.peakFrame-target.frame)*25:undefined,wanted:target.impact,strength:event?.strength});
  }
  for(const i of account.unmatchedEvents){const e=events[i];if(small.checked||e.strength>=.05)rows.push({time:e.onset/40,label:e.kind==='strike'?'Extra strike':'Extra response',actual:e.onset/40,strength:e.strength});}
  body.replaceChildren(...rows.sort((a,b)=>a.time-b.time).map(r=>{
   const tr=node('tr'),link=node('button',r.label);link.onclick=()=>seek(Math.max(0,r.time-.2));const cell=node('td');cell.append(link);tr.append(cell);
   const ms=v=>Number.isFinite(v)?`${v>0?'+':''}${v} ms`:'—';
   for(const value of [fmt(r.target),fmt(r.actual),ms(r.offset),ms(r.peak),fmt(r.wanted),fmt(r.strength)])tr.append(node('td',value));
   return tr;
  }));
 };
 function moveCursor(){
  if(!record)return;updateDetail();
  const position=(line,x)=>{line.setAttribute('x1',x);line.setAttribute('x2',x);};
  if(cursor)position(cursor,chartWidth*shown/extent);
  if(detailCursor)position(detailCursor,chartWidth*(shown-detailStart)/(Math.min(extent,detailStart+8)-detailStart));
 }
 function makeChart(start,end){
  const {events,targets,account}=record.impactEvaluation,x=t=>chartWidth*(t-start)/(end-start);
  const svg=svgNode('svg',{viewBox:`0 0 ${chartWidth} 170`,role:'img','aria-label':`Requested and realized impacts, ${fmt(start,1)} to ${fmt(end,1)} seconds`});
  svg.append(svgNode('line',{x1:0,x2:chartWidth,y1:145,y2:145,stroke:'#999'}));
  for(const target of targets){const t=target.frame/40;if(t<start||t>end)continue;svg.append(svgNode('line',{x1:x(t),x2:x(t),y1:145,y2:145-125*(target.impact??0),stroke:'#999','stroke-width':3}));}
  const matched=new Set(account.matches.map(m=>m.event));
  for(const [i,e]of events.entries()){
   const t=e.onset/40;if(t<start||t>end)continue;
   const y=145-125*e.strength,color=matched.has(i)?'#287aa6':'#bb5c23';
   svg.append(svgNode('line',{x1:x(t),x2:x(t),y1:145,y2:y,stroke:color,'stroke-width':1}));
   const point=svgNode('circle',{cx:x(t),cy:y,r:2.5,fill:color}),title=svgNode('title',{});
   title.textContent=`${fmt(t)} s · ${fmt(e.strength)} · ${matched.has(i)?'matched':'extra'}`;point.append(title);svg.append(point);
  }
  const line=svgNode('line',{x1:0,x2:0,y1:0,y2:150,stroke:'#111','stroke-width':2});svg.append(line);
  for(let i=0;i<=4;i++){const t=start+(end-start)*i/4,label=svgNode('text',{x:Math.min(chartWidth-5,Math.max(5,x(t))),y:167,'text-anchor':i===0?'start':i===4?'end':'middle',fill:'currentColor','font-size':12});label.textContent=fmt(t,1)+'s';svg.append(label);}
  svg.onclick=e=>{const b=svg.getBoundingClientRect();seek(impactTimeAt((e.clientX-b.left)/b.width,start,end));};
  return {svg,line};
 }
 function updateDetail(force=false){
  const {start,end}=impactWindow(shown,extent);
  if(!force&&start===detailStart)return;
  detailStart=start;const detail=makeChart(start,end);
  detailTitle.textContent=`Around playback · ${fmt(start,0)}–${fmt(end,1)} s`;
  detailCursor=detail.line;detailChart.replaceChildren(detail.svg);
  if(windowMark){windowMark.setAttribute('x',chartWidth*start/extent);windowMark.setAttribute('width',chartWidth*(end-start)/extent);}
 }
 function drawChart(){
  const overview=makeChart(0,extent);cursor=overview.line;
  windowMark=svgNode('rect',{y:0,height:145,fill:'#146b55','fill-opacity':.08});overview.svg.prepend(windowMark);
  chart.replaceChildren(overview.svg);updateDetail(true);moveCursor();
 }
 small.onchange=rebuild;
 return {
  clear(){record=undefined;cursor=detailCursor=windowMark=undefined;detailStart=-1;shown=0;chart.replaceChildren();detailChart.replaceChildren();body.replaceChildren();description.textContent='';summary.textContent='';host.hidden=true;details.hidden=true;document.getElementById('watch-layout').classList.remove('has-impacts');},
  bind(r){
   if(!r.impactEvaluation)return;
   record=r;extent=r.case.durationFrames/40;const {events,targets,account}=r.impactEvaluation;
   host.hidden=false;details.hidden=false;document.getElementById('watch-layout').classList.add('has-impacts');description.textContent=`${r.impactEvaluation.contract}. Gray marks show requested beats;`+' '+' blue marks show matched responses; orange marks show extra responses. All event strengths contribute to the account, including small responses hidden from the table. Click the chart or a row to inspect the actual ride.';
   const onsetRms=25*Math.sqrt(account.matches.reduce((n,m)=>n+m.offset*m.offset,0)/Math.max(1,account.matches.length));
   summary.textContent=`${account.matches.length}/${targets.length} beats matched · strength RMS ${fmt(Math.sqrt(account.strengthMse))} · onset RMS ${fmt(onsetRms,1)} ms · extra-response RMS ${fmt(Math.sqrt(account.extraMse))}. These are separate observations, not an aesthetic rating.`;
   drawChart();rebuild();
  },
  draw(seconds){shown=seconds;moveCursor();},
 };
}
