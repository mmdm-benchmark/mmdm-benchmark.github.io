/* Shared chart transitions and the set/size analysis views. No external runtime. */
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const chartJobs = new Map();
function drawChart(selector, markup, topology) {
 const host = $(selector), previous = host.querySelector('svg');
 const oldKey = host.dataset.topology;
 const oldGeometry = new Map([...host.querySelectorAll('[data-motion]')].map(e => [e.dataset.motion, e]));
 const oldBox = previous?.getAttribute('viewBox');
 if (chartJobs.has(host)) cancelAnimationFrame(chartJobs.get(host));
 host.getAnimations({subtree:true}).forEach(a => a.cancel());
 host.innerHTML = markup; host.dataset.topology = topology;
 if (!previous || motionPreference.matches) return;
 const svg = host.querySelector('svg');
 if (oldKey !== topology || oldBox !== svg?.getAttribute('viewBox')) {
  // Different axes (e.g. the two radars) dissolve instead of inventing intermediate values.
  host.animate([{opacity:.25, transform:'translateY(3px)'},{opacity:1, transform:'none'}], {duration:280,easing:'ease-out'});
  return;
 }
 const transitions = [], attrs = ['cx','cy','x','y','r','points','d'];
 const numberPattern = /-?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi;
 for (const next of host.querySelectorAll('[data-motion]')) {
  const old = oldGeometry.get(next.dataset.motion);
  if (!old) { next.animate([{opacity:0},{opacity:1}], {duration:320,easing:'ease-out'}); continue; }
  for (const attr of attrs) {
   const from = old.getAttribute(attr), to = next.getAttribute(attr);
   if (from == null || to == null || from === to) continue;
   const a = [...from.matchAll(numberPattern)].map(m => Number(m[0]));
   const b = [...to.matchAll(numberPattern)].map(m => Number(m[0]));
   if (!a.length || a.length !== b.length || from.replace(numberPattern,'#') !== to.replace(numberPattern,'#')) continue;
   transitions.push({node:next,attr,to,a,b}); next.setAttribute(attr,from);
  }
 }
 if (!transitions.length) return;
 const begin = performance.now();
 function frame(now) {
  const t = motionPreference.matches ? 1 : Math.min(1,(now-begin)/400), eased = 1-Math.pow(1-t,3);
  transitions.forEach(({node,attr,to,a,b}) => {
   let i=0; node.setAttribute(attr,t===1?to:to.replace(numberPattern,()=>{const j=i++;return String(a[j]+(b[j]-a[j])*eased);}));
  });
  if (t<1) chartJobs.set(host,requestAnimationFrame(frame)); else chartJobs.delete(host);
 }
 chartJobs.set(host,requestAnimationFrame(frame));
}
function activateTabs(selector, value, attribute, panel, prefix) {
 document.querySelectorAll(selector).forEach(b=>{const on=b.dataset[attribute]===value;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
 $(panel).setAttribute('aria-labelledby',prefix+value);
}
function bindTabs(selector, attribute, select) {
 const tabs=[...document.querySelectorAll(selector)];
 tabs.forEach((b,i)=>{
  b.addEventListener('click',()=>select(b.dataset[attribute]));
  b.addEventListener('keydown',ev=>{
   if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
   ev.preventDefault();
   const j=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:(i+(ev.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
   select(tabs[j].dataset[attribute]);tabs[j].focus();
  });
 });
}
function renderSetDiagnostics() {
 const models=selectedModels().filter(m=>m.id!=='random'&&m.set_diagnostics),compact=matchMedia('(max-width:580px)').matches;
 const width=compact?600:1000,step=compact?72:46,first=compact?133:125;
 const bottom=first+Math.max(0,models.length-1)*step+32,height=bottom+67;
 const columns=compact?[[38,235,280],[330,525,575]]:[[270,520,590],[665,915,983]];
 let s=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="set-svg-title"><title id="set-svg-title">Hard Set exact match and probability balance</title>`;
 columns.forEach(([l,r],i)=>{
  s+=svgText((l+r)/2,40,[i?'Top-N balance':'Exact set match'],'text-anchor="middle" class="set-column-title"');
  s+=svgText((l+r)/2,65,[i?'Valid native predictions':'All 633 Hard Set tasks'],'text-anchor="middle" class="set-column-subtitle"');
  for(let tick=0;tick<=4;tick++){const x=l+(r-l)*tick/4;s+=`<path d="M${x} 85V${bottom}" class="grid"/>`+svgText(x,bottom+26,[String(tick*25)],'text-anchor="middle" class="tick-label"');}
 });
 models.forEach((m,i)=>{
  const y=first+i*step,ds=m.set_diagnostics;
  s+=svgText(compact?38:248,compact?y-20:y+5,[m.name],`text-anchor="${compact?'start':'end'}" class="set-model-name"`);
  [ds.exact.accuracy_all,ds.native_balance.mean].forEach((value,j)=>{
   const [l,r,labelX]=columns[j],n=j?ds.native_balance.n:ds.exact.rows;
   const label=`${m.name} · ${j?'Top-N balance (native)':'Exact set match (all tasks)'}: ${value==null?'not available':pct(value)} · n = ${num(n)}`;
   s+=`<path d="M${l} ${y}H${r}" stroke="#e8e8e4" stroke-width="2"/>`;
   if(value!=null)s+=`<circle data-motion="set-${m.id}-${j}" data-set-model="${esc(m.id)}" data-set-metric="${j?'balance':'exact'}" data-value="${value}" cx="${l+(r-l)*value}" cy="${y}" r="5.5" fill="${j?'#fff':m.color}" stroke="${m.color}" stroke-width="2.4" tabindex="0" data-readout="${esc(label)}" aria-label="${esc(label)}">${tip(label)}</circle>`;
   s+=svgText(labelX,y+5,[value==null?'—':(value*100).toFixed(1)+'%'],'text-anchor="end" class="set-value"');
  });
 });
 if(!models.length)s+=svgText(width/2,115,['Select a model to view Hard Set results.'],'text-anchor="middle" class="axis-label"');
 s+=svgText(width/2,bottom+56,['Higher is better (%)'],'text-anchor="middle" class="axis-label"')+'</svg>';
 drawChart('#calibration-chart',s,'hard-set-'+models.length);
 $('#calibration-legend').innerHTML='';
 $('#calibration-readout').textContent='Hover over or focus on a point to inspect its value and sample count.';
 $('#calibration-caption').textContent='Exact match measures whether the whole set is correct. Balance measures how evenly the selected options share probability. Read the two together: equal weighting alone does not imply a correct set.';
}
function paretoModels() {
 return (state.paretoPool==='selected'?selectedModels():D.models).filter(m=>m.id!=='random'&&m.metrics[state.pareto]!=null);
}
function paretoFrontier(models,metric) {
 const known=models.filter(m=>m.metadata.parameters_b!=null);
 const better=(a,b)=>metric==='soft'?a<=b:a>=b;
 return known.filter(a=>!known.some(b=>b.id!==a.id&&b.metadata.parameters_b<=a.metadata.parameters_b&&better(b.metrics[metric],a.metrics[metric])&&(b.metadata.parameters_b<a.metadata.parameters_b||b.metrics[metric]!==a.metrics[metric]))).sort((a,b)=>a.metadata.parameters_b-b.metadata.parameters_b||a.name.localeCompare(b.name));
}
function renderPareto() {
 const metric=state.pareto,soft=metric==='soft',models=paretoModels(),known=models.filter(m=>m.metadata.parameters_b!=null),unknown=models.filter(m=>m.metadata.parameters_b==null);
 const frontier=paretoFrontier(models,metric),frontIds=new Set(frontier.map(m=>m.id));
 const compact=matchMedia('(max-width:580px)').matches,width=compact?600:1000,left=82,right=width-35,top=45,bottom=430;
 const xmin=Math.min(.5,...known.map(m=>m.metadata.parameters_b)),xmax=Math.max(40,...known.map(m=>Math.ceil(m.metadata.parameters_b/10)*10));
 const ymax=soft?Math.max(.1,Math.ceil(Math.max(0,...models.map(m=>m.metrics.soft))*10)/10):1;
 const X=x=>left+(right-left)*Math.log(x/xmin)/Math.log(xmax/xmin),Y=y=>bottom-(bottom-top)*y/ymax;
 const label=soft?'Soft Brier ↓':`${LABELS[metric]} Accuracy (%) ↑`;
 let s=`<svg viewBox="0 0 ${width} 535" role="img" aria-labelledby="pareto-svg-title"><title id="pareto-svg-title">${label} versus model size</title>`;
 for(let i=0;i<=5;i++){const v=ymax*i/5,y=Y(v);s+=`<path d="M${left} ${y}H${right}" class="grid"/>`+svgText(left-14,y+5,[soft?v.toFixed(2):String(Math.round(v*100))],'text-anchor="end" class="tick-label"');}
 for(let v=.5;v<=xmax;v*=2){if(v<xmin)continue;const x=X(v);s+=`<path d="M${x} ${top}V${bottom}" class="grid"/>`+svgText(x,461,[String(v)],'text-anchor="middle" class="tick-label"');}
 unknown.forEach(m=>{
  const y=Y(m.metrics[metric]),text=`${m.name} · size undisclosed · ${soft?'Soft Brier':'accuracy'} ${fmt(m.metrics[metric],metric)}`;
  s+=`<g data-undisclosed="${esc(m.id)}" tabindex="0" data-readout="${esc(text)}" aria-label="${esc(text)}">${tip(text)}<path data-motion="unknown-${m.id}" d="M${left} ${y}H${right}" stroke="${m.color}" stroke-width="1.7" stroke-dasharray="7 5" fill="none"/><path d="M${left} ${y}H${right}" stroke="transparent" stroke-width="14" fill="none"/></g>`;
 });
 const unique=frontier.filter((m,i,a)=>!i||m.metadata.parameters_b!==a[i-1].metadata.parameters_b||m.metrics[metric]!==a[i-1].metrics[metric]);
 if(unique.length){const path=unique.map((m,i)=>`${i?'H':'M'}${X(m.metadata.parameters_b)}${i?'V':' '}${Y(m.metrics[metric])}`).join('');s+=`<path data-motion="frontier" data-frontier-path="true" d="${path}" stroke="#778B83" stroke-width="2" fill="none" opacity=".7"/>`;}
 const coords=known.map(m=>({m,x:X(m.metadata.parameters_b),y:Y(m.metrics[metric])}));
 coords.forEach(({m,x,y})=>{
  const val=m.metrics[metric],text=`${m.name} · ${m.metadata.parameters_b}B${m.metadata.active_parameters_b?' total / '+m.metadata.active_parameters_b+'B active':''} · ${soft?'Soft Brier':'accuracy'} ${fmt(val,metric)} · n = ${num(m.metrics[metric+'_n'])}${frontIds.has(m.id)?' · Pareto frontier':''}`;
  if(frontIds.has(m.id))s+=`<circle data-motion="ring-${m.id}" cx="${x}" cy="${y}" r="9" stroke="${m.color}" stroke-width="1.3" fill="#fff"/>`;
  s+=`<circle data-motion="pareto-${m.id}" data-pareto-model="${esc(m.id)}" data-frontier="${frontIds.has(m.id)}" data-value="${val}" cx="${x}" cy="${y}" r="5" fill="${m.color}" stroke="#fff" stroke-width="1" tabindex="0" data-readout="${esc(text)}" aria-label="${esc(text)}">${tip(text)}</circle>`;
 });
 // Label the frontier and representative models where there is space; every point has a readout.
 const boxes=[],labelCandidates=coords.filter(c=>frontIds.has(c.m.id)||DEFAULT_MODELS.includes(c.m.id)).sort((a,b)=>Number(frontIds.has(b.m.id))-Number(frontIds.has(a.m.id)));
 for(const {m,x,y} of labelCandidates){
  const name=m.name,w=name.length*(compact?8.4:7.7),h=20;
  const candidates=[[x+13,y-24],[x+13,y+8],[x-w-13,y-24],[x-w-13,y+8],[x-w/2,y-38],[x-w/2,y+23]];
  const pos=candidates.find(([a,b])=>a>=left&&a+w<=right&&b>=top&&b+h<=bottom&&!boxes.some(o=>a<o.x+o.w+6&&a+w+6>o.x&&b<o.y+o.h+4&&b+h+4>o.y)&&!coords.some(c=>c.m.id!==m.id&&c.x>a-7&&c.x<a+w+7&&c.y>b-7&&c.y<b+h+7));
  if(!pos)continue;const [lx,ly]=pos;boxes.push({x:lx,y:ly,w,h});
  s+=svgText(lx,ly+15,[name],'class="pareto-point-label"');
 }
 s+=svgText((left+right)/2,507,['Reported parameters (B, log scale)'],'text-anchor="middle" class="axis-label"');
 s+=`<text transform="translate(23 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle" class="axis-label">${label}</text>`;
 if(!models.length)s+=svgText(width/2,220,['Select models to compare.'],'text-anchor="middle" class="axis-label"');
 drawChart('#pareto-chart',s+'</svg>','pareto');
 $('#pareto-legend').innerHTML='<span><i class="frontier-key"></i>Pareto frontier</span>'+unknown.map(m=>`<span><i class="unknown-key" style="border-color:${m.color}"></i>${esc(m.name)} · size undisclosed</span>`).join('');
 $('#pareto-readout').textContent=`Hover over or focus on a point or dashed line to inspect a model. ${soft?'Lower and further left is better.':'Higher and further left is better.'}`;
 $('#pareto-caption').textContent=`${models.length} models shown. ${frontier.length?'Frontier among disclosed sizes: '+frontier.map(m=>m.name).join(', ')+'.':'No disclosed-size model is selected.'}`;
 activateTabs('[data-pareto-mode]',metric,'paretoMode','#pareto-panel','pareto-tab-');
 document.querySelectorAll('[data-pareto-pool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paretoPool===state.paretoPool)));
}
