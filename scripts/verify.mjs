import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',style:{},value:'',clientWidth:1000,clientHeight:700,hidden:id==='knowledgePopover',contains(){return false},getBoundingClientRect(){return {left:220,right:1220,top:0,width:1000}},setAttribute(k,v){this[k]=v},classList:{toggle(){},remove(){}},addEventListener(){},focus(){},showModal(){this.open=true},close(){this.open=false}});return elements.get(id)}
const sandbox={window:{addEventListener(){}},document:{getElementById:el,querySelector:el,querySelectorAll(){return []},addEventListener(){},activeElement:{tagName:'BODY'}},innerWidth:1400,innerHeight:900,setTimeout,clearTimeout,console};vm.createContext(sandbox);
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
const html=fs.readFileSync('dist/index.html','utf8');for(const id of ['graphTab','timelineTab','period','startYear','endYear','resultCount','canvasTitle'])assert(!html.includes(`id="${id}"`));
assert(html.indexOf('id="search"')<html.indexOf('</aside>'));
console.log('PASS: source integrity, floating cards, inline relations, range boundaries and minimum zoom, filtering, source viewer, removed controls and left search.');
