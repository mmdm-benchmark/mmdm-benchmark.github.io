/* Immediate, pointer-local readouts shared by SVG and HTML charts. */
let chartHover = null;
function initChartHover() {
 const box=document.createElement('div');box.id='chart-tooltip';box.className='chart-tooltip';box.role='tooltip';box.hidden=true;document.body.append(box);
 let active=null,series=[];
 function hide(){
  if(active){active.classList.remove('is-chart-hover');const ids=(active.getAttribute('aria-describedby')||'').split(/\s+/).filter(x=>x&&x!==box.id);if(ids.length)active.setAttribute('aria-describedby',ids.join(' '));else active.removeAttribute('aria-describedby');}
  series.forEach(el=>el.classList.remove('is-series-hover'));active=null;series=[];box.hidden=true;
 }
 function position(x,y){
  const gap=16,pad=10,w=box.offsetWidth,h=box.offsetHeight;
  let left=x+gap,top=y+gap;
  if(left+w>innerWidth-pad)left=x-w-gap;
  if(top+h>innerHeight-pad)top=y-h-gap;
  box.style.left=Math.max(pad,Math.min(left,innerWidth-w-pad))+'px';
  box.style.top=Math.max(pad,Math.min(top,innerHeight-h-pad))+'px';
 }
 function show(target,x,y){
  if(!target?.isConnected)return hide();
  if(active!==target){
   hide();active=target;active.classList.add('is-chart-hover');
   const group=active.closest('[data-series],[data-cal-model]');
   if(group){const attr=group.hasAttribute('data-series')?'data-series':'data-cal-model',id=group.getAttribute(attr);series=[...active.closest('svg').querySelectorAll('['+attr+']')].filter(el=>el.getAttribute(attr)===id);series.forEach(el=>el.classList.add('is-series-hover'));}
   const parts=target.dataset.chartTip.split(' · ');box.replaceChildren();
   const title=document.createElement('strong');title.textContent=parts.shift();box.append(title);
   for(const text of parts){const row=document.createElement('div');row.textContent=text;box.append(row);}
   const color=target.dataset.tipColor||target.style.getPropertyValue('--series-color')||'#526f65';box.style.setProperty('--tip-color',color);
   const described=(active.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!described.includes(box.id))described.push(box.id);active.setAttribute('aria-describedby',described.join(' '));
   const panel=active.closest('#calibration-chart,#pareto-chart');if(panel){const readout=document.getElementById(panel.id.replace('-chart','-readout'));if(readout)readout.textContent=target.dataset.chartTip;}
  }
  box.hidden=false;position(x,y);
 }
 const target=el=>el instanceof Element?el.closest('[data-chart-tip]'):null;
 document.addEventListener('pointermove',ev=>{if(ev.pointerType==='touch')return;const hit=target(ev.target);if(hit)show(hit,ev.clientX,ev.clientY);else hide();});
 document.addEventListener('pointerover',ev=>{if(ev.pointerType==='touch')return;const hit=target(ev.target);if(hit)show(hit,ev.clientX,ev.clientY);});
 document.addEventListener('pointerout',ev=>{if(active&&!target(ev.relatedTarget))hide();});
 document.addEventListener('pointerdown',ev=>{const hit=target(ev.target);if(hit)show(hit,ev.clientX,ev.clientY);else hide();});
 document.addEventListener('focusin',ev=>{const hit=target(ev.target);if(hit){const r=hit.getBoundingClientRect();show(hit,r.left+r.width/2,r.top+r.height/2);}else hide();});
 document.addEventListener('focusout',hide);
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape')hide();});
 window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);window.addEventListener('blur',hide);
 chartHover={hide,hideWithin:root=>{if(active&&root.contains(active))hide();}};
}
function prepareChartHover(root) {
 if(typeof root==='string')root=document.querySelector(root);
 if(!root)return;
 chartHover?.hideWithin(root);
 // Put generous line hit areas behind every series' markers, so lines cannot steal point hovers.
 const svg=root.querySelector('svg');
 if(svg&&!svg.querySelector('.chart-hit-layer')){
  const hits=[...svg.querySelectorAll('.chart-hit')];
  if(hits.length){
   const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.classList.add('chart-hit-layer');
   svg.insertBefore(layer,svg.querySelector('g[data-series],g[data-cal-model]')||hits[0]);
   hits.forEach(hit=>{const group=hit.closest('[data-series],[data-cal-model]');if(group){const attr=group.hasAttribute('data-series')?'data-series':'data-cal-model';hit.setAttribute(attr,group.getAttribute(attr));}layer.append(hit);});
  }
 }
 // Replace native delayed titles with one immediate tooltip, retaining accessible labels.
 const candidates=new Set(root.querySelectorAll('[data-readout],[data-chart-tip],svg title,[title]'));
 for(let node of candidates){
  if(node.tagName.toLowerCase()==='title'){
   const parent=node.parentElement;if(parent.tagName.toLowerCase()==='svg')continue;
   if(!parent.dataset.chartTip)parent.dataset.chartTip=parent.dataset.readout||node.textContent;
   node.remove();node=parent;
  }
  if(node.hasAttribute('title')){node.dataset.chartTip=node.dataset.chartTip||node.getAttribute('title');node.removeAttribute('title');}
  if(node.dataset.readout)node.dataset.chartTip=node.dataset.readout;
  if(!node.dataset.chartTip)continue;
  if(!node.hasAttribute('aria-label'))node.setAttribute('aria-label',node.dataset.chartTip);
  if(!node.hasAttribute('tabindex'))node.setAttribute('tabindex','0');
  const color=node.getAttribute('stroke')||node.getAttribute('fill');if(!node.dataset.tipColor&&color&&color!=='none'&&color!=='transparent'&&color!=='#fff')node.dataset.tipColor=color;
 }
}
