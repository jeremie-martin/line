/** Selection over an immutable measured portfolio; moving the control never compiles. */
export async function createGuideChoicePanel(manifest,onchange){
  const {selectGuideAlternative}=await import('/generated/motion-gallery-renderer/view.js');
  const root=document.getElementById('guide-choice');root.hidden=false;
  root.innerHTML=`
    <h2>Choose how much guidance to keep</h2>
    <p>This experiment prefers fewer guides while limiting the loss of accuracy against the specification. It selects whole tracks from the recorded search.</p>
    <div class="choice-controls">
      <label>Additional target error allowed<input id="extra-error" type="range" min="0" max="0.08" step="0.001" value="0"><output id="extra-error-value"></output></label>
      <label>Comparison<select id="choice-fork"></select></label>
    </div>
    <p id="choice-explanation" role="status"></p><p id="choice-work"></p>
    <details><summary>How the allowance works</summary>
      <ol>
        <li>Find the valid recorded track with the lowest target error.</li>
        <li>Keep valid tracks whose error is at most that value plus the slider allowance.</li>
        <li>Choose the fewest guided sections, then the shortest total guide length. Break remaining ties by lower error, then a stable identifier.</li>
      </ol>
      <p>For example: best error 0.030 + allowance 0.010 = ceiling 0.040. Moving the slider selects an already compiled track; it does not remove rails or run a new search.</p>
      <p>Lower error means closer to the authored air, speed, amplitude and impact targets. This is the compiler’s existing normalized root-mean-square (RMS) error across the whole ride, not benchmark points, extra physical motion or a visual-quality score. It does not bound the error at each individual beat.</p>
      <p>These are the alternatives this search found, not the limits of either geometry. Better searches can improve tracks both with and without guides. Preferring fewer guides is one explicit aesthetic preference for this experiment, not a claim that they always look better.</p>
      <p>Every section comparison starts with identical earlier geometry and rider state. One branch forbids a guide at that section; the other allows it. Both search the remaining ride. Failure means no valid continuation was found within that search allowance, not that the geometry is impossible.</p>
    </details>
    <details><summary>All measured alternatives</summary><div class="table-scroll"><table><thead><tr><th>Alternative</th><th>Guided sections</th><th>Guide length</th><th>Target error (RMS)</th><th>Adherence</th></tr></thead><tbody id="choice-candidates"></tbody></table></div></details>`;
  const $=id=>document.getElementById(id),byId=new Map(manifest.cells.map(c=>[c.id,c]));
  const format=(n,d=3)=>Number.isFinite(n)?n.toFixed(d):'—';
  const key=d=>d.id??String(d.section);
  const label=d=>{
    const name=d.section===0?'Startup':`Beat ${d.section}`;
    const sameSection=portfolio.decisions.filter(other=>other.section===d.section);
    return name+(sameSection.length>1?` · path ${sameSection.indexOf(d)+1}`:'');
  };
  let activeKey,portfolio,jumpTo;
  $('extra-error').oninput=()=>{if($('choice-fork').value!=='preference')$('choice-fork').value='preference';onchange();};
  $('choice-fork').onchange=()=>{const d=portfolio.decisions.find(d=>key(d)===$('choice-fork').value);jumpTo=d?.frame;onchange();};
  return {
    note:'Beat-level fork comparisons share identical earlier linework and rider history. One branch forbids a guide at that section; the other allows it. Each searches the remaining ride. Complete-track comparisons, including independently searched references, can differ throughout the ride. The slider selects among recorded complete tracks within the displayed accuracy allowance; it does not remove rails or run another search. Failed attempts remain available for inspection.',
    select(caseId,budget,seed,method='arcs'){
    portfolio=manifest.portfolios.find(p=>p.caseId===caseId&&p.budget===budget&&p.seed===seed&&(p.method??'arcs')===method);
    if(!portfolio)throw new Error('Missing guide-choice portfolio');
    if(activeKey!==portfolio.key){
      activeKey=portfolio.key;jumpTo=undefined;
      $('choice-fork').replaceChildren(...[{value:'preference',text:'Preferred complete track'},{value:'reference',text:'Original search vs preferred'},...(portfolio.references??[]).filter(id=>id!==portfolio.reference).map(id=>({value:id,text:'Independent unguided search vs preferred'})),...portfolio.decisions.map(d=>({value:key(d),text:`${label(d)} · ${(d.frame/40).toFixed(2)} s`}))].map(({value,text})=>{const o=document.createElement('option');o.value=value;o.textContent=text;return o;}));
    }
    const candidates=portfolio.ids.map(id=>byId.get(id));
    const extra=+$('extra-error').value,choice=selectGuideAlternative(candidates,extra);
    $('extra-error-value').textContent=`+${format(extra)} RMS`;
    $('choice-work').textContent=`Entire recorded search: ${portfolio.physicalFrames.toLocaleString()} of ${portfolio.budget.toLocaleString()} physics frames · ${(portfolio.compileMs/1000).toFixed(1)} s. Includes all starting tracks, both branches at every fork, prefix checks and compiler replays. Moving this control reuses those results.`;
    let cells,titles;
    const fork=portfolio.decisions.find(d=>key(d)===$('choice-fork').value);
    if(fork){
      cells=[byId.get(fork.single),byId.get(fork.guided)];titles=[`${label(fork)} · guide forbidden`,`${label(fork)} · guide allowed`];
      $('choice-explanation').textContent=`Identical earlier linework and rider history through frame ${fork.frame}. Each branch received ${fork.allowancePerBranch.toLocaleString()} physics frames to search and replay its continuation. ${cells.every(c=>c.valid)?'Both continuations passed timing and survival.':cells.every(c=>!c.valid)?'Neither search found a valid complete continuation.':cells[0].valid?'Only the guide-forbidden search found a valid complete continuation.':'Only the guide-allowed search found a valid complete continuation.'}`;
      $('choice-explanation').textContent+=fork.continuationGuides?' Later guide permissions follow the source track in both branches; their geometry is searched again.':' Later guides are allowed in both branches; their geometry is searched again.';
    }else if(choice){
      const mode=$('choice-fork').value;
      const reference=mode==='reference'||mode===portfolio.reference?byId.get(portfolio.reference):(portfolio.references??[]).includes(mode)?byId.get(mode):null;
      cells=[reference??choice.best,choice.selected];titles=[reference?(reference.id===portfolio.reference?'Original guided search':'Independent unguided search'):'Closest match found','Fewer guides within allowance'];
      $('choice-explanation').textContent=`${choice.eligible} of ${candidates.filter(c=>c.valid).length} valid alternatives fit the error ceiling ${format(choice.ceiling,4)}. Ceiling = best found ${format(choice.best.qualityRms,4)} + allowance ${format(extra)}. Selected target error: ${format(choice.selected.qualityRms,4)}. ${choice.selected.usage.guideSections} of ${choice.selected.usage.supportSections} sections retain a guide.`;
    }else{cells=[byId.get(portfolio.reference),byId.get(portfolio.reference)];titles=['Original search','No valid alternative'];$('choice-explanation').textContent='This portfolio contains no valid complete ride. No preference result is claimed.';}
    $('choice-candidates').replaceChildren(...candidates.map(c=>{
      const d=portfolio.decisions.find(d=>d.single===c.id||d.guided===c.id),tr=document.createElement('tr');
      if(c.id===choice?.selected.id)tr.className='selected-choice';
      const first=document.createElement('td'),button=document.createElement('button');
      button.textContent=d?`${label(d)} · ${d.single===c.id?'forbidden':'allowed'}`:c.id===portfolio.reference?'Original guided search':'Independent unguided search';
      button.onclick=()=>{$('choice-fork').value=d?key(d):c.id===portfolio.reference?'reference':c.id;$('choice-fork').dispatchEvent(new Event('change'));};first.append(button);tr.append(first);
      for(const v of [`${c.usage.guideSections}/${c.usage.supportSections}`,format(c.usage.guideLength,1),format(c.qualityRms,4),c.valid?format(c.score.score,1):'Failed contract']){const td=document.createElement('td');td.textContent=v;tr.append(td);}return tr;
    }));
    const at=jumpTo;jumpTo=undefined;return {cells,titles,jumpTo:at};
  }};
}
