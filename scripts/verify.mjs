import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},value:'',clientWidth:1000,clientHeight:700,hidden:id==='knowledgePopover',contains(){return false},getBoundingClientRect(){return {left:220,right:1220,top:0,width:1000}},querySelectorAll(){return []},setAttribute(k,v){this[k]=v},classList:{toggle(){},remove(){}},addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)}
const sandbox={window:{addEventListener(){}},document:{getElementById:el,querySelector:el,querySelectorAll(){return []},addEventListener(){},body:{classList:{toggle(){},add(){},remove(){}}},activeElement:{tagName:'BODY'}},innerWidth:1400,innerHeight:900,setTimeout,clearTimeout,console};vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('dist/data.js','utf8'),sandbox);const data=sandbox.window.HISTORY_DATA;const ids=new Set(data.nodes.map(n=>n.id));assert.equal(ids.size,data.nodes.length);
for(const n of data.nodes){assert(n.year>=1919&&n.year<1928);for(const p of n.pages)assert(fs.existsSync(`dist/sources/page-${p}.jpg`))}
for(const e of data.edges){assert(ids.has(e.source)&&ids.has(e.target));assert(fs.existsSync(`dist/sources/page-${e.page}.jpg`))}
vm.runInContext(fs.readFileSync('dist/app.js','utf8'),sandbox);
assert(el('timelineCanvas').innerHTML.includes('五四运动'));assert.equal(el('knowledgePopover').hidden,true);
vm.runInContext("openPopover('mao',null,false)",sandbox);assert(el('detail').innerHTML.includes('light-summary'));assert(!el('detail').innerHTML.includes('PDF'));assert(el('relationLines').innerHTML.includes('撰写'));
vm.runInContext("selectNode('mao')",sandbox);assert.equal(el('knowledgePopover').hidden,false);assert(el('relationLines').innerHTML.includes('撰写'));assert(el('detail').innerHTML.includes('PDF'));
assert(!el('detail').innerHTML.includes('exploreGraph'));vm.runInContext('closePopover()',sandbox);assert.equal(el('knowledgePopover').hidden,true);assert.equal(el('relationLines').innerHTML,'');

vm.runInContext('applyRange(1924,1928)',sandbox);assert(!el('timelineCanvas').innerHTML.includes('五四运动'));assert(el('timelineCanvas').innerHTML.includes('八七会议'));
vm.runInContext('applyRange(1927.9,1928)',sandbox);assert.equal(vm.runInContext('state.end-state.start',sandbox),.5);assert.equal(vm.runInContext('state.end',sandbox),1928);
vm.runInContext('applyRange(1918,1921)',sandbox);assert.equal(vm.runInContext('state.start',sandbox),1919);assert.equal(vm.runInContext('state.end-state.start',sandbox),3);
vm.runInContext("state.query='不存在的知识点';render()",sandbox);assert.equal(el('empty').hidden,false);
vm.runInContext("showSource(46)",sandbox);assert(el('modalBody').innerHTML.includes('sources/page-46.jpg'));

// ---- review mode ----
vm.runInContext("state.query='';state.active=new Set(kinds);applyRange(1919,1928)",sandbox);
const get=code=>vm.runInContext(code,sandbox);
get("setMode('review')");
assert.equal(get('mode'),'review');
assert.equal(el('relationLines').innerHTML,'','review default must not show all relations');
assert(el('timelineCanvas').innerHTML.includes('五四运动'),'review map keeps node names');
assert(get('state.start')===1919&&get('state.end')===1928,'mode switch keeps range');
get("selectNode('party1')");
assert.equal(get('reviewId'),'party1');
assert.equal(el('knowledgePopover').hidden,false);
const card=el('detail').innerHTML;
assert(card.includes('中共一大')&&card.includes('会议')&&card.includes('1921'),'card shows title/kind/date');
assert(card.includes('class="cloze"')&&card.includes('relation-line'),'inline cloze in points; relations listed plainly');
assert(card.includes('揭晓：中共一大第 1 条核心知识中的第 1 处挖空'),'cloze has accessible name');
assert(card.includes('毛泽东')&&card.includes('：出席'),'relation text visible in card (map shows it too)');
assert(card.includes('武汉')===false,'party1 point 0 has no cloze leak');
assert(!card.includes('嘉兴'),'blanked words are absent from the DOM before reveal');
assert(card.includes('举行，最后一天转移到'),'context text stays visible');
assert(card.includes('出席'),'relation text is not blanked any more');
assert(el('relationLines').innerHTML.includes('>出席<'),'map shows relation text directly');
assert(el('relationLines').innerHTML.includes('aria-label="毛泽东出席中共一大"'),'edge aria-label carries the relation');
// independent reveal: one clause only
get("toggleReveal('p0:1')");
assert(get("revealed.has('p0:1')")===true);
assert(get("revealed.has('p0:0')")===false,'other blanks stay hidden');
assert.equal(get("revealed.size"),1);
// reveal-all covers every blank of the card
get('revealAll()');
assert(get("revealed.has('p0:0')")&&get("revealed.has('p0:1')"));
assert(get('revealed.size')>5);
get('recoverAll()');assert.equal(get('revealed.size'),0);
// relation text stays visible regardless of card blanks
assert(el('relationLines').innerHTML.includes('>出席<'));
// recover
get('recoverAll()');
assert.equal(get('revealed.size'),0);
assert(el('relationLines').innerHTML.includes('>出席<'),'recover does not blank the map');
// reveal all then recover
get('revealAll()');
assert(el('relationLines').innerHTML.includes('>出席<'));
get('recoverAll()');
// switching nodes starts covered
get("selectNode('mao')");
assert.equal(get('reviewId'),'mao');
assert(get("revealed.size")===0,'new card starts covered');
// mode switch back to study restores detail card behaviour
get("setMode('study')");
assert.equal(get('mode'),'study');
assert.equal(get('reviewId'),null);
get("selectNode('mao')");
assert(el('detail').innerHTML.includes('核心知识 / KEY POINTS')&&el('detail').innerHTML.includes('PDF'));
assert(!el('detail').innerHTML.includes('data-reveal'),'study card has no covers');
get("closePopover()");
assert.equal(el('relationLines').innerHTML,'');
// nodes with no review content / no relations must not throw
get("byId.test={id:'test',title:'测试节点',kind:'事件',year:1920,date:'1920 年',pages:[35],summary:'',points:[],exam:''};setMode('review');selectReview('test')");
assert.equal(get('reviewId'),'test');
assert(el('detail').innerHTML.includes('尚未收录直接关系'));
assert(el('detail').innerHTML.includes('本项暂无需遮盖的复习内容'));
get("selectNode('may4')");
assert.equal(get('reviewId'),'may4');
assert(get("revealed.size")===0);
const html=fs.readFileSync('dist/index.html','utf8');for(const id of ['graphTab','timelineTab','period','startYear','endYear','resultCount','canvasTitle'])assert(!html.includes(`id="${id}"`));
assert(html.indexOf('id="search"')<html.indexOf('</aside>'));
assert(html.includes('data-mode="study"')&&html.includes('data-mode="review"'));
console.log('PASS: source integrity, floating cards, inline relations, range boundaries and minimum zoom, filtering, source viewer, removed controls and left search, review mode (mode switch, range kept, hidden relations, per-item reveal, map sync, recover, study unaffected).');
