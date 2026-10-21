'use strict';
const D=JSON.parse(document.getElementById('benchmark-data').textContent);
const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number(x).toLocaleString('en-US'), pct=x=>(100*x).toFixed(2)+'%', fmt=(x,k)=>x==null?'—':k==='soft'?x.toFixed(4):pct(x);
const LABELS={single:'Hard Single',set:'Hard Set',soft:'Soft'}, LABEL_COLORS={single:'#8E9EAC',set:'#B2A5B2',soft:'#8FA7A2'};
const DEFAULT_MODELS=D.provenance.representative_models;
const FIGURE_MODELS=[...DEFAULT_MODELS.map(id=>D.models.find(m=>m.id===id)),...D.models.filter(m=>!DEFAULT_MODELS.includes(m.id))];
const state={scope:'overall',sort:'single',direction:-1,selected:new Set(DEFAULT_MODELS),radar:'single',exampleIndex:0};
const urls=new Map();
function download(id,value,name){if(urls.has(id))URL.revokeObjectURL(urls.get(id));const u=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));urls.set(id,u);$(id).href=u;$(id).download=name;}
function scopeCounts(){return state.scope==='overall'?{name:'All categories',total:D.total,single:D.single,set:D.set,soft:D.soft}:D.categories.find(c=>c.id===state.scope);}
function modelMetric(m){return state.scope==='overall'?m.metrics:m.categories[state.scope];}
function displayMetric(m,k){return modelMetric(m)?.[k]??null;}
function renderLeaderboard(){
 const q=$('#model-search').value.trim().toLowerCase(),counts=scopeCounts();
 const sorted=[...D.models].sort((a,b)=>{
  if(a.id==='random')return 1;if(b.id==='random')return -1;
  const x=state.sort==='name'?a.name:displayMetric(a,state.sort), y=state.sort==='name'?b.name:displayMetric(b,state.sort);
  if(x==null&&y==null)return a.name.localeCompare(b.name);if(x==null)return 1;if(y==null)return -1;
  return (typeof x==='string'?x.localeCompare(y):x-y)*state.direction||a.name.localeCompare(b.name);
 });
 const best={};for(const k of ['single','set','soft']){const v=D.models.filter(m=>m.id!=='random').map(m=>displayMetric(m,k)).filter(v=>v!=null);best[k]=v.length?(k==='soft'?Math.min(...v):Math.max(...v)):null;}
 const cols=[['name','Decision Model'],['single','Hard Single Acc ↑'],['set','Hard Set Acc ↑'],['soft','Soft Brier ↓']];
 $('#leaderboard-head').innerHTML='<tr><th scope="col">#</th>'+cols.map(([k,t])=>`<th scope="col" aria-sort="${state.sort===k?(state.direction===1?'ascending':'descending'):'none'}"><button type="button" data-sort="${k}">${t}<span class="sort-arrow" aria-hidden="true">${state.sort===k?(state.direction===1?'▴':'▾'):'↕'}</span></button></th>`).join('')+'</tr>';
 const visible=sorted.map((m,i)=>({...m,rank:m.id==='random'?'—':i+1})).filter(m=>m.name.toLowerCase().includes(q));
 $('#leaderboard-body').innerHTML=visible.length?visible.map(m=>{
  const values=['single','set','soft'].map(k=>{const v=displayMetric(m,k),n=modelMetric(m)?.[k+'_n'];return `<td data-metric="${k}" data-value="${v??''}" class="${v==null?'metric-dash':v===best[k]&&m.id!=='random'?'best':''}" title="${v==null?'Not applicable or no recorded result':k==='soft'?`Brier over ${num(n)} valid full-distribution outputs`:`Accuracy over all ${num(n)} ${LABELS[k]} items`}">${fmt(v,k)}</td>`;}).join('');
  const name=m.url?`<a class="model-link" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.name)}</a>`:`<span class="model-name">${esc(m.name)}</span>`;
  return `<tr data-model="${esc(m.id)}" class="${m.id==='random'?'baseline-row':''}"><td>${m.rank}</td><td>${name}</td>${values}</tr>`;
 }).join(''):'<tr><td colspan="5" style="text-align:center;padding:24px">No matching models.</td></tr>';
 $('#subset-counts').innerHTML=`<strong>${esc(counts.name)}</strong> · ${num(counts.total)} examples &nbsp; <span>Single ${num(counts.single)}</span> · <span>Set ${num(counts.set)}</span> · <span>Soft ${num(counts.soft)}</span>`;
 $('#table-status').textContent=`${visible.length} results shown · Bold marks the best model value in each metric.`;
}
function tip(text){return `<title>${esc(text)}</title>`;}
function svgText(x,y,lines,attrs=''){return `<text x="${x}" y="${y}" ${attrs}>${lines.map((l,i)=>`<tspan x="${x}" dy="${i?17:0}">${esc(l)}</tspan>`).join('')}</text>`;}
function selectedModels(){return FIGURE_MODELS.filter(m=>state.selected.has(m.id));}
function renderRadar(){
 const kind=state.radar,cats=D.categories.filter(c=>c[kind]>0),models=selectedModels(),cx=350,cy=282,radius=169,n=cats.length;
 const point=(i,r)=>[cx+r*Math.sin(2*Math.PI*i/n),cy-r*Math.cos(2*Math.PI*i/n)];
 const pts=r=>cats.map((_,i)=>point(i,r).join(',')).join(' ');
 let s='<svg viewBox="0 0 700 560" role="img" aria-labelledby="radar-svg-title"><title id="radar-svg-title">'+(kind==='single'?'Hard Single':'Hard Set')+' accuracy by task category, in percent</title>';
 for(const v of [20,40,60,80,100]){s+=`<polygon points="${pts(radius*v/100)}" class="grid"/>`+svgText(cx+5,cy-radius*v/100-4,[String(v)],'class="tick-label"');}
 cats.forEach((c,i)=>{const [x,y]=point(i,radius),[lx,ly]=point(i,radius+44),anchor=Math.abs(lx-cx)<15?'middle':lx>cx?'start':'end',lines=c.short.split('|');s+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="grid"/>`+svgText(lx,ly-(lines.length-1)*8+5,lines,`text-anchor="${anchor}" class="axis-label"`);});
 models.forEach(m=>{const vals=cats.map(c=>m.categories[c.id][kind]);if(vals.some(v=>v==null))return;const points=vals.map((v,i)=>point(i,radius*v));s+=`<polygon points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${m.color}" stroke-width="2" opacity=".95"/>`;points.forEach(([x,y],i)=>{s+=`<circle class="chart-point" cx="${x}" cy="${y}" r="3" fill="${m.color}" tabindex="0" aria-label="${esc(m.name+': '+cats[i].name+' '+fmt(vals[i],kind))}">${tip(m.name+' · '+cats[i].name+': '+fmt(vals[i],kind)+' (n = '+cats[i][kind]+')')}</circle>`;});});
 s+='</svg>';$('#radar-chart').innerHTML=s;$('#radar-title').textContent=kind==='single'?'Hard Single Accuracy':'Hard Set Accuracy';
}
function renderSoft(){
 const models=selectedModels(),groups=[['all',['All soft targets'],D.soft],['score',['Score & rubrics'],D.score_soft],['other',['Other soft tasks'],D.soft-D.score_soft]];
 const values=models.flatMap(m=>Object.values(m.scatter).map(v=>v.value).filter(v=>v!=null)),max=Math.max(.1,Math.ceil(Math.max(0,...values)*10)/10),left=176,right=525,top=78,bottom=453;
 const X=v=>left+(right-left)*v/max;
 let s='<svg viewBox="0 0 560 560" role="img" aria-labelledby="soft-svg-title"><title id="soft-svg-title">Soft Brier error by task group. Lower is better.</title>';
 const ticks=5;for(let i=0;i<=ticks;i++){const v=max*i/ticks,x=X(v);s+=`<line x1="${x}" x2="${x}" y1="${top}" y2="${bottom}" class="grid"/>`+svgText(x,480,[v.toFixed(2)],'text-anchor="middle" class="tick-label"');}
 groups.forEach(([key,lines,count],gi)=>{
  const y=134+gi*131;s+=svgText(left-19,y-6,lines.concat(`(n = ${num(count)})`),'text-anchor="end" class="axis-label"');
  models.forEach((m,i)=>{const v=m.scatter[key];if(v.value==null)return;const py=y+(i-(models.length-1)/2)*Math.min(12,74/Math.max(1,models.length-1)),x=X(v.value),label=`${m.name} · ${lines[0]}: ${v.value.toFixed(4)} (n = ${v.n})`;s+=`<circle class="chart-point" cx="${x}" cy="${py}" r="4.8" fill="${m.color}" tabindex="0" aria-label="${esc(label)}">${tip(label)}</circle>`;});
 });s+=svgText((left+right)/2,513,['Brier error (lower is better)'],'text-anchor="middle" class="axis-label"')+'</svg>';$('#soft-chart').innerHTML=s;
}
function renderFigures(){
 renderRadar();renderSoft();
 const models=FIGURE_MODELS.filter(m=>DEFAULT_MODELS.includes(m.id)||state.selected.has(m.id));
 $('#figure-legend').innerHTML=models.map(m=>`<button type="button" class="legend-button" data-model="${esc(m.id)}" aria-pressed="${state.selected.has(m.id)}"><i style="background:${m.color}" aria-hidden="true"></i>${esc(m.name)}</button>`).join('');
 document.querySelectorAll('#figure-models input').forEach(el=>{el.checked=state.selected.has(el.value);});
}
function renderCategories(){
 const cats=[...D.categories].sort((a,b)=>b.total-a.total),max=Math.ceil(cats[0].total/100)*100;
 const left=70,right=1160,top=25,bottom=285,step=(right-left)/cats.length,barWidth=step*.72;
 const Y=v=>bottom-v/max*(bottom-top);
 let chart='<svg viewBox="0 0 1200 495" role="img" aria-labelledby="category-svg-title"><title id="category-svg-title">Task distribution of MMDM: 5,448 examples across 16 categories</title>';
 for(let v=0;v<=max;v+=100){const y=Y(v);chart+=`<line x1="${left}" x2="${right}" y1="${y}" y2="${y}" stroke="#DEDCD7" stroke-width=".7"/><text x="${left-13}" y="${y+5}" text-anchor="end" font-size="15">${v}</text>`;}
 chart+=`<text transform="translate(22 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle" font-size="18">#Tasks</text>`;
 cats.forEach((c,i)=>{const x=left+step*(i+.5),y=Y(c.total);chart+=`<g data-category="${c.id}" tabindex="0" role="link" aria-label="Show ${esc(c.name)} results, ${c.total} examples">${tip(c.name+': '+c.total+' examples; Hard Single '+c.single+', Hard Set '+c.set+', Soft '+c.soft)}<rect x="${x-barWidth/2}" y="${y}" width="${barWidth}" height="${bottom-y}" fill="${c.color}"/><text x="${x}" y="${y-9}" text-anchor="middle" font-size="16">${c.total}</text><text transform="translate(${x+3} ${bottom+20}) rotate(-42)" text-anchor="end" font-size="16">${esc(c.name)}</text></g>`;});
 $('#category-chart').innerHTML=chart+'</svg>';
}
function renderLabels(){
 const segments=['single','set','soft'];let offset=0;
 const circles=segments.map(k=>{const length=D[k]/D.total*100,s=`<circle cx="90" cy="90" r="69" pathLength="100" fill="none" stroke="${LABEL_COLORS[k]}" stroke-width="18" stroke-dasharray="${length} ${100-length}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)">${tip(`${LABELS[k]}: ${num(D[k])} (${(length).toFixed(2)}%)`)}</circle>`;offset+=length;return s;}).join('');
 $('#label-chart').innerHTML=`<div class="label-stat"><svg class="label-donut" viewBox="0 0 180 180" role="img" aria-label="4,112 hard single, 633 hard set, 703 soft examples">${circles}<text x="90" y="89" text-anchor="middle" font-size="27">${num(D.total)}</text><text x="90" y="110" text-anchor="middle" font-size="13">examples</text></svg><div class="label-list">${segments.map(k=>`<div class="label-row"><i class="label-dot" style="background:${LABEL_COLORS[k]}" aria-hidden="true"></i><span>${LABELS[k]}<small>${(D[k]/D.total*100).toFixed(2)}%</small></span><b>${num(D[k])}</b></div>`).join('')}</div></div>`;
 $('#score-chart').innerHTML=`<p class="score-total">${num(D.score)}<small>${(D.score/D.total*100).toFixed(2)}% of MMDM</small></p><div class="stacked-bar" role="img" aria-label="Score: ${D.score_single} hard single and ${D.score_soft} soft"><span style="width:${D.score_single/D.score*100}%;background:${LABEL_COLORS.single}" title="${D.score_single} Hard Single"></span><span style="width:${D.score_soft/D.score*100}%;background:${LABEL_COLORS.soft}" title="${D.score_soft} Soft"></span></div><div class="score-legend"><span><i style="background:${LABEL_COLORS.single}"></i>Hard Single <strong>${D.score_single}</strong></span><span><i style="background:${LABEL_COLORS.soft}"></i>Soft <strong>${D.score_soft}</strong></span></div>`;
}
function bars(rows,color='#8E9EAC'){const max=Math.max(...rows.map(r=>r.n),1);return `<div class="mini-bars">`+rows.map(r=>`<div class="mini-bar"><span>${esc(r.label)}</span><span class="track"><i style="width:${r.n/max*100}%;background:${color}" title="${num(r.n)} examples · ${(100*r.n/D.total).toFixed(2)}%"></i></span><b>${num(r.n)}</b></div>`).join('')+'</div>';}
function renderContext(){const k=$('#length-kind').value,p=D.length_profile[k];$('#context-chart').innerHTML=bars(D.length_profile.bins.map(b=>({label:b.label,n:b[k]})),'#94A7B0');$('#context-summary').innerHTML=`Median <strong>${num(p.median)}</strong> · 95th percentile <strong>${num(p.p95)}</strong> · Maximum <strong>${num(p.max)}</strong> tokens`;}
function renderOptions(){
 const bins=[[2,2,'2'],[3,4,'3–4'],[5,8,'5–8'],[9,16,'9–16'],[17,64,'17–64'],[65,255,'65–255'],[256,1024,'256–1,024']];
 const rows=bins.map(([lo,hi,label])=>({label,n:D.option_counts.filter(r=>r.options>=lo&&r.options<=hi).reduce((s,r)=>s+r.total,0)}));
 $('#option-chart').innerHTML=bars(rows,'#ADA28F');
 const above=D.option_counts.filter(r=>r.options>255).reduce((s,r)=>s+r.total,0);let cumulative=0,median=0;for(const x of D.option_counts){cumulative+=x.total;if(cumulative>=D.total/2){median=x.options;break;}}
 $('#option-summary').innerHTML=`Range <strong>2–1,024</strong> · Median <strong>${median}</strong> · <strong>${above}</strong> examples with more than 255 options`;
}
function renderExample(){
 const items=D.examples,e=items[state.exampleIndex],kind={hard_single:'Hard Single',hard_set:'Hard Set',soft:'Soft'}[e.kind];
 $('#example-count').textContent=`${state.exampleIndex+1} / ${items.length}`;$('#previous-example').disabled=items.length<2;$('#next-example').disabled=items.length<2;
 $('#example-card').dataset.exampleId=e.id;$('#example-kind').textContent=kind;$('#example-category-name').textContent=D.categories.find(c=>c.id===e.category).name;$('#example-meta').textContent=`${e.task==='score'?'Score · ':''}${e.options.length} options`;$('#example-state').textContent=e.state;$('#example-question').textContent=e.question;
 $('#state-frame').classList.remove('expanded');$('#expand-state').setAttribute('aria-expanded','false');$('#expand-state').textContent='Read full context ↓';
 $('#example-options').innerHTML=e.options.map(o=>`<li><span class="option-id">${esc(o.id)}</span><div><div class="option-name">${esc(o.name)}</div>${o.criteria?`<div class="option-criteria">${esc(o.criteria)}</div>`:''}</div></li>`).join('');
 const opts=new Map(e.options.map(o=>[o.id,o.name]));
 $('#answer-summary').textContent=e.kind==='soft'?'Target probability for each candidate:':(e.kind==='hard_set'?'Complete correct set: ':'Correct option: ')+e.correct_option_ids.map(id=>`${id} (${opts.get(id)})`).join('; ');
 $('#answer-chart').innerHTML=e.kind==='soft'?'<div class="mini-bars">'+e.options.map((o,i)=>`<div class="mini-bar"><span>${esc(o.id)}${e.score_values?' · '+esc(e.score_values[i]):''}</span><span class="track"><i style="width:${e.gold[i]*100}%;background:${LABEL_COLORS.soft}"></i></span><b>${(e.gold[i]*100).toFixed(1)}%</b></div>`).join('')+'</div>':'';
 $('#example-source').textContent=`Source: ${e.source.dataset} · ${e.task_subcategory}`;
 download('#download-example',e,`mmdm-example-${e.id.replace(/^mmdm-v2-/,'')}.json`);
 requestAnimationFrame(()=>{$('#expand-state').hidden=$('#example-state').scrollHeight<=230;});
}
function renderResultsSummary(){
 const results=D.models.filter(m=>m.id!=='random');
 const best=k=>results.filter(m=>m.metrics[k]!=null).reduce((a,b)=>(k==='soft'?a.metrics[k]<b.metrics[k]:a.metrics[k]>b.metrics[k])?a:b);
 const single=best('single'),set=best('set'),soft=best('soft');
 const hardResult=single.id===set.id
  ? `<strong>${esc(single.name)}</strong> leads both hard-label evaluations, with <strong>${fmt(single.metrics.single,'single')} Hard Single Accuracy</strong> and <strong>${fmt(set.metrics.set,'set')} Hard Set Accuracy</strong>.`
  : `<strong>${esc(single.name)}</strong> achieves the highest Hard Single Accuracy at <strong>${fmt(single.metrics.single,'single')}</strong>, while <strong>${esc(set.name)}</strong> leads Hard Set Accuracy at <strong>${fmt(set.metrics.set,'set')}</strong>.`;
 $('#result-summary').innerHTML=`With <img class="benchmark-logo inline-logo" src="${$('#main-logo').src}" alt="" width="24" height="24"><strong>MMDM</strong>, we conduct a comprehensive, quantitative evaluation of <strong>${results.length} System-1 Decision Models</strong> across ${D.categories.length} task categories. ${hardResult} <strong>${esc(soft.name)}</strong> achieves the lowest Soft Brier error (${fmt(soft.metrics.soft,'soft')}), measuring how closely its predicted probabilities match the reference distributions.`;
 const categoryAccuracy=id=>fmt(single.categories[id].single,'single');
 $('#result-analysis').innerHTML=`MMDM shows that many models perform well on common knowledge questions yet struggle with interdependent options, decisions subject to constraints, and emotional interpretation. For example, ${esc(single.name)} reaches ${categoryAccuracy('world_knowledge')} Hard Single Accuracy on world knowledge, but ${categoryAccuracy('constraint_planning')} on constraint planning and ${categoryAccuracy('emotion_recognition')} on emotion recognition. These gaps make MMDM a testbed for developing decision models that combine broad knowledge with reliable logical reasoning and context-sensitive judgment.`;
}
function init(){
 const logo=$('#main-logo').src;document.querySelectorAll('[data-logo]').forEach(el=>el.src=logo);$('#page-icon').href=logo;
 const alphabetical=[...D.categories].sort((a,b)=>a.name.localeCompare(b.name));const categoryOptions=alphabetical.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
 $('#leader-scope').insertAdjacentHTML('beforeend',categoryOptions);
 $('#snapshot-date').textContent=`Results snapshot: ${D.snapshot_time}`;
 renderResultsSummary();
 $('#figure-models').innerHTML=FIGURE_MODELS.map(m=>`<label><input type="checkbox" value="${esc(m.id)}" ${state.selected.has(m.id)?'checked':''}>${esc(m.name)}</label>`).join('');
 $('#figure-models').addEventListener('change',ev=>{if(ev.target.checked)state.selected.add(ev.target.value);else state.selected.delete(ev.target.value);renderFigures();});
 $('#figure-legend').addEventListener('click',ev=>{const b=ev.target.closest('[data-model]');if(!b)return;state.selected.has(b.dataset.model)?state.selected.delete(b.dataset.model):state.selected.add(b.dataset.model);renderFigures();});
 $('#reset-models').addEventListener('click',()=>{state.selected=new Set(DEFAULT_MODELS);renderFigures();});
 $('#radar-kind').addEventListener('change',ev=>{state.radar=ev.target.value;renderFigures();});
 function chooseSort(){const c=scopeCounts();state.sort=c.single?'single':c.set?'set':'soft';state.direction=state.sort==='soft'?1:-1;}
 $('#leader-scope').addEventListener('change',ev=>{state.scope=ev.target.value;chooseSort();renderLeaderboard();});
 $('#leaderboard-head').addEventListener('click',ev=>{const b=ev.target.closest('[data-sort]');if(!b)return;const k=b.dataset.sort;state.direction=state.sort===k?-state.direction:k==='single'||k==='set'?-1:1;state.sort=k;renderLeaderboard();$(`[data-sort="${k}"]`).focus({preventScroll:true});});
 $('#model-search').addEventListener('input',renderLeaderboard);
 $('#category-chart').addEventListener('click',ev=>{const b=ev.target.closest('[data-category]');if(!b)return;state.scope=b.dataset.category;$('#leader-scope').value=state.scope;chooseSort();renderLeaderboard();$('#leaderboard').scrollIntoView();});
 $('#category-chart').addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){const g=ev.target.closest('[data-category]');if(g){ev.preventDefault();g.dispatchEvent(new MouseEvent('click',{bubbles:true}));}}});
 $('#length-kind').addEventListener('change',renderContext);
 for(const [id,step] of [['#previous-example',-1],['#next-example',1]])$(id).addEventListener('click',()=>{const count=D.examples.length;state.exampleIndex=(state.exampleIndex+step+count)%count;renderExample();});
 $('#expand-state').addEventListener('click',()=>{const on=$('#state-frame').classList.toggle('expanded');$('#expand-state').setAttribute('aria-expanded',String(on));$('#expand-state').textContent=on?'Collapse context ↑':'Read full context ↓';});
 renderLeaderboard();renderFigures();renderCategories();renderLabels();renderContext();renderOptions();renderExample();document.documentElement.dataset.ready='true';
}
try{init();}catch(e){console.error(e);$('#load-error').hidden=false;}
