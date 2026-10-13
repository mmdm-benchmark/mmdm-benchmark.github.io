'use strict';

const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number = value => value.toLocaleString('en-US');
const fixed = (value, digits = 2) => value == null ? '—' : value.toFixed(digits);
const state = {view:'overall', category:'option_logic', sort:'accuracy', direction:-1, exampleCategory:'option_logic', exampleIndex:0, responseModel:'typesafe-jev-1.13.0'};
let data;
let downloadURL;

function optionsForCategories(select) {
  const ordered = [...data.categories].sort((a,b)=>a.name.localeCompare(b.name));
  select.innerHTML = ordered.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');
}

function modelRows() {
  return data.models.map(model => {
    if (state.view==='overall') return {...model, accuracy:model.hard_accuracy, hard:model.hard_brier, soft:model.soft_brier, validText:`${number(model.valid)} / ${number(data.total)}`};
    const hard = model.category['hard/'+state.category];
    const soft = model.category['soft/'+state.category];
    return {...model, accuracy:hard?.accuracy==null?null:100*hard.accuracy,
      hard:hard?.brier??null,soft:soft?.brier??null,
      valid:(hard?.valid??0)+(soft?.valid??0),
      validText:`H ${hard?`${number(hard.valid)}/${number(hard.n)}`:'—'} · S ${soft?`${number(soft.valid)}/${number(soft.n)}`:'—'}`};
  });
}

function renderLeaderboard() {
  const all = modelRows();
  const best = {};
  for (const key of ['accuracy','hard','soft']) {
    const values=all.map(m=>m[key]).filter(v=>v!==null);
    best[key] = values.length ? (key==='accuracy'?Math.max(...values):Math.min(...values)) : null;
  }
  all.sort((a,b) => {
    if (a[state.sort]==null && b[state.sort]==null) return a.name.localeCompare(b.name);
    if (a[state.sort]==null) return 1;
    if (b[state.sort]==null) return -1;
    return state.direction * (typeof a[state.sort]==='string'?a[state.sort].localeCompare(b[state.sort]):a[state.sort]-b[state.sort]) || a.name.localeCompare(b.name);
  });
  const columns = [['name','Decision Model'],['accuracy','Hard Accuracy ↑'],['hard','Hard Brier ↓'],['soft','Soft Brier ↓'],['valid',state.view==='overall'?'Valid outputs':'Valid / total (H · S)']];
  $('#leaderboard-head').innerHTML = `<tr><th scope="col">#</th>${columns.map(([key,label])=>`<th scope="col" aria-sort="${state.sort===key?(state.direction===1?'ascending':'descending'):'none'}"><button type="button" data-sort="${key}" aria-label="Sort by ${escapeHTML(label.replace(/[↑↓]/g,''))}">${label}<span class="sort-arrow" aria-hidden="true">${state.sort===key?(state.direction===1?'▴':'▾'):'↕'}</span></button></th>`).join('')}</tr>`;
  const query=$('#model-search').value.trim().toLowerCase();
  const visible=all.map((m,i)=>({...m,rank:i+1})).filter(m=>m.name.toLowerCase().includes(query));
  const metric = (m,key,digits) => `<td class="${key==='accuracy'?'accuracy-cell ':''}${m[key]!==null&&m[key]===best[key]?'best':''}"${key==='accuracy'?` style="--bar:${m.accuracy??0}%"`:''}>${fixed(m[key],digits)}${key==='accuracy'&&m.accuracy!==null?'%':''}</td>`;
  $('#leaderboard-body').innerHTML = visible.length ? visible.map(m=>`<tr><td>${m.rank}</td><td><a class="model-link" href="${escapeHTML(m.url)}" target="_blank" rel="noopener">${escapeHTML(m.name)}</a></td>${metric(m,'accuracy',2)}${metric(m,'hard',4)}${metric(m,'soft',4)}<td>${m.validText}</td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:28px">No matching models. Try a different name.</td></tr>';
  const cat = data.categories.find(c=>c.id===state.category);
  $('#table-status').textContent = `${visible.length} of ${data.models.length} configurations · ${state.view==='overall'?'Full benchmark':cat.name} · Bold marks the best value in each metric.`;
  $('#metric-note').textContent = state.view==='overall'
    ? 'Hard Accuracy includes all 4,351 hard items; invalid or unsupported outputs count as incorrect. Brier compares the same 4,014 hard and 558 soft items with valid outputs from every model.'
    : `${cat.name}: ${number(cat.hard)} hard and ${number(cat.soft)} soft targets. Accuracy uses every hard item in this category. Category Brier uses each model’s valid outputs; H and S show valid/total counts. A dash means this target type is absent.`;
}

function renderStatistics() {
  const bins = [[2,2,'2'],[3,4,'3–4'],[5,10,'5–10'],[11,16,'11–16'],[17,62,'17–62'],[63,77,'63–77']];
  $('#option-count-body').innerHTML = bins.map(([lo,hi,label])=>{
    const n=data.option_counts.filter(r=>r.options>=lo&&r.options<=hi).reduce((sum,r)=>sum+r.total,0);
    return `<tr><td>${label}</td><td>${number(n)}</td><td>${(100*n/data.total).toFixed(1)}%</td></tr>`;
  }).join('');
}

function currentExample() {
  return data.examples.filter(e=>e.category===state.exampleCategory)[state.exampleIndex];
}

function renderExample() {
  const list=data.examples.filter(e=>e.category===state.exampleCategory);
  const e=list[state.exampleIndex];
  const soft=e.answer.kind==='soft';
  const category = data.categories.find(c=>c.id===e.category);
  $('#example-count').textContent=`${state.exampleIndex+1} / ${list.length}`;
  $('#previous-example').disabled=list.length===1;
  $('#next-example').disabled=list.length===1;
  $('#example-kind').textContent=soft?'Soft target':'Hard target';
  $('#example-kind').classList.toggle('soft',soft);
  $('#example-meta').textContent=`${e.task==='score'?'Score · ':''}${e.options.length} options · row ${e.row_index}`;
  $('#example-state').textContent=e.state;
  $('#example-question').textContent=e.question;
  $('#example-card').setAttribute('aria-label',`${category.name}, ${soft?'soft':'hard'} example`);
  $('#state-frame').classList.remove('expanded');
  $('#expand-state').setAttribute('aria-expanded','false');
  $('#expand-state').textContent='Read full context ↓';
  $('#example-options').innerHTML = e.options.map((o,i)=>`<li><span class="option-id">${escapeHTML(o.id)}</span><div><div class="option-name">${escapeHTML(o.name)}${e.score_values?`<span class="score-value">score ${e.score_values[i]}</span>`:''}</div>${o.criteria?`<div class="option-criteria">${escapeHTML(o.criteria)}</div>`:''}</div></li>`).join('');
  requestAnimationFrame(()=>{
    const overflow=$('#example-state').scrollHeight>230;
    $('#state-frame').classList.toggle('overflowing',overflow);
    $('#expand-state').hidden=!overflow;
  });
  if(downloadURL)URL.revokeObjectURL(downloadURL);
  downloadURL=URL.createObjectURL(new Blob([JSON.stringify(e,null,2)],{type:'application/json'}));
  $('#download-example').href=downloadURL;
  $('#download-example').download=`mmdm-example-${e.row_index}.json`;
  renderResponse();
}

function renderResponse() {
  const e=currentExample(),q=e.answer.probabilities,p=e.predictions[state.responseModel];
  if(!p){$('#response-chart').textContent='No valid recorded output for this example.';$('#response-summary').textContent='';return;}
  const percent=v=>v>0&&v<.001?'<0.1%':`${(v*100).toFixed(1)}%`;
  $('#response-chart').innerHTML=e.options.map((o,i)=>`<div class="prob-row"><p class="prob-label">${escapeHTML(o.id)}${e.score_values?` · score ${e.score_values[i]}`:''}</p><div class="prob-bars"><div class="prob-track" aria-hidden="true"><span style="width:${q[i]*100}%;background:#b8bec2"></span></div><span class="prob-value" aria-label="${escapeHTML(o.id)} target probability">${escapeHTML(percent(q[i]))}</span><div class="prob-track" aria-hidden="true"><span style="width:${p[i]*100}%;background:#587e9f"></span></div><span class="prob-value" aria-label="${escapeHTML(o.id)} predicted probability">${escapeHTML(percent(p[i]))}</span></div></div>`).join('');
  const brier=p.reduce((sum,v,i)=>sum+(v-q[i])**2,0);
  const predicted=p.indexOf(Math.max(...p));
  const target=q.indexOf(Math.max(...q));
  let summary=e.answer.kind==='hard'?`<strong class="${predicted===target?'result-correct':'result-incorrect'}">${predicted===target?'Correct decision':'Different from the target'}</strong><p>Predicted: ${escapeHTML(e.options[predicted].id)} · Target: ${escapeHTML(e.options[target].id)}</p>`:'<strong>Distributional prediction</strong>';
  summary+=`<p>Brier error: ${brier.toFixed(4)}</p>`;
  if(e.score_values)summary+=`<p>Expected score · target ${q.reduce((s,v,i)=>s+v*e.score_values[i],0).toFixed(2)} / predicted ${p.reduce((s,v,i)=>s+v*e.score_values[i],0).toFixed(2)}</p>`;
  $('#response-summary').innerHTML=summary;
}

async function init() {
  const response=await fetch('data/benchmark.json');
  if(!response.ok)throw new Error(`Benchmark data: HTTP ${response.status}`);
  data=await response.json();
  optionsForCategories($('#example-category'));
  const scope=$('#leader-scope');
  scope.insertAdjacentHTML('beforeend','<optgroup label="By category">'+[...data.categories].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('')+'</optgroup>');
  $('#example-category').value=state.exampleCategory;
  $('#response-model').innerHTML=data.highlighted_models.map(id=>{const m=data.models.find(m=>m.id===id);return `<option value="${id}">${escapeHTML(m.name)}</option>`;}).join('');
  $('#response-model').value=state.responseModel;
  $('#leader-scope').addEventListener('change',event=>{const value=event.target.value;state.view=value==='overall'?'overall':'category';if(state.view==='category')state.category=value;state.sort=state.view==='overall'||data.categories.find(c=>c.id===state.category).hard?'accuracy':'soft';state.direction=state.sort==='accuracy'?-1:1;renderLeaderboard();});
  $('#leaderboard-head').addEventListener('click',event=>{const b=event.target.closest('[data-sort]');if(!b)return;const key=b.dataset.sort;state.direction=state.sort===key?-state.direction:({accuracy:-1,valid:-1,hard:1,soft:1,name:1}[key]);state.sort=key;renderLeaderboard();document.querySelector('[data-sort="'+key+'"]').focus({preventScroll:true});});
  $('#model-search').addEventListener('input',renderLeaderboard);
  $('#example-category').addEventListener('change',event=>{state.exampleCategory=event.target.value;state.exampleIndex=0;renderExample();});
  for(const [id,direction] of [['#previous-example',-1],['#next-example',1]])$(id).addEventListener('click',()=>{const n=data.examples.filter(e=>e.category===state.exampleCategory).length;state.exampleIndex=(state.exampleIndex+direction+n)%n;renderExample();});
  $('#response-model').addEventListener('change',event=>{state.responseModel=event.target.value;renderResponse();});
  $('#expand-state').addEventListener('click',()=>{const expanded=$('#state-frame').classList.toggle('expanded');$('#expand-state').setAttribute('aria-expanded',String(expanded));$('#expand-state').textContent=expanded?'Collapse context ↑':'Read full context ↓';});
  $('#copy-code').addEventListener('click',async()=>{const b=$('#copy-code');try{await navigator.clipboard.writeText($('#load-code').textContent);b.textContent='Copied';}catch{b.textContent='Select to copy';const range=document.createRange();range.selectNodeContents($('#load-code'));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}setTimeout(()=>{b.textContent='Copy';},2000);});
  renderLeaderboard();renderStatistics();renderExample();
  document.documentElement.dataset.ready='true';
}
init().catch(error=>{console.error(error);$('#load-error').hidden=false;$('#leaderboard-body').innerHTML='<tr><td colspan="6">Results could not load. Please refresh the page.</td></tr>';});
