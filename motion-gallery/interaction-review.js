/** An optional study view attached to the production player. It owns no audio,
 * physics or animation loop: all playback uses the existing native viewer.
 */
export async function createInteractionReview({url, checked, open, seek, time}) {
  const source=new URL(url,location.href);
  if(source.origin!==location.origin)throw new Error('Interaction studies must be served from this gallery.');
  const data=await checked(source.href);
  if(data.schema!=='line.interaction-candidates.v1'||!Array.isArray(data.clips)||!data.clips.length)throw new Error('Invalid interaction study');
  for(const c of data.clips){
    if(new URL(c.manifest,location.href).origin!==location.origin||!c.range?.every(Number.isFinite)||c.range[1]<=c.range[0])throw new Error('Invalid study passage');
  }
  const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
  const root=el('section');root.id='interaction-review';
  const heading=el('h2','Musical interactions · measurement review');
  const intro=el('p','Listen and watch first. The measurements are competing interpretations of the same saved ride; none is a new score or a compiler rule.');
  const nav=el('div');nav.className='interaction-nav';
  const previous=el('button','Previous'),next=el('button','Next'),select=el('select');select.id='interaction-passage';select.setAttribute('aria-label','Study passage');
  data.clips.forEach((c,i)=>{const o=el('option',`${i+1}. ${c.title}`);o.value=c.id;select.append(o);});
  nav.append(previous,select,next);
  const context=el('p'),question=el('p'),targets=el('p');question.className='interaction-question';targets.className='interaction-targets';
  const full=el('a','Open full automatic track ↗');
  const details=el('details'),summary=el('summary','Compare the measurements');details.append(summary);
  const explanation=el('p','Dashed lines are authored beats. Orange markers on A show response peaks not directly credited by the landing gate. Raw response and the established 0–1 impact scale are different quantities. Counts are observations, not quality scores.');
  const chartBox=el('div');chartBox.className='interaction-chart';
  const descriptions=el('div');descriptions.className='interaction-methods';
  for(const method of Object.values(data.methods)){const p=el('p');p.append(el('strong',method.title+' '),document.createTextNode(method.description));descriptions.append(p);}
  const facts=el('p'),sensitivity=el('p'),tableWrap=el('div');tableWrap.className='table-wrap';
  details.append(explanation,chartBox,facts,sensitivity,tableWrap,descriptions);
  const notes=el('textarea');notes.id='interaction-notes';notes.rows=3;notes.placeholder='What carries the beat? Is another interaction distinct, welcome, distracting, or ambiguous?';
  const noteLabel=el('label','Your observations (optional)');noteLabel.htmlFor=notes.id;
  const mark=el('button','Mark current time'),clear=el('button','Clear marked times'),download=el('button','Export observations');
  const feedback=el('div');feedback.className='interaction-nav';feedback.append(mark,clear,download);
  const marks=el('p'),saved=el('p','Notes stay in this browser. Export them if you want to share or keep a copy.');saved.className='interaction-save';
  root.append(heading,intro,nav,context,question,targets,full);
  const observations=el('section');observations.id='interaction-observations';observations.append(details,noteLabel,notes,feedback,marks,saved);
  document.getElementById('result').before(root);document.body.classList.add('interaction-review-mode');
  document.querySelector('#result > .transport').after(observations);
  let selected=data.clips.find(c=>c.id===new URLSearchParams(location.search).get('clip'))??data.clips[0],bound=false,cursor;
  const storageKey='line.interaction-review.'+data.panelSha256;
  let annotations={};try{const loaded=JSON.parse(localStorage.getItem(storageKey)||'{}');if(loaded&&typeof loaded==='object'&&!Array.isArray(loaded))annotations=loaded;}catch{/* Export remains available when browser storage is unavailable. */}
  const annotation=()=>{
    const a=annotations[selected.id];
    if(!a||a.trackHash!==selected.trackHash||typeof a.notes!=='string'||!Array.isArray(a.times)||!a.times.every(Number.isFinite))annotations[selected.id]={trackHash:selected.trackHash,notes:'',times:[]};
    return annotations[selected.id];
  };
  function showNotes(){notes.value=annotation().notes;marks.textContent=annotation().times.length?'Marked music times: '+annotation().times.map(t=>t.toFixed(3)+' s').join(', '):'No times marked.';}
  function save(){annotation().notes=notes.value;try{localStorage.setItem(storageKey,JSON.stringify(annotations));}catch{saved.textContent='Browser storage is unavailable. Export observations before leaving.';}}
  notes.oninput=save;
  mark.onclick=()=>{if(!bound)return;annotation().times.push(Math.round(time()*40)/40);annotation().times=[...new Set(annotation().times)].sort((a,b)=>a-b);save();showNotes();};
  clear.onclick=()=>{annotation().times=[];save();showNotes();};
  download.onclick=()=>{
    save();const blob=new Blob([JSON.stringify({schema:'line.interaction-feedback.v1',panelSha256:data.panelSha256,candidatesSha256:data.candidatesSha256,ownerFeedbackSha256:data.ownerFeedbackSha256,study:source.pathname,annotations},null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='interaction-observations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function renderText(){
    select.value=selected.id;const i=data.clips.indexOf(selected);previous.disabled=i===0;next.disabled=i===data.clips.length-1;
    context.textContent=`${selected.song.replaceAll('_',' ')} · seed ${selected.seed} · focus ${selected.focus.map(t=>t.toFixed(2)).join('–')} s. `+(selected.ownerFeedback??'This passage has no recorded owner judgment.');
    question.textContent=selected.question;
    targets.textContent='Authored impact → current measured impact (0–1): '+selected.beats.map(b=>`${b.time.toFixed(3)} s: ${b.target.toFixed(3)} → ${b.impact.toFixed(3)}`).join(' · ')+'. These values use the existing landing measure; they do not establish how clear the strike feels.';
    const fullUrl=new URL('production.html',location.href);fullUrl.searchParams.set('data',selected.manifest);fullUrl.searchParams.set('t',String(selected.range[0]));full.href=fullUrl.href;
    showNotes();
  }
  async function choose(c){save();selected=c;bound=false;mark.disabled=true;details.hidden=true;renderText();
    const u=new URL(location.href);u.searchParams.set('clip',c.id);history.replaceState(null,'',u);
    await open(c.manifest,undefined,Math.floor(c.range[0]*40)/40);
  }
  select.onchange=()=>choose(data.clips.find(c=>c.id===select.value));
  previous.onclick=()=>choose(data.clips[data.clips.indexOf(selected)-1]);next.onclick=()=>choose(data.clips[data.clips.indexOf(selected)+1]);
  function renderChart(){
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 350');svg.setAttribute('role','img');svg.setAttribute('aria-label','Response, landing windows, contact episodes and response pulses over music time');
    const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text)e.textContent=text;svg.append(e);return e;};
    const [lo,hi]=selected.range,x=t=>115+(t-lo)/(hi-lo)*865,peak=Math.max(.1,...selected.frames.map(f=>f.correction)),y=v=>125-90*v/peak;
    add('rect',{x:x(selected.focus[0]),y:12,width:x(selected.focus[1])-x(selected.focus[0]),height:312,fill:'#eef2e7'});
    for(const b of selected.beats)add('line',{x1:x(b.time),x2:x(b.time),y1:10,y2:322,stroke:'#16806a','stroke-dasharray':'4 4'});
    add('text',{x:5,y:55,'font-size':14,fill:'#235a9f'},'Body response');add('text',{x:5,y:76,'font-size':11,fill:'#63736e'},'world units/frame');
    add('text',{x:5,y:97,'font-size':11,fill:'#63736e'},'peak '+peak.toFixed(2));
    add('path',{d:selected.frames.map((f,i)=>(i?'L':'M')+x(f.frame/40)+','+y(f.correction)).join(' '),fill:'none',stroke:'#235a9f','stroke-width':2});
    const methods=[['landing',180,'#657079'],['contact',235,'#267e64'],['pulse',290,'#8260a3']];
    for(const [key,row,color]of methods){
      add('text',{x:5,y:row+10,'font-size':14,fill:color},{landing:'A · Landing',contact:'B · Contact',pulse:'C · Pulse'}[key]);
      for(const e of selected.methods[key]){
        const first=Math.max(lo,e.start/40),last=Math.min(hi,(e.end+1)/40);
        const rect=add('rect',{x:x(first),y:row,width:Math.max(1,x(last)-x(first)),height:16,fill:color,opacity:.5,rx:3});
        const title=document.createElementNS(ns,'title');title.textContent=`${(e.start/40).toFixed(3)}–${(e.end/40).toFixed(3)} s · peak ${(e.peakFrame/40).toFixed(3)} s`;rect.append(title);
        if(e.peakFrame/40>=lo&&e.peakFrame/40<=hi)add('circle',{cx:x(e.peakFrame/40),cy:row+8,r:3,fill:color});
      }
    }
    for(const e of selected.methods.pulse)if(!e.scoredPeak&&e.peakFrame/40>=lo&&e.peakFrame/40<=hi)add('circle',{cx:x(e.peakFrame/40),cy:174,r:4,fill:'#d28532'});
    for(let t=Math.ceil(lo*2)/2;t<=hi;t+=.5)add('text',{x:x(t),y:342,'text-anchor':'middle','font-size':12,fill:'#63736e'},t.toFixed(2)+'s');
    cursor=add('line',{x1:x(lo),x2:x(lo),y1:5,y2:325,stroke:'#be375d','stroke-width':2});
    svg.onclick=e=>{const box=svg.getBoundingClientRect(),vx=(e.clientX-box.left)/box.width*1000;seek(Math.max(lo,Math.min(hi,lo+(vx-115)/865*(hi-lo))));};
    chartBox.replaceChildren(svg);
    const contactCounts=selected.sensitivity.filter(s=>s.method==='contact').map(s=>s.count),pulseCounts=selected.sensitivity.filter(s=>s.method==='pulse').map(s=>s.count);
    sensitivity.textContent=`Within the shaded focus, contact grouping gives ${Math.min(...contactCounts)}–${Math.max(...contactCounts)} episodes when allowing 0–2 empty frames. Pulse grouping gives ${Math.min(...pulseCounts)}–${Math.max(...pulseCounts)} pulses across the declared strength/valley settings. These ranges expose sensitivity; they do not estimate confidence.`;
    facts.textContent=selected.finding??'Inspect where the methods separate, merge or omit interactions. A matched marker alone does not establish musical clarity.';
    const table=el('table'),head=el('tr');for(const t of ['Method','Onset','Peak','Beat association','Contact evidence'])head.append(el('th',t));const thead=el('thead');thead.append(head);table.append(thead);const tbody=el('tbody');
    for(const key of ['landing','contact','pulse'])for(const e of selected.methods[key]){
      const tr=el('tr'),button=el('button',(e.start/40).toFixed(3)+' s');button.onclick=()=>seek(Math.max(selected.range[0],e.start/40));
      tr.append(el('td',{landing:'A',contact:'B',pulse:'C'}[key]));const onset=el('td');onset.append(button);tr.append(onset,el('td',(e.peakFrame/40).toFixed(3)+' s'));
      const match=key==='landing'?`${e.beatTime.toFixed(3)} s · impact ${e.impact.toFixed(3)}`:e.match?`${e.match.beatTime.toFixed(3)} s (${Math.round(e.match.offsetFrames*25)} ms)${e.eligibleBeats.length>1?' · ambiguous':''}`:'Unmatched';
      tr.append(el('td',match),el('td',(e.contacts??[]).join(', ')||'Scored sled-contact window'));tbody.append(tr);
    }
    table.append(tbody);tableWrap.replaceChildren(table);
  }
  renderText();details.hidden=true;mark.disabled=true;
  return {initial:selected,
    get range(){return bound?[Math.floor(selected.range[0]*40)/40,Math.ceil(selected.range[1]*40)/40]:undefined;},
    clear(){bound=false;details.hidden=true;mark.disabled=true;},
    bind(record,digest,manifest){
      if(manifest.pathname!==new URL(selected.manifest,location.href).pathname||record.trackHash!==selected.trackHash||digest!==selected.artifactSha256)throw new Error('Study observations do not match this saved ride');
      bound=true;details.hidden=false;mark.disabled=false;renderChart();
    },
    draw(seconds){if(!bound||!cursor)return;const [lo,hi]=selected.range,x=115+(seconds-lo)/(hi-lo)*865;cursor.setAttribute('x1',x);cursor.setAttribute('x2',x);},
  };
}
