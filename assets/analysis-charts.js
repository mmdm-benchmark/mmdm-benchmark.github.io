/* Shared chart transitions and the set/size analysis views. No external runtime. */
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const chartJobs = new Map();
function drawChart(selector, markup, topology) {
 const host = $(selector), previous = host.querySelector('svg');
 const oldKey = host.dataset.topology;
 const oldGeometry = new Map([...host.querySelectorAll('[data-motion]')].map(e => [e.dataset.motion, e]));
 const oldBox = previous?.getAttribute('viewBox');
 if (chartJobs.has(host)) cancelAnimationFrame(chartJobs.get(host));
 chartJobs.delete(host);
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
   if (!a.length || a.length !== b.length || from.replace(numberPattern,'#') !== to.replace(numberPattern,'#')) {
    if(attr==='d'&&next.hasAttribute('data-frontier-path')){
     const oldLength=old.getTotalLength(),newLength=next.getTotalLength(),a=[],b=[];
     for(let i=0;i<=100;i++){const p=old.getPointAtLength(oldLength*i/100),q=next.getPointAtLength(newLength*i/100);a.push(p.x,p.y);b.push(q.x,q.y);}
     transitions.push({node:next,attr,to,a,b,sampled:true});next.setAttribute(attr,from);
    }
    continue;
   }
   transitions.push({node:next,attr,to,a,b}); next.setAttribute(attr,from);
  }
 }
 if (!transitions.length) return;
 const begin = performance.now();
 function frame(now) {
  const t = motionPreference.matches ? 1 : Math.min(1,(now-begin)/400), eased = 1-Math.pow(1-t,3);
  transitions.forEach(({node,attr,to,a,b,sampled}) => {
   let i=0;
   const interpolated=sampled?a.map((v,j)=>`${j%2?' ':j?'L':'M'}${v+(b[j]-v)*eased}`).join(''):to.replace(numberPattern,()=>{const j=i++;return String(a[j]+(b[j]-a[j])*eased);});
   node.setAttribute(attr,t===1?to:interpolated);
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
// Shape-preserving cubic interpolation in plot coordinates. Every segment stays
// within the measured endpoint values, so smoothing cannot invent a better frontier.
function frontierCurve(points) {
 if(!points.length)return '';
 if(points.length===1)return `M${points[0].x} ${points[0].y}`;
 const h=points.slice(1).map((p,i)=>p.x-points[i].x),s=h.map((dx,i)=>(points[i+1].y-points[i].y)/dx);
 const slopes=points.map((_,i)=>{
  if(i===0)return s[0];if(i===points.length-1)return s.at(-1);
  if(s[i-1]*s[i]<=0)return 0;
  const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];return (a+b)/(a/s[i-1]+b/s[i]);
 });
 for(let i=0;i<s.length;i++){
  if(s[i]===0){slopes[i]=slopes[i+1]=0;continue;}
  const ratio=Math.hypot(slopes[i]/s[i],slopes[i+1]/s[i]);
  if(ratio>3){slopes[i]*=3/ratio;slopes[i+1]*=3/ratio;}
 }
 return `M${points[0].x} ${points[0].y}`+h.map((dx,i)=>`C${points[i].x+dx/3} ${points[i].y+slopes[i]*dx/3} ${points[i+1].x-dx/3} ${points[i+1].y-slopes[i+1]*dx/3} ${points[i+1].x} ${points[i+1].y}`).join('');
}
function renderPareto() {
 const metric=state.pareto,soft=metric==='soft',models=paretoModels(),known=models.filter(m=>m.metadata.parameters_b!=null),unknown=models.filter(m=>m.metadata.parameters_b==null);
 const frontier=paretoFrontier(models,metric),frontIds=new Set(frontier.map(m=>m.id));
 const compact=matchMedia('(max-width:580px)').matches,width=compact?600:1000,left=82,right=width-35,top=40,bottom=430;
 const xmin=Math.min(.5,...known.map(m=>m.metadata.parameters_b)),xmax=Math.max(40,...known.map(m=>Math.ceil(m.metadata.parameters_b/10)*10));
 const values=models.map(m=>m.metrics[metric]),step=soft?.05:.1;
 let ymin=models.length?Math.max(0,Math.floor((Math.min(...values)-step*.1)/step)*step):0;
 let ymax=models.length?Math.ceil((Math.max(...values)+step*.1)/step)*step:soft?.5:1;
 if(!soft)ymax=Math.min(1,ymax);
 if(ymax-ymin<step*1.5){ymin=Math.max(0,ymin-step);ymax+=soft||ymax<1?step:0;}
 const X=x=>left+(right-left)*Math.log(x/xmin)/Math.log(xmax/xmin),Y=y=>bottom-(bottom-top)*(y-ymin)/(ymax-ymin);
 const label=soft?'Soft Brier ↓':`${LABELS[metric]} Accuracy (%) ↑`;
 const unique=frontier.filter((m,i,a)=>!i||m.metadata.parameters_b!==a[i-1].metadata.parameters_b||m.metrics[metric]!==a[i-1].metrics[metric]);
 const rank=m=>unique.findIndex(p=>p.metadata.parameters_b===m.metadata.parameters_b&&p.metrics[metric]===m.metrics[metric])+1;
 let s=`<svg viewBox="0 0 ${width} 535" data-y-min="${ymin}" data-y-max="${ymax}" role="img" aria-labelledby="pareto-svg-title"><title id="pareto-svg-title">${label} versus model size</title>`;
 const tickCount=Math.round((ymax-ymin)/step);
 for(let i=0;i<=tickCount;i++){const v=ymin+i*step,y=Y(v);s+=`<path d="M${left} ${y}H${right}" class="grid pareto-grid"/>`+svgText(left-14,y+5,[soft?v.toFixed(2):String(Math.round(v*100))],'text-anchor="end" class="tick-label"');}
 for(let v=.5;v<=xmax;v*=2){if(v<xmin)continue;const x=X(v);s+=svgText(x,461,[String(v)],'text-anchor="middle" class="tick-label"');}
 s+=`<path d="M${left} ${top}V${bottom}H${right}" stroke="#c3c9c5" stroke-width="1" fill="none"/>`;
 unknown.forEach(m=>{
  const y=Y(m.metrics[metric]),text=`${m.name} · size undisclosed · ${soft?'Soft Brier':'accuracy'} ${fmt(m.metrics[metric],metric)}`;
  s+=`<g data-undisclosed="${esc(m.id)}" tabindex="0" data-readout="${esc(text)}" aria-label="${esc(text)}">${tip(text)}<path data-motion="unknown-${m.id}" d="M${left} ${y}H${right}" stroke="${m.color}" stroke-width="1.4" stroke-dasharray="7 5" fill="none" opacity=".7"/><path d="M${left} ${y}H${right}" stroke="transparent" stroke-width="14" fill="none"/></g>`;
 });
 const coords=known.map(m=>({m,x:X(m.metadata.parameters_b),y:Y(m.metrics[metric])}));
 function dot({m,x,y}){
  const val=m.metrics[metric],on=frontIds.has(m.id),text=`${m.name} · ${m.metadata.parameters_b}B${m.metadata.active_parameters_b?' total / '+m.metadata.active_parameters_b+'B active':''} · ${soft?'Soft Brier':'accuracy'} ${fmt(val,metric)} · n = ${num(m.metrics[metric+'_n'])}${on?' · Pareto frontier':''}`;
  return `<circle data-motion="pareto-${m.id}" data-pareto-model="${esc(m.id)}" data-frontier="${on}" data-value="${val}" cx="${x}" cy="${y}" r="${on?11:5}" fill="${on?m.color:'#BCC5C1'}" stroke="#fff" stroke-width="${on?2.5:1}" tabindex="0" data-readout="${esc(text)}" aria-label="${esc(text)}">${tip(text)}</circle>`;
 }
 // Draw background models first, then the frontier and its numbered measured points.
 s+=coords.filter(c=>!frontIds.has(c.m.id)).map(dot).join('');
 if(unique.length){const path=frontierCurve(unique.map(m=>({x:X(m.metadata.parameters_b),y:Y(m.metrics[metric])})));s+=`<path data-motion="frontier" data-frontier-path="true" d="${path}" stroke="#526F65" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;}
 s+=coords.filter(c=>frontIds.has(c.m.id)).map(dot).join('');
 unique.forEach(m=>{s+=`<text data-motion="frontier-number-${m.id}" x="${X(m.metadata.parameters_b)}" y="${Y(m.metrics[metric])+4.2}" text-anchor="middle" class="frontier-number">${rank(m)}</text>`;});
 s+=svgText((left+right)/2,507,['Reported parameters (B, log scale)'],'text-anchor="middle" class="axis-label"');
 s+=`<text transform="translate(23 ${(top+bottom)/2}) rotate(-90)" text-anchor="middle" class="axis-label">${label}</text>`;
 if(!models.length)s+=svgText(width/2,220,['Select models to compare.'],'text-anchor="middle" class="axis-label"');
 drawChart('#pareto-chart',s+'</svg>','pareto');
 $('#pareto-legend').innerHTML='<span><i class="frontier-key"></i>Pareto frontier</span><span><i class="other-model-key"></i>Other models</span>'+unknown.map(m=>`<span><i class="unknown-key" style="border-color:${m.color}"></i>${esc(m.name)} ${fmt(m.metrics[metric],metric)} <small>undisclosed size</small></span>`).join('');
 $('#pareto-frontier-models').innerHTML=unique.map(m=>{
  const tied=frontier.filter(a=>a.metadata.parameters_b===m.metadata.parameters_b&&a.metrics[metric]===m.metrics[metric]);
  return `<li><button type="button" data-pareto-highlight="${esc(m.id)}"><span class="frontier-index" style="background:${m.color}">${rank(m)}</span><span>${esc(tied.map(a=>a.name).join(' / '))}<small>${m.metadata.parameters_b}B · <strong>${fmt(m.metrics[metric],metric)}</strong></small></span></button></li>`;
 }).join('');
 $('#pareto-readout').textContent=`Hover over a point or choose a frontier model below the curve to see its result. ${soft?'Lower and further left is better.':'Higher and further left is better.'}`;
 $('#pareto-caption').textContent=`${models.length} models · ${frontier.length} on the disclosed-size frontier. Numbered markers identify the measured models along the curve.`;
 activateTabs('[data-pareto-mode]',metric,'paretoMode','#pareto-panel','pareto-tab-');
 document.querySelectorAll('[data-pareto-pool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.paretoPool===state.paretoPool)));
}
