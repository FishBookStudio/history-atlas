const D=window.HISTORY_DATA;
const $=id=>document.getElementById(id);
const colors={'政治':'#a68d64','会议':'#6b8667','著作':'#8a879f','思想':'#b59c66','人物':'#78939b','事件':'#b27862','组织':'#749a83','文献':'#938767','政策':'#7c8d68'};
const kinds=Object.keys(colors),byId=Object.fromEntries(D.nodes.map(n=>[n.id,n]));
const MIN=1919,MAX=1928,MIN_SPAN=.5;
const timelinePointer={visible:false,clientX:0,clientY:0};
let state={selected:'may4',active:new Set(kinds),query:'',start:MIN,end:MAX};
let previewId=null,pinned=false,hoverTimer,closeTimer,lastAnchor=null,drag=null,positions={},dimensions={};
// Review mode: one node is fixed at a time; a hovered node only previews its links.
let mode='study',reviewId=null,reviewEdge=null,revealed=new Set(),suppressFocusPreview=false;
const isReview=()=>mode==='review';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const links=id=>D.edges.filter(e=>e.source===id||e.target===id);
const other=(e,id)=>e.source===id?e.target:e.source;
const inRange=n=>n.year>=state.start&&n.year<state.end;
function visible(){const q=state.query.trim().toLowerCase();return D.nodes.filter(n=>state.active.has(n.kind)&&inRange(n)&&(!q||[n.title,n.summary,n.kind,...n.points].join(' ').toLowerCase().includes(q)))}
function sourceButtons(pages){return pages.map(p=>`<button data-page="${p}">PDF 第 ${p} 页</button>`).join(' · ')}
function selectNode(id,anchor){
 if(isReview())return selectReview(id);
 const n=byId[id];state.selected=id;state.active.add(n.kind);
 if(!visible().some(v=>v.id===id)){state.query='';$('search').value='';if(!inRange(n)){const span=state.end-state.start;state.start=Math.max(MIN,Math.min(n.year-span/2,MAX-span));state.end=state.start+span}}
 previewId=id;pinned=true;render();const live=document.querySelector((anchor?.closest('#mainline')?'#mainline ':'#eventPoints ')+'[data-node="'+id+'"]');openPopover(id,anchor?live:null,true);
}
function render(){renderFilters();renderTimeline();renderMini();$('empty').hidden=visible().length>0;updateHint()}
function updateHint(){$('modeHint').textContent=isReview()?'悬停预览关联 · 点击打开复习卡片':'悬停查看关联，点击打开知识卡片'}
function renderFilters(){$('filters').innerHTML=kinds.map(k=>`<button class="filter ${state.active.has(k)?'is-selected':''}" data-kind="${k}" aria-pressed="${state.active.has(k)}"><b style="background:${colors[k]}"></b><span>${k}</span></button>`).join('')}

function renderTimeline(){
 const canvas=$('timelineCanvas'),W=Math.max(200,canvas.clientWidth||1000),H=Math.max(400,canvas.clientHeight||700),left=W<500?65:99,right=W<500?25:48,baseline=H-82,span=state.end-state.start;
 dimensions={W,H,left,right,baseline};const x=y=>left+(y-state.start)/span*(W-left-right);
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="group" aria-label="历史事件时间轴"><defs><linearGradient id="gridFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe5d5" stop-opacity="0"/><stop offset="1" stop-color="#dfe5d5" stop-opacity=".75"/></linearGradient></defs>`;
 const step=span<=2?1/4:span>6&&W<500?2:1;
 for(let t=Math.ceil((state.start-1e-7)/step)*step;t<state.end-1e-6;t+=step){const whole=Math.abs(t-Math.round(t))<.001;const label=whole?Math.round(t):Math.round((t%1)*12)+1+'月';svg+=`<line x1="${x(t)}" y1="38" x2="${x(t)}" y2="${baseline}" stroke="url(#gridFade)"/><line class="tick-mark" x1="${x(t)}" y1="${baseline}" x2="${x(t)}" y2="${baseline+6}"/><text class="${whole?'year-label':'month-label'}" x="${x(t)}" y="${baseline+27}" text-anchor="middle">${label}</text>`}
 svg+=`<line class="axis-baseline" x1="${left}" y1="${baseline}" x2="${W-right}" y2="${baseline}"/>`;
 for(const seg of [{a:MIN,b:1919.34,label:'旧民主主义革命',color:'#b7a780'},{a:1919.34,b:MAX,label:'新民主主义革命',color:'#a3b68d'}]){const a=Math.max(state.start,seg.a),b=Math.min(state.end,seg.b);if(b>a)svg+=`<g class="stage-track" data-context="true" role="button" tabindex="0" aria-label="${seg.label}：查看革命性质与社会性质"><rect x="${x(a)}" y="${baseline+43}" width="${x(b)-x(a)}" height="22" fill="transparent"/><rect x="${x(a)}" y="${baseline+43}" width="${x(b)-x(a)}" height="2" fill="${seg.color}" opacity=".6"/>${x(b)-x(a)>145?`<text class="stage-label" x="${(x(a)+x(b))/2}" y="${baseline+62}" text-anchor="middle">${seg.label}</text>`:''}</g>`}
 const nodes=visible(),milestones=(Array.isArray(D.mainline)?D.mainline:[]).map(id=>byId[id]).filter(n=>nodes.includes(n)),railY=57;
 const gutter=left-12;
 svg+='<g id="mainline" aria-label="历史主线">';
 if(milestones.length){
 svg+=`<text class="main-row-label" x="10" y="${railY+4}">历史主线</text>`;
 if(milestones.length>1)svg+=`<line class="main-path" x1="${x(milestones[0].year)}" x2="${x(milestones.at(-1).year)}" y1="${railY}" y2="${railY}"/>`;
 for(const [i,n] of milestones.entries()){const px=x(n.year),dy=W<600&&i%2?31:-13,tx=Math.max(gutter+30,Math.min(W-32,px))-px;
 svg+=`<g class="point main-stop" data-node="${n.id}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="历史主线：${esc(n.title)} · ${Math.floor(n.year)}" transform="translate(${px},${railY})"><circle class="hit" r="15"/><circle class="main-disc" r="7"/><text class="main-caption" text-anchor="middle" x="${tx}" y="${dy}"><tspan class="main-year" x="${tx}" dy="-13">${Math.floor(n.year)}</tspan><tspan x="${tx}" dy="15">${esc(n.title)}</tspan></text></g>`}
 }
 svg+='</g>';
 positions={};const points=[],used=[];const activeKinds=['会议','事件','人物','著作','思想','政治','组织','文献','政策'].filter(k=>state.active.has(k)),top=milestones.length?102:20,usable=baseline-top-12,laneH=usable/Math.max(1,activeKinds.length);
 for(const [i,k] of activeKinds.entries()){const sy=top+i*laneH;svg+=`<line class="lane-rule" x1="10" x2="${W-right+10}" y1="${sy}" y2="${sy}"/><text class="lane-name" x="12" y="${sy+laneH/2+4}">${k}</text>`}
 for(const n of nodes.sort((a,b)=>a.year-b.year)){
 const band=activeKinds.indexOf(n.kind),px=x(n.year),base=top+(band+.5)*laneH;
 // Keep the date (x) fixed; fit the dot and its caption together.
 const width=Array.from(n.title).length*11+3, gap=11, nominal=base;
 let best=null;
 for(let row=0;row<=Math.ceil(H/18);row++){for(const shift of (row?[row*18,-row*18]:[0])){const py=Math.max(base-laneH/2+9,Math.min(nominal+shift,base+laneH/2-9));
  for(const leftLabel of [false,true]){const l=px-(leftLabel?width+gap:8),r=px+(leftLabel?8:width+gap);
   const overlap=used.reduce((sum,v)=>sum+Math.max(0,Math.min(r+3,v.r)-Math.max(l-3,v.l))*Math.max(0,18-Math.abs(py-v.py)),0);
   const score=(Math.max(0,gutter-l)+Math.max(0,r-W+4))*50000+overlap*100+Math.abs(py-nominal)+(leftLabel?.1:0);
   if(!best||score<best.score)best={l,r,py,leftLabel,score};
  }}if(best.score<=(row+1)*18)break;}
 const {py,leftLabel}=best;used.push(best);positions[n.id]=[px,py];points.push({n,px,py,leftLabel});
 }
 svg+='<g id="relationLines"></g><g id="eventPoints">';
 for(const {n,px,py,leftLabel} of points){svg+=`<g class="point" data-node="${n.id}" tabindex="0" role="button" aria-haspopup="dialog" aria-label="${esc(n.title+' · '+n.date)}" style="--c:${colors[n.kind]}" transform="translate(${px},${py})"><circle class="hit" r="14"/><circle class="halo" r="10"/><circle class="dot" r="4.5"/><text class="point-label" x="${leftLabel?-11:11}" y="4" text-anchor="${leftLabel?'end':'start'}">${esc(n.title)}</text></g>`}
 svg+='</g><line id="timelineCursor" class="timeline-cursor" aria-hidden="true" visibility="hidden"/><circle id="timelineCursorDot" class="timeline-cursor-dot" r="4" aria-hidden="true" visibility="hidden"/></svg>';canvas.innerHTML=svg;isReview()?highlightReview():highlight(previewId);renderTimelineCursor();
}
function renderTimelineCursor(){
 const line=$('timelineCursor'),dot=$('timelineCursorDot');if(!line||!dot)return;
 const area=$('timelineCanvas'),rect=area.getBoundingClientRect();
 const inside=timelinePointer.visible&&timelinePointer.clientX>=rect.left&&timelinePointer.clientX<=rect.right&&timelinePointer.clientY>=rect.top&&timelinePointer.clientY<=rect.bottom;
 line.setAttribute('visibility',inside?'visible':'hidden');dot.setAttribute('visibility',inside?'visible':'hidden');if(!inside)return;
 const x=(timelinePointer.clientX-rect.left)/rect.width*dimensions.W;
 const y=(timelinePointer.clientY-rect.top)/rect.height*dimensions.H;dot.setAttribute('cx',x);dot.setAttribute('cy',y);
 line.setAttribute('x1',x);line.setAttribute('x2',x);line.setAttribute('y1',20);line.setAttribute('y2',dimensions.baseline);
}
function moveTimelineCursor(ev){if(ev.pointerType==='touch')return;timelinePointer.visible=true;timelinePointer.clientX=ev.clientX;timelinePointer.clientY=ev.clientY;renderTimelineCursor();}
function hideTimelineCursor(){timelinePointer.visible=false;renderTimelineCursor();}
function highlight(id){
 const connected=new Set(id?links(id).map(e=>other(e,id)):[]);document.querySelectorAll('#timelineCanvas [data-node]').forEach(el=>{el.classList.toggle('active',el.dataset.node===id);el.classList.toggle('related',connected.has(el.dataset.node))});
 const group=$('relationLines');if(!group)return;let html='';
 const occupied=[],curveSamples=[];if(id)for(const e of links(id)){const a=positions[e.source],b=positions[e.target];if(!a||!b)continue;const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2-35;
 // Put each verb on its own curve, away from other verbs and event dots.
 const width=e.label.length*10+8;let label=null;
 for(const t of [.52,.36,.68,.24,.78,.15,.86]){
  const u=1-t,x=u*u*a[0]+2*u*t*mx+t*t*b[0],y=u*u*a[1]+2*u*t*my+t*t*b[1];
  const conflicts=occupied.filter(v=>Math.abs(v.y-y)<16&&Math.abs(v.x-x)<(v.width+width)/2).length+Object.values(positions).filter(v=>Math.abs(v[1]-y)<12&&Math.abs(v[0]-x)<width/2+12).length;
  if(!label||conflicts<label.conflicts)label={x,y,width,conflicts};if(!conflicts)break;
 }occupied.push(label);
 const steps=Math.ceil((Math.hypot(mx-a[0],my-a[1])+Math.hypot(b[0]-mx,b[1]-my))/10);
 for(let j=0;j<=steps;j++){const t=j/steps,u=1-t;curveSamples.push([u*u*a[0]+2*u*t*mx+t*t*b[0],u*u*a[1]+2*u*t*my+t*t*b[1]])}

 html+=`<g class="link-edge" data-edge="${e.id}" tabindex="0" role="button" aria-label="${esc(byId[e.source].title+e.label+byId[e.target].title)}"><path d="M${a} Q${mx},${my} ${b}" fill="none" stroke="transparent" stroke-width="12"/><path class="stroke" d="M${a} Q${mx},${my} ${b}"/><text class="link-label" x="${label.x}" y="${label.y+3}" text-anchor="middle">${esc(e.label)}</text></g>`}
 group.innerHTML=html;
 // Include the caption in the footprint: the dot itself can be far from a crossing.
 document.querySelectorAll('#timelineCanvas .point[data-node]').forEach(el=>{
  const background=curveSamples.length>0&&el.dataset.node!==id&&!connected.has(el.dataset.node);
  let near=false;
  if(background){const box=el.getBBox(),offset=el.transform.baseVal.getItem(0).matrix;
   const l=box.x+offset.e-7,r=l+box.width+14,t=box.y+offset.f-7,b=t+box.height+14;
   near=occupied.some(v=>v.x+v.width/2>=l&&v.x-v.width/2<=r&&v.y+8>=t&&v.y-8<=b)
     ||curveSamples.some(([x,y])=>x>=l&&x<=r&&y>=t&&y<=b);
  }
  el.classList.toggle('context-muted',background&&!near);el.classList.toggle('crossing-muted',near);
 });

}
// ---------- Review mode ----------
const edgeKey=e=>'edge:'+e.id;
const edgeRevealed=e=>['','l'].some(x=>[...revealed].some(k=>k.startsWith(edgeKey(e)+x+':')));
const linkText=e=>esc(e.label);
function setMode(next){
 mode=next;const keep=reviewId;
 if(!isReview()){reviewId=null;reviewEdge=null;revealed.clear();}
 for(const b of document.querySelectorAll('.mode-option')){const on=b.dataset.mode===mode;b.classList.toggle('is-selected',on);b.setAttribute('aria-pressed',String(on))}
 document.body.classList.toggle('review-mode',isReview());$('knowledgePopover').classList.remove('review-card','light-read');updateHint();closePopover();
 if(isReview()){renderTimeline();if(keep&&byId[keep]){reviewId=keep;openReviewCard(keep)}}
 else render();
}
function selectReview(id){
 if(!byId[id])return;
 const n=byId[id];state.selected=id;state.active.add(n.kind);
 if(!visible().some(v=>v.id===id)){state.query='';$('search').value='';if(!inRange(n)){const span=state.end-state.start;state.start=Math.max(MIN,Math.min(n.year-span/2,MAX-span));state.end=state.start+span}}
 reviewId=id;reviewEdge=null;revealed=new Set();render();openReviewCard(id);
}
function openReviewCard(id){
 const shown=positions[id]?document.querySelector('#eventPoints [data-node="'+id+'"]'):document.querySelector('#mainline [data-node="'+id+'"]');
 openPopover(id,shown,true);
}
function questionFor(n,e){const o=byId[other(e,n.id)];return `${n.title} 与「${o.title}」是什么关系？`}
function coverHTML(n,key,question,tip){
 return `<button class="cover" data-reveal="${key}" data-label="揭晓：${esc(question)}" aria-expanded="false" aria-label="揭晓：${esc(question)}"><span class="cover-q">${esc(question)}</span><span class="cover-tip">${tip||'点击揭晓'}</span></button>`;
}
let cardAnswers={},cardCloze={};
function clozeSentence(text,terms,keyBase,ctxLabel){
 if(!terms||!terms.length)return `<span class="cloze-text">${esc(text)}</span>`;
 const parts=[];let idx=0,j=0;
 for(const term of terms){const at=text.indexOf(term,idx);if(at<0)continue;
  if(at>idx)parts.push(`<span class="cloze-text">${esc(text.slice(idx,at))}</span>`);
  const key=`${keyBase}:${j}`;cardCloze[key]=term;
  const label=`揭晓：${ctxLabel}第 ${j+1} 处挖空`;
  parts.push(`<button class="cloze" data-reveal="${key}" data-label="${esc(label)}" aria-expanded="false" aria-label="${esc(label)}" style="--w:${Math.min(term.length,10)}"><span class="cloze-term"></span></button>`);
  idx=at+term.length;j++}
 if(idx<text.length)parts.push(`<span class="cloze-text">${esc(text.slice(idx))}</span>`);
 return parts.join('');
}
function renderReviewDetail(){
 const n=byId[reviewId],es=links(n.id);cardAnswers={};cardCloze={};
 const body=[];
 if(n.summary){
  const sTerms=n.summaryCloze||[];
  if(sTerms.length)body.push(`<div class="review-summary">${clozeSentence(n.summary,sTerms,'s',`${n.title}的知识概览中的`)}</div>`);
  else body.push(`<div class="review-summary"><p class="summary">${esc(n.summary)}</p></div>`);
 }
 if(n.points.length)body.push(`<div class="detail-rule"></div><div class="section-label">核心知识 / KEY POINTS</div><ul class="points review-points">${n.points.map((p,i)=>`<li class="cloze-line">${clozeSentence(p,(n.cloze&&n.cloze[i])||[],'p'+i,`${n.title}第 ${i+1} 条核心知识中的`)}</li>`).join('')}</ul>`);
 if(n.exam){cardAnswers.exam=`<div class="exam">${esc(n.exam)}</div>`;body.push(`<div class="detail-rule"></div><div class="section-label">易错提醒 / WATCH OUT</div><div class="review-exam">${coverHTML(n,'exam',`${n.title}的易错提醒`)}</div>`)}
 const relItems=[];
 es.forEach(e=>{const o=byId[other(e,n.id)],ok=e.source===n.id;
  relItems.push(`<li class="cloze-line relation-line"><span class="cloze-text rel-name">${ok?'→ ':'← '}${esc(o.title)}</span><span class="cloze-text">：</span>${clozeSentence(e.label,[e.label],edgeKey(e)+'l',`${n.title}与${o.title}的`)}<button class="relation-jump" data-node="${o.id}" aria-label="打开${esc(o.title)}的复习卡片">↗</button></li>`) });
 body.push(`<div class="detail-rule"></div><div class="section-label">关联知识 / RELATIONS</div>${es.length?`<ul class="points review-relations">${relItems.join('')}</ul>`:'<p class="source">本样板尚未收录直接关系。</p>'}`);
 body.push(`<div class="source">来源：《史纲知识点》<br>${sourceButtons(n.pages)}<br>原书页码：${n.pages.map(p=>p+292).join('、')} · 摘要为整理表述</div>`);
 $('detail').innerHTML=`<div class="detail-top"><span class="badge">${n.kind}</span><small>复习卡片</small></div><h2 id="cardTitle">${esc(n.title)}</h2><div class="detail-date">${esc(n.date)}</div><div class="review-meta"><span>${esc(n.kind)}</span><span>${n.year<1919.34?'旧民主主义革命':'新民主主义革命'}</span><span>${es.length} 条直接关联</span>${allKeys().length?'':'<span>本项暂无需遮盖的复习内容</span>'}</div><div class="review-toolbar"><button id="revealAll" type="button">全部揭晓</button><button id="recoverAll" type="button">重新遮盖</button><span class="review-progress" id="reviewProgress"></span></div>${body.join('')}`;
 syncCardStates();
}
function allKeys(){
 const n=byId[reviewId];if(!n)return [];
 const keys=[...Object.keys(cardCloze),...Object.keys(cardAnswers)];
 return keys;
}
function syncCardStates(){
 const detail=$('detail');if(!detail)return;
 for(const btn of detail.querySelectorAll('.cover')){const key=btn.dataset.reveal,on=revealed.has(key),next=btn.nextElementSibling;
  btn.classList.toggle('is-revealed',on);btn.setAttribute('aria-expanded',String(on));
  const tip=btn.querySelector('.cover-tip');if(tip)tip.textContent=on?'已揭晓 · 点击重新遮盖':'点击揭晓';
  if(on){if(!next||!next.classList.contains('reveal-answer')){const ans=document.createElement('div');ans.className='reveal-answer';ans.innerHTML=cardAnswers[key]||'';btn.after(ans)}}
  else if(next&&next.classList.contains('reveal-answer'))next.remove();
 }
 for(const btn of detail.querySelectorAll('.cloze')){
  const key=btn.dataset.reveal,on=revealed.has(key),term=cardCloze[key]||'';
  btn.classList.toggle('is-revealed',on);btn.setAttribute('aria-expanded',String(on));
  btn.querySelector('.cloze-term').textContent=on?term:'';
  btn.setAttribute('aria-label',on?('已揭晓：'+term+'，点击重新遮盖'):(btn.dataset.label||btn.getAttribute('aria-label')));
 }
 const total=allKeys().length,shown=allKeys().filter(k=>revealed.has(k)).length;
 const bar=$('reviewProgress');if(bar)bar.textContent=total?`已揭晓 ${shown} / ${total} 处`:'';
}
function toggleReveal(key){if(!reviewId)return;if(revealed.has(key))revealed.delete(key);else revealed.add(key);syncCardStates();highlightReview()}
function revealAll(){
 if(!reviewId||!isReview())return;
 revealed=new Set(allKeys());
 syncCardStates();highlightReview();
}
function recoverAll(){if(!reviewId)return;revealed.clear();syncCardStates();highlightReview()}
function highlightReview(){renderReviewLines(reviewId,reviewEdge)}
const maskChip=l=>`<rect class="mask-chip" x="${l.x-9}" y="${l.y-9}" width="18" height="18" rx="9"/><text class="link-label mask-mark" x="${l.x}" y="${l.y+4}" text-anchor="middle">？</text>`;
function labelMarkup(e,l,extraClass=''){
 return edgeRevealed(e)?`<text class="link-label ${extraClass}" x="${l.x}" y="${l.y+3}" text-anchor="middle">${linkText(e)}</text>`:`<g class="${extraClass}">${maskChip(l)}</g>`;
}
function placeLabel(e,a,b,occupied){
 const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2-(e.id===reviewEdge?20:35);
 const text=edgeRevealed(e)?e.label:'？',width=(edgeRevealed(e)?e.label.length*10:14)+8;let label=null;
 for(const t of [.52,.36,.68,.24,.78,.15,.86]){const u=1-t,x=u*u*a[0]+2*u*t*mx+t*t*b[0],y=u*u*a[1]+2*u*t*my+t*t*b[1];
  const conflicts=occupied.filter(v=>Math.abs(v.y-y)<16&&Math.abs(v.x-x)<(v.width+width)/2).length+Object.values(positions).filter(v=>Math.abs(v[1]-y)<12&&Math.abs(v[0]-x)<width/2+12).length;
  if(!label||conflicts<label.conflicts)label={x,y,width,conflicts};if(!conflicts)break}
 occupied.push(label);return {label,mx,my,text};
}
function renderReviewLines(focus,extra){
 const group=$('relationLines');if(!group)return;group.innerHTML='';
 document.querySelectorAll('#timelineCanvas [data-node]').forEach(el=>el.classList.remove('active','related','context-muted','crossing-muted'));
 if(!focus)return;
 const ex=extra?D.edges.find(x=>x.id===extra):null,related=new Set(links(focus).map(e=>other(e,focus)));
 if(ex){related.add(ex.source);related.add(ex.target);related.delete(focus)}
 document.querySelectorAll('#timelineCanvas [data-node]').forEach(el=>{const id=el.dataset.node;
  el.classList.toggle('active',id===focus||!!(ex&&(ex.source===id||ex.target===id)));
  el.classList.toggle('related',related.has(id));
  el.classList.toggle('context-muted',id!==focus&&!related.has(id));
 });
 const occupied=[];let html='';
 const draw=(e,focusEdge)=>{const a=positions[e.source],b=positions[e.target];if(!a||!b)return;
  const {label,mx,my,text}=placeLabel(e,a,b,occupied);
  html+=`<g class="link-edge review-edge${edgeRevealed(e)?' is-revealed':''}${focusEdge?' focus-edge':''}" data-edge="${e.id}" tabindex="0" role="button" aria-label="${edgeRevealed(e)?esc(byId[e.source].title+e.label+byId[e.target].title):esc('关联未揭晓：'+byId[e.source].title+' 与 '+byId[e.target].title)}"><path d="M${a} Q${mx},${my} ${b}" fill="none" stroke="transparent" stroke-width="12"/><path class="stroke" d="M${a} Q${mx},${my} ${b}"/>${labelMarkup(e,label)}</g>`;
 };
 if(ex)draw(ex,true);
 for(const e of links(focus))if(!ex||e.id!==ex.id)draw(e,false);
 group.innerHTML=html;
}
function reviewPreview(focus){
 const group=$('relationLines');if(!group)return;group.innerHTML='';
 document.querySelectorAll('#timelineCanvas [data-node]').forEach(el=>el.classList.remove('active','related','context-muted','crossing-muted'));
 if(!focus)return;
 const related=new Set(links(focus).map(e=>other(e,focus)));
 document.querySelectorAll('#timelineCanvas [data-node]').forEach(el=>{const id=el.dataset.node;el.classList.toggle('active',id===focus);el.classList.toggle('related',id!==focus&&related.has(id));el.classList.toggle('context-muted',id!==focus&&!related.has(id))});
 const occupied=[];let html='';
 for(const e of links(focus)){const a=positions[e.source],b=positions[e.target];if(!a||!b)continue;const {label,mx,my,text}=placeLabel(e,a,b,occupied);html+=`<g class="link-edge review-edge preview-edge" aria-hidden="true"><path class="stroke" d="M${a} Q${mx},${my} ${b}"/>${labelMarkup(e,label)}</g>`}
 group.innerHTML=html;
}
function toggleReviewEdge(edgeId){
 const e=D.edges.find(x=>x.id===edgeId);if(!e||!reviewId)return;
 reviewEdge=e.id;
 // 地图上点击关系线 -> 揭晓/遮盖这条关系文字（与卡片里的挖空同步）
 const labelKey=Object.keys(cardCloze).find(k=>k.startsWith(edgeKey(e)+'l:'))||Object.keys(cardCloze).find(k=>k.startsWith(edgeKey(e)+':'));
 toggleReveal(labelKey||edgeKey(e));
}
function closeReviewCard(){
 const back=document.querySelector('#eventPoints [data-node="'+reviewId+'"]')||document.querySelector('#mainline [data-node="'+reviewId+'"]');
 reviewId=null;reviewEdge=null;revealed.clear();closePopover();
 if(back&&back.isConnected){suppressFocusPreview=true;back.focus();suppressFocusPreview=false}
}
function dateLabel(year,end=false){const y=Math.floor(year-(end?.00001:0));if(state.end-state.start>=3)return String(y);const month=Math.min(12,Math.max(1,Math.floor((year-y)*12)+1));return `${y}.${String(month).padStart(2,'0')}`}
function renderMini(){
 $('miniDots').innerHTML=D.nodes.map((n,i)=>`<span class="mini-dot" style="left:${(n.year-MIN)/(MAX-MIN)*100}%;height:${8+(i%5)*4}px"></span>`).join('');
 const win=$('rangeWindow');win.style.left=(state.start-MIN)/(MAX-MIN)*100+'%';win.style.width=(state.end-state.start)/(MAX-MIN)*100+'%';
 const label=`${dateLabel(state.start)} — ${dateLabel(state.end,true)}`;$('rangeLabel').textContent=label;
 win.setAttribute('aria-label','移动时间选区 '+label+'，左右方向键平移');
 $('startHandle').setAttribute('aria-valuenow',state.start.toFixed(2));$('startHandle').setAttribute('aria-valuetext',dateLabel(state.start));$('endHandle').setAttribute('aria-valuenow',state.end.toFixed(2));$('endHandle').setAttribute('aria-valuetext',dateLabel(state.end,true));
}
function applyRange(a,b){const span=Math.max(MIN_SPAN,Math.min(MAX-MIN,b-a));state.start=Math.max(MIN,Math.min(a,MAX-span));state.end=state.start+span;if(!(isReview()&&reviewId))closePopover();renderTimeline();renderMini();$('empty').hidden=visible().length>0;if(isReview()&&reviewId){const el=document.querySelector('#eventPoints [data-node="'+reviewId+'"]');if(el)lastAnchor=el;highlightReview()}}
function renderDetail(){const n=byId[previewId||state.selected],es=links(n.id);if(isReview()){renderReviewDetail();return}$('detail').innerHTML=`<div class="detail-top"><span class="badge">${n.kind}</span><small>知识档案 / ${n.id.toUpperCase().slice(0,8)}</small></div><h2 id="cardTitle">${esc(n.title)}</h2><div class="detail-date">${esc(n.date)}</div>${!inRange(n)?'<p class="out-range">此知识点位于当前时间范围之外</p>':''}<div class="context-note">${n.year<1919.34?'旧民主主义革命':'新民主主义革命'} · 资产阶级民主革命<br>半殖民地半封建社会</div><p class="summary">${esc(n.summary)}</p><div class="detail-rule"></div><div class="section-label">核心知识 / KEY POINTS</div><ul class="points">${n.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul><div class="detail-rule"></div><div class="section-label">关联知识</div>${es.map(e=>{const o=byId[other(e,n.id)];return `<button class="relation-link" data-node="${o.id}"><span>${esc(o.title)} ↗</span><small>${e.source===n.id?'→':'←'} ${esc(e.label)}</small></button>`}).join('')||'<p class="source">本样板尚未收录直接关系。</p>'}<div class="source">来源：《史纲知识点》<br>${sourceButtons(n.pages)}<br>原书页码：${n.pages.map(p=>p+292).join('、')} · 摘要为整理表述</div>`;}

function modal(html){closePopover();$('modalBody').innerHTML=html;if(!$('modal').open)$('modal').showModal()}
function showSource(p){modal(`<div class="eyebrow">SOURCE / 原文依据</div><h2>《史纲知识点》 · PDF 第 ${p} 页</h2><p>原书第 ${p+292} 页。知识摘要经过整理，请结合原文理解上下文。</p><img src="sources/page-${p}.jpg" alt="史纲知识点 PDF 第 ${p} 页的完整扫描原页">`)}
function edgeInfo(id){const e=D.edges.find(e=>e.id===id);modal(`<div class="eyebrow">RELATION / 关系依据</div><h2>${esc(byId[e.source].title)}</h2><p>↓ ${esc(e.label)}</p><h2>${esc(byId[e.target].title)}</h2><p>${esc(e.note)}</p>${['mao','aug7','armed'].includes(e.source)&&['mao','aug7','armed'].includes(e.target)?'<div class="exam"><b>完整事实</b>毛泽东在八七会议上强调须知政权是由枪杆子中取得的。这里同时关联人物、会议和思想，保留提出的语境。</div>':''}<div class="source">核对原文：${sourceButtons([e.page])}</div>`)}
function about(){modal(`<div class="eyebrow">EDITION 01 / 内容范围</div><h2>先读懂一段历史。</h2><p>本版覆盖 1919—1927 年的精选知识。依据 PDF 第 34—47 页人工核读整理，尚未完成该章节全部考点的逐条导入，也不代表全书覆盖。</p><ul><li>保留事件、政治、会议、著作、思想、人物、组织、文献和政策九类入口。</li><li>每个节点与每条关系都能查看 PDF 原页。摘要是整理表述。</li><li>人物时间表示本样板相关活动时间；仅精确到年的资料使用年内示意位置。时间轴以节点定位为主，完整时间范围见详情。</li><li>拖动底部选区两端缩放时间，拖动中间平移；在主轴滚轮缩放、拖动平移，双击恢复全部。知识关系直接在时间轴上展开。</li><li>复习模式：点击知识点打开右侧复习卡片，卡片内容逐条遮盖；揭晓关联后，地图上的关系文字同步显示。</li></ul>`)}

function positionPopover(anchor){
 const card=$('knowledgePopover'),w=Math.min(pinned?360:238,innerWidth-24);card.style.width=w+'px';
 const h=Math.min(card.offsetHeight||520,innerHeight-32);
 let x,y;if(innerWidth<650&&pinned){x=(innerWidth-w)/2;y=Math.max(12,innerHeight-h-12)}else if(anchor){const r=anchor.getBoundingClientRect();x=r.right+14;if(x+w>innerWidth-16)x=r.left-w-14;x=Math.max(12,Math.min(x,innerWidth-w-12));y=Math.max(12,Math.min(r.top-28,innerHeight-h-16))}else{x=Math.max(12,Math.min(parseFloat(card.style.left)||innerWidth/2-w/2,innerWidth-w-12));y=Math.max(12,Math.min(parseFloat(card.style.top)||90,innerHeight-h-16))}
 card.style.left=x+'px';card.style.top=y+'px';
}
function openPopover(id,anchor,lock=false){clearTimeout(hoverTimer);clearTimeout(closeTimer);previewId=id;pinned=lock;lastAnchor=anchor||lastAnchor;
 const card=$('knowledgePopover'),review=isReview();if(review){card.style.left='';card.style.top='';card.style.width=''}
 card.classList.toggle('light-read',!lock);card.classList.toggle('review-card',review);card.setAttribute('role',lock?'dialog':'tooltip');
 if(lock){renderDetail();$('popoverState').textContent=review?'复习模式 · Esc 关闭':'已固定 · Esc 关闭'}else{const n=byId[id];$('detail').innerHTML=`<div class="detail-date">${esc(n.date)}</div><p class="light-summary">${esc(n.summary)}</p>`;}
 card.hidden=false;if(!review)positionPopover(anchor);review?highlightReview():highlight(id);}
function closePopover(){clearTimeout(hoverTimer);clearTimeout(closeTimer);$('knowledgePopover').hidden=true;previewId=null;pinned=false;lastAnchor=null;if(isReview()){reviewId=null;reviewEdge=null;revealed.clear();highlightReview()}else highlight(null);}
function scheduleClose(){clearTimeout(hoverTimer);clearTimeout(closeTimer);if(!pinned)closeTimer=setTimeout(()=>{if(!$('knowledgePopover').contains(document.activeElement))closePopover()},240);}
function previewNode(el){if(pinned||drag||!el)return;clearTimeout(closeTimer);clearTimeout(hoverTimer);if(isReview()){hoverTimer=setTimeout(()=>{if(!pinned)reviewPreview(el.dataset.node)},110);return}hoverTimer=setTimeout(()=>openPopover(el.dataset.node,el),140);}
$('closePopover').onclick=()=>{if(isReview()){closeReviewCard();return}const target=lastAnchor;closePopover();if(target?.isConnected)target.focus();clearTimeout(hoverTimer)};

$('knowledgePopover').addEventListener('pointerenter',()=>clearTimeout(closeTimer));
$('knowledgePopover').addEventListener('pointerleave',scheduleClose);
$('knowledgePopover').addEventListener('click',ev=>{
 if(ev.target.closest('#revealAll')){ev.stopPropagation();revealAll();return}
 if(ev.target.closest('#recoverAll')){ev.stopPropagation();recoverAll();return}
 const cover=ev.target.closest('.cover');
 if(cover){ev.stopPropagation();toggleReveal(cover.dataset.reveal);return}
 const cloze=ev.target.closest('.cloze');
 if(cloze){ev.stopPropagation();toggleReveal(cloze.dataset.reveal);return}
 const jump=ev.target.closest('.relation-jump');
 if(jump){ev.stopPropagation();const id=jump.dataset.node;selectReview(id);const el=document.querySelector('#eventPoints [data-node="'+id+'"]');if(el)el.focus();return}
 const node=ev.target.closest('[data-node]');if(node){ev.stopPropagation();const id=node.dataset.node;selectNode(id);if(isReview()){const el=document.querySelector('#eventPoints [data-node="'+id+'"]');if(el)el.focus()}return}
 const page=ev.target.closest('[data-page]');if(page){ev.stopPropagation();showSource(+page.dataset.page)}
});
document.addEventListener('pointerover',ev=>{if(ev.pointerType==='touch')return;const n=ev.target.closest('[data-node]');if(n&&!n.closest('#knowledgePopover')&&!n.contains(ev.relatedTarget))previewNode(n)});
document.addEventListener('pointerout',ev=>{const n=ev.target.closest('[data-node]');if(n&&!n.closest('#knowledgePopover')&&!n.contains(ev.relatedTarget)){if(isReview()){clearTimeout(hoverTimer);if(!pinned)reviewPreview(reviewId);return}scheduleClose()}});
document.addEventListener('focusin',ev=>{if(suppressFocusPreview)return;const n=ev.target.closest('[data-node]');if(!n||n.closest('#knowledgePopover'))return;if(isReview()){if(!ev.target.closest('#knowledgePopover')){const hovered=ev.target.closest('#timelineCanvas [data-node]');if(hovered&&hovered.dataset.node!==reviewId)reviewPreview(hovered.dataset.node)}return}previewNode(n)});
document.addEventListener('focusout',ev=>{if(isReview()){const node=ev.target.closest('[data-node]');if(node&&!ev.relatedTarget?.closest('#knowledgePopover,[data-node]')){if(!pinned)reviewPreview(reviewId)}return}if(!ev.relatedTarget?.closest('#knowledgePopover,[data-node]'))scheduleClose()});
document.addEventListener('pointerdown',ev=>{if(!ev.target.closest('#knowledgePopover,[data-node],[data-edge],dialog')){closePopover()}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('modal').open){if(isReview()){closeReviewCard();return}const target=lastAnchor;closePopover();if(target?.isConnected)target.focus();clearTimeout(hoverTimer)}});

function showEra(){modal('<div class="eyebrow">CONTEXT / 历史背景</div><h2>三个维度，分别理解</h2><p><b>革命阶段：</b>1919 年五四运动是新民主主义革命的开端。样板后段由大革命转向土地革命战争时期的新道路探索。</p><p><b>革命性质：</b>新民主主义革命仍属于资产阶级民主革命，承担反帝反封建任务，由无产阶级领导。</p><p><b>社会性质：</b>当时中国仍是半殖民地半封建社会。这与革命性质是不同问题。</p><div class="source">分期框架依据 PDF 第 2 页；样板事件依据第 35—47 页。'+sourceButtons([2,35,46])+'</div>')}

$('filters').addEventListener('click',ev=>{const button=ev.target.closest('[data-kind]');if(!button)return;const k=button.dataset.kind;closePopover();if(state.active.has(k))state.active.delete(k);else state.active.add(k);render();document.querySelector('#filters [data-kind="'+k+'"]')?.focus()});
$('search').addEventListener('input',ev=>{closePopover();state.query=ev.target.value;render()});
$('resetFilters').onclick=()=>{closePopover();state.active=new Set(kinds);state.query='';$('search').value='';state.start=MIN;state.end=MAX;render()};
$('closeModal').onclick=()=>$('modal').close();$('modal').addEventListener('click',ev=>{if(ev.target===$('modal'))$('modal').close()});$('aboutBtn').onclick=about;
document.addEventListener('click',ev=>{if(drag)return;const n=ev.target.closest('[data-node]');if(n){const anchor=n.closest('#knowledgePopover')?null:n;selectNode(n.dataset.node,anchor);return}if(ev.target.closest('[data-context]')){showEra();return}const e=ev.target.closest('[data-edge]');if(e){if(isReview()){toggleReviewEdge(e.dataset.edge);return}edgeInfo(e.dataset.edge);return}const p=ev.target.closest('[data-page]');if(p)showSource(+p.dataset.page)});
document.addEventListener('keydown',ev=>{if(ev.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){ev.preventDefault();$('search').focus()}if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('g[role="button"]')){ev.preventDefault();ev.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
document.querySelectorAll('.mode-option').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('timelineCanvas').setAttribute('tabindex','-1');
const track=$('miniTrack'),canvas=$('timelineCanvas');
canvas.addEventListener('pointerenter',moveTimelineCursor);
canvas.addEventListener('pointermove',moveTimelineCursor);
canvas.addEventListener('pointerleave',hideTimelineCursor);
canvas.addEventListener('pointercancel',hideTimelineCursor);
window.addEventListener('blur',hideTimelineCursor);
function beginDrag(ev,mode,scale){if(ev.button!==0)return;ev.preventDefault();if(!(isReview()&&reviewId))closePopover();drag={pointer:ev.pointerId,x:ev.clientX,a:state.start,b:state.end,mode,scale,owner:ev.currentTarget};ev.currentTarget.setPointerCapture(ev.pointerId);canvas.classList.toggle('dragging',mode==='canvas')}
track.addEventListener('pointerdown',ev=>{const rect=track.getBoundingClientRect();let mode=ev.target.closest('#startHandle')?'start':ev.target.closest('#endHandle')?'end':'pan';if(!ev.target.closest('#rangeWindow')){const center=MIN+(ev.clientX-rect.left)/rect.width*(MAX-MIN),span=state.end-state.start;applyRange(center-span/2,center+span/2)}beginDrag(ev,mode,(MAX-MIN)/rect.width)});
canvas.addEventListener('pointerdown',ev=>{if(ev.target.closest('[data-node],[data-edge],[data-context]'))return;beginDrag(ev,'canvas',-(state.end-state.start)/(dimensions.W-dimensions.left-dimensions.right))});
function moveDrag(ev){if(!drag||ev.pointerId!==drag.pointer)return;const delta=(ev.clientX-drag.x)*drag.scale;if(drag.mode==='start')applyRange(Math.max(MIN,Math.min(drag.a+delta,drag.b-MIN_SPAN)),drag.b);else if(drag.mode==='end')applyRange(drag.a,Math.min(MAX,Math.max(drag.b+delta,drag.a+MIN_SPAN)));else applyRange(drag.a+delta,drag.b+delta)}
function endDrag(ev){if(!drag||ev.pointerId!==drag.pointer)return;const owner=drag.owner;drag=null;canvas.classList.remove('dragging');if(owner.hasPointerCapture(ev.pointerId))owner.releasePointerCapture(ev.pointerId)}
for(const target of [track,canvas]){target.addEventListener('pointermove',moveDrag);target.addEventListener('pointerup',endDrag);target.addEventListener('pointercancel',endDrag);target.addEventListener('lostpointercapture',()=>{drag=null;canvas.classList.remove('dragging')});target.addEventListener('dblclick',ev=>{if(ev.target.closest('[data-node],[data-edge],[data-context]'))return;applyRange(MIN,MAX)});}
canvas.addEventListener('wheel',ev=>{ev.preventDefault();const span=state.end-state.start;if(ev.shiftKey||Math.abs(ev.deltaX)>Math.abs(ev.deltaY)){const delta=(ev.deltaX||ev.deltaY)/600*span;applyRange(state.start+delta,state.end+delta);return}const rect=canvas.getBoundingClientRect(),ratio=Math.max(0,Math.min(1,(ev.clientX-rect.left-dimensions.left)/(dimensions.W-dimensions.left-dimensions.right))),anchor=state.start+ratio*span,next=Math.max(MIN_SPAN,Math.min(MAX-MIN,span*Math.exp(ev.deltaY*.0015)));applyRange(anchor-ratio*next,anchor+(1-ratio)*next)},{passive:false});
for(const id of ['startHandle','endHandle','rangeWindow'])$(id).addEventListener('keydown',ev=>{if(ev.target!==ev.currentTarget)return;const delta=ev.key==='ArrowRight'?.25:ev.key==='ArrowLeft'?-.25:0;if(ev.key==='Home'){ev.preventDefault();applyRange(MIN,MAX);return}if(!delta)return;ev.preventDefault();if(id==='startHandle')applyRange(Math.min(state.start+delta,state.end-MIN_SPAN),state.end);else if(id==='endHandle')applyRange(state.start,Math.max(state.end+delta,state.start+MIN_SPAN));else applyRange(state.start+delta,state.end+delta)});
window.addEventListener('resize',()=>{if(!(isReview()&&reviewId))closePopover();renderTimeline();if(isReview()&&reviewId){const el=document.querySelector('#eventPoints [data-node="'+reviewId+'"]');if(el)lastAnchor=el}});setMode('study');render();
