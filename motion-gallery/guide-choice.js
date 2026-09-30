/** Selection over an immutable measured portfolio; moving the control never compiles. */
export async function createGuideChoicePanel(manifest,onchange){
  const {selectGuideAlternative}=await import('/generated/motion-gallery-renderer/view.js');
  const root=document.getElementById('guide-choice');root.hidden=false;
  root.innerHTML='<h2>Choose how much guidance to keep</h2><p>Prefer fewer guided sections, then shorter visible guides, within an explicit motion-error allowance.</p><div class="choice-controls"><label>Extra motion error above the best measured ride<input id="extra-error" type="range" min="0" max="0.08" step="0.001" value="0"><output id="extra-error-value"></output></label><label>Comparison<select id="choice-fork"></select></label></div><p id="choice-explanation" role="status"></p><p id="choice-work"></p><details><summary>How the allowance works</summary><p>The compiler already measures whole-ride error across authored air, speed, amplitude and impact targets. This control allows an additional amount of that normalized root-mean-square error. It is not a number of benchmark points or a visual-quality score. The candidate set stays fixed, so relaxing the allowance cannot select more guided sections; when the count stays equal, guide length cannot increase. A track with fewer guides may still have more total guide length.</p><p>Every pair below starts with identical earlier geometry and rider state. One branch forbids a guide at the selected section; the other allows it. Both search the remaining ride. An unsuccessful branch means no valid continuation was found within that search allowance, not that the geometry is impossible.</p></details><details><summary>All measured alternatives</summary><div class="table-scroll"><table><thead><tr><th>Alternative</th><th>Guided sections</th><th>Guide length</th><th>Motion error</th><th>Adherence</th></tr></thead><tbody id="choice-candidates"></tbody></table></div></details>';
  const $=id=>document.getElementById(id),byId=new Map(manifest.cells.map(c=>[c.id,c]));
  const format=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';
  const label=d=>d.section===0?'Startup':`Beat ${d.section}`;
  let activeKey,portfolio,jumpTo;
  $('extra-error').oninput=()=>{if($('choice-fork').value!=='preference')$('choice-fork').value='preference';onchange();};
  $('choice-fork').onchange=()=>{const d=portfolio.decisions.find(d=>String(d.section)===$('choice-fork').value);jumpTo=d?.frame;onchange();};
  return {select(caseId,budget,seed){
    portfolio=manifest.portfolios.find(p=>p.caseId===caseId&&p.budget===budget&&p.seed===seed);
    if(!portfolio)throw new Error('Missing guide-choice portfolio');
    if(activeKey!==portfolio.key){
      activeKey=portfolio.key;jumpTo=undefined;
      $('choice-fork').replaceChildren(...[{value:'preference',text:'Preferred complete track'},{value:'reference',text:'Original search vs preferred'},...portfolio.decisions.map(d=>({value:String(d.section),text:`${label(d)} · ${(d.frame/40).toFixed(2)} s`}))].map(({value,text})=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;}));
    }
    const candidates=portfolio.ids.map(id=>byId.get(id));
    const extra=+$('extra-error').value,choice=selectGuideAlternative(candidates,extra);
    $('extra-error-value').textContent=`+${format(extra)} RMS`;
    $('choice-work').textContent=`Entire recorded search: ${portfolio.physicalFrames.toLocaleString()} of ${portfolio.budget.toLocaleString()} physics frames · ${(portfolio.compileMs/1000).toFixed(1)} s. Includes the reference, both branches at every fork, prefix checks and compiler replays. Moving this control reuses those results.`;
    let cells,titles;
    const fork=portfolio.decisions.find(d=>String(d.section)===$('choice-fork').value);
    if(fork){
      cells=[byId.get(fork.single),byId.get(fork.guided)];titles=[`${label(fork)} · guide forbidden`,`${label(fork)} · guide allowed`];
      $('choice-explanation').textContent=`Identical earlier linework and rider history through frame ${fork.frame}. Each branch received ${fork.allowancePerBranch.toLocaleString()} physics frames to search and replay its continuation. ${cells.every(c=>c.valid)?'Both continuations passed timing and survival.':cells.every(c=>!c.valid)?'Neither search found a valid complete continuation.':cells[0].valid?'Only the guide-forbidden search found a valid complete continuation.':'Only the guide-allowed search found a valid complete continuation.'}`;
    }else if(choice){
      const reference=$('choice-fork').value==='reference';
      cells=[reference?byId.get(portfolio.reference):choice.best,choice.selected];titles=[reference?'Original search':'Lowest measured motion error','Preferred guide usage'];
      $('choice-explanation').textContent=`${choice.eligible} of ${candidates.filter(c=>c.valid).length} valid alternatives fit the error ceiling ${format(choice.ceiling,4)}. Best measured error: ${format(choice.best.qualityRms,4)}. Selected error: ${format(choice.selected.qualityRms,4)}. ${choice.selected.usage.guideSections} of ${choice.selected.usage.supportSections} sections retain a guide.`;
    }else{cells=[byId.get(portfolio.reference),byId.get(portfolio.reference)];titles=['Original search','No valid alternative'];$('choice-explanation').textContent='This portfolio contains no valid complete ride. No preference result is claimed.';}
    $('choice-candidates').replaceChildren(...candidates.map(c=>{
      const d=portfolio.decisions.find(d=>d.single===c.id||d.guided===c.id),tr=document.createElement('tr');
      if(c.id===choice?.selected.id)tr.className='selected-choice';
      const first=document.createElement('td'),button=document.createElement('button');
      button.textContent=d?`${label(d)} · ${d.single===c.id?'forbidden':'allowed'}`:'Original search';
      button.onclick=()=>{$('choice-fork').value=d?String(d.section):'reference';$('choice-fork').dispatchEvent(new Event('change'));};first.append(button);tr.append(first);
      for(const v of [`${c.usage.guideSections}/${c.usage.supportSections}`,format(c.usage.guideLength,1),format(c.qualityRms,4),c.valid?format(c.score.score,1):'Failed contract']){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;
    }));
    const at=jumpTo;jumpTo=undefined;return {cells,titles,jumpTo:at};
  }};
}
