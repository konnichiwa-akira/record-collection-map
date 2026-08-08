(() => {
  'use strict';

  const BUNDLED = Array.isArray(window.COLLECTION_DATA) ? window.COLLECTION_DATA : [];
  const INFLUENCES = Array.isArray(window.INFLUENCE_DATA) ? window.INFLUENCE_DATA : [];
  const STORAGE = {
    cache: 'record-map:enrichment:v1',
    imported: 'record-map:imported:v1',
  };

  const GENRES = [
    {name:'ワールド / その他', color:'#7c5ce0', bg:'#f7f4ff', icon:'◎'},
    {name:'エレクトロニック / ダンス', color:'#4b97ef', bg:'#f2f8ff', icon:'≋'},
    {name:'ロック / ポストパンク / ニューウェーブ', color:'#ff5a68', bg:'#fff4f5', icon:'⌁'},
    {name:'シティポップ / J-POP', color:'#f39a35', bg:'#fff8f0', icon:'▥'},
    {name:'レゲエ / スカ / ダブ', color:'#34a96b', bg:'#f3fbf6', icon:'♒'},
    {name:'ヒップホップ', color:'#387cf0', bg:'#f2f7ff', icon:'♙'},
    {name:'ソウル / ファンク', color:'#e7a11b', bg:'#fff9ed', icon:'♫'},
    {name:'ジャズ', color:'#6956d9', bg:'#f7f5ff', icon:'▥'},
  ];
  const genreMap = new Map(GENRES.map((g,i)=>[g.name,{...g,index:i}]));

  const els = {
    appShell: document.getElementById('appShell'),
    search: document.getElementById('searchInput'),
    networkToggle: document.getElementById('networkToggle'),
    detailToggle: document.getElementById('detailToggle'), detailToggleLabel: document.getElementById('detailToggleLabel'),
    filters: document.getElementById('decadeFilters'),
    enrichButton: document.getElementById('enrichButton'),
    enrichStatus: document.getElementById('enrichStatus'),
    genreLabels: document.getElementById('genreLabels'),
    plotViewport: document.getElementById('plotViewport'),
    plotCanvas: document.getElementById('plotCanvas'),
    yearAxis: document.getElementById('yearAxis'),
    genreBands: document.getElementById('genreBands'),
    edgeLayer: document.getElementById('edgeLayer'),
    nodeLayer: document.getElementById('nodeLayer'),
    zoomOut: document.getElementById('zoomOut'), zoomIn: document.getElementById('zoomIn'), zoomLabel: document.getElementById('zoomLabel'),
    detailPanel: document.getElementById('detailPanel'), detailEmpty: document.getElementById('detailEmpty'), detailContent: document.getElementById('detailContent'),
    closeDetail: document.getElementById('closeDetail'), detailCover: document.getElementById('detailCover'), detailTitle: document.getElementById('detailTitle'), detailArtist: document.getElementById('detailArtist'), detailGenre: document.getElementById('detailGenre'),
    detailYear: document.getElementById('detailYear'), detailYearSource: document.getElementById('detailYearSource'), detailLabel: document.getElementById('detailLabel'), detailFormat: document.getElementById('detailFormat'), detailDiscogs: document.getElementById('detailDiscogs'), relationList: document.getElementById('relationList'), evidenceBox: document.getElementById('evidenceBox'), evidenceReliability: document.getElementById('evidenceReliability'), evidenceRelation: document.getElementById('evidenceRelation'), evidenceNote: document.getElementById('evidenceNote'), strengthFill: document.getElementById('strengthFill'), strengthValue: document.getElementById('strengthValue'), evidenceLink: document.getElementById('evidenceLink'),
    statTotal:document.getElementById('statTotal'), statVisible:document.getElementById('statVisible'), statGenres:document.getElementById('statGenres'), statPeriod:document.getElementById('statPeriod'), statResolved:document.getElementById('statResolved'),
    csvFileInput: document.getElementById('csvFileInput'), toast: document.getElementById('toast'),
  };

  let cache = readJSON(STORAGE.cache, {});
  let collection = readJSON(STORAGE.imported, null) || BUNDLED.map(x=>({...x}));
  let query = '';
  let decade = 'all';
  let activeGenre = null;
  let networkEnabled = true;
  let zoom = 1;
  let detailPanelVisible = window.matchMedia('(min-width: 1181px)').matches;
  let selectedAlbumId = null;
  let selectedEdgeId = null;
  let nodePositions = new Map();
  let visibleAlbums = [];
  let enrichmentRunning = false;
  let enrichmentCancel = false;
  let autoStarted = false;
  const minYear = 1955, maxYear = 2026;
  const basePxPerYear = 25;

  function readJSON(key, fallback){
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  }
  function writeJSON(key, value){ try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function hash(str){ let h=2166136261; for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)} return h>>>0; }
  function cleanArtist(s){
    let v=String(s||'').trim().replace(/\s*\(\d+\)\s*$/,'');
    if(v.includes(' = ')) v=v.split(' = ')[0].trim();
    return v;
  }
  function norm(s){ return String(s||'').toLowerCase().replace(/[’]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' '); }
  function getGenre(album){ return genreMap.get(album.genre) || genreMap.get('ワールド / その他'); }
  function getEnriched(album){ return cache[album.id] || null; }
  function yearInfo(album){
    const c=getEnriched(album);
    if(c?.firstYear) return {year:Number(c.firstYear), source:'MusicBrainz', resolved:true};
    if(album.firstYear) return {year:Number(album.firstYear), source:'初版年シード', resolved:true};
    if(album.csvYear) return {year:Number(album.csvYear), source:'CSV発売年（暫定）', resolved:false};
    return {year:null, source:'未照合', resolved:false};
  }
  function effectiveYear(album){ return yearInfo(album).year || 1985; }
  function coverUrl(album){ return getEnriched(album)?.coverUrl || null; }
  function albumLabel(album){ return `${album.artist} — ${album.title}`; }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  function toast(msg){ els.toast.textContent=msg; els.toast.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>els.toast.classList.remove('show'),2500); }

  function decadeOptions(){ return ['all','1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s']; }
  function renderDecadeFilters(){
    els.filters.innerHTML='';
    decadeOptions().forEach(d=>{
      const b=document.createElement('button'); b.className='chip'+(decade===d?' active':''); b.textContent=d==='all'?'すべて':d;
      b.addEventListener('click',()=>{decade=d;renderAll();}); els.filters.appendChild(b);
    });
  }

  function matchesFilters(a){
    const yi=yearInfo(a); const y=yi.year;
    if(activeGenre && a.genre!==activeGenre) return false;
    if(decade!=='all'){
      const start=Number(decade.slice(0,4)); if(!y || y<start || y>start+9) return false;
    }
    if(query){
      const hay=norm(`${a.artist} ${a.title} ${a.genre} ${a.label}`); if(!hay.includes(norm(query))) return false;
    }
    return true;
  }

  function renderGenreLabels(){
    els.genreLabels.innerHTML='';
    GENRES.forEach(g=>{
      const div=document.createElement('div'); div.className='genre-label'+(activeGenre && activeGenre!==g.name?' dimmed':''); div.style.color=g.color; div.style.background=g.bg;
      const icon=document.createElement('span');icon.className='genre-icon';icon.textContent=g.icon; const txt=document.createElement('span');txt.textContent=g.name;
      div.append(icon,txt); div.title=activeGenre===g.name?'ジャンル絞り込みを解除':`${g.name}だけ表示`;
      div.addEventListener('click',()=>{activeGenre=activeGenre===g.name?null:g.name;renderAll();}); els.genreLabels.appendChild(div);
    });
  }

  function plotDimensions(){
    const laneH=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--lane-h'))||78;
    const axisH=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--axis-h'))||34;
    const width=Math.max(1100, Math.round((maxYear-minYear)*basePxPerYear*zoom));
    const h=GENRES.length*laneH;
    return {laneH,axisH,width,height:h};
  }
  function xForYear(year,d){ return ((Math.max(minYear,Math.min(maxYear,year))-minYear)/(maxYear-minYear))*d.width; }

  function renderAxisAndBands(d){
    els.plotCanvas.style.width=d.width+'px';
    els.yearAxis.innerHTML=''; els.genreBands.innerHTML='';
    for(let y=1955;y<=2025;y+=5){
      const x=xForYear(y,d); const tick=document.createElement('span');tick.className='year-tick';tick.style.left=x+'px';tick.textContent=y; els.yearAxis.appendChild(tick);
      const grid=document.createElement('i');grid.className='year-grid';grid.style.left=x+'px';els.genreBands.appendChild(grid);
    }
    GENRES.forEach(g=>{const band=document.createElement('div');band.className='genre-band';band.style.background=g.bg;els.genreBands.appendChild(band);});
    els.edgeLayer.setAttribute('width',d.width);els.edgeLayer.setAttribute('height',d.height);els.edgeLayer.style.width=d.width+'px';els.edgeLayer.style.height=d.height+'px';
  }

  function connectedAlbumKeys(){
    const set=new Set();
    INFLUENCES.forEach(e=>{const a=findAlbumForRef(e.from,collection);const b=findAlbumForRef(e.to,collection);if(a)set.add(a.id);if(b)set.add(b.id)});return set;
  }

  function renderNodes(d){
    els.nodeLayer.innerHTML=''; nodePositions=new Map();
    visibleAlbums=collection.filter(matchesFilters);
    const connected=connectedAlbumKeys();
    const searchActive=!!query;
    const frag=document.createDocumentFragment();
    visibleAlbums.forEach((album,idx)=>{
      const yi=yearInfo(album); const year=yi.year || 1985; const g=getGenre(album);
      const baseY=g.index*d.laneH+d.laneH/2;
      const h=hash(album.id+'|'+album.title); const y=baseY+((h%5)-2)*5.5; const x=xForYear(year,d)+(((h>>4)%7)-3)*2.2;
      const isFeatured=album.featured || connected.has(album.id) || album.id===selectedAlbumId || (searchActive && idx<80);
      nodePositions.set(album.id,{x,y,album,isFeatured});
      if(isFeatured){
        const n=document.createElement('div'); n.className='album-node'+(!yi.resolved?' unresolved':'')+(album.id===selectedAlbumId?' selected':''); n.style.left=x+'px';n.style.top=y+'px';n.dataset.id=album.id;n.title=`${albumLabel(album)}\n${yi.year||'年不明'} / ${yi.source}`;
        const tile=document.createElement('div');tile.className='art-tile'; buildArtwork(tile,album);
        const dot=document.createElement('i');dot.className='year-source-dot'+(yi.resolved?'':' csv');dot.title=yi.resolved?'初版年確定':'CSV年を暫定利用';tile.appendChild(dot);
        const cap=document.createElement('div');cap.className='album-caption';cap.textContent=album.title;
        n.append(tile,cap);n.addEventListener('click',(ev)=>{ev.stopPropagation();selectAlbum(album.id,null);});frag.appendChild(n);
      } else {
        const dot=document.createElement('button');dot.className='album-dot';dot.style.left=x+'px';dot.style.top=y+'px';dot.style.background=g.color;dot.setAttribute('aria-label',albumLabel(album));dot.title=`${albumLabel(album)}\n${yi.year||'年不明'} / ${yi.source}`;dot.addEventListener('click',(ev)=>{ev.stopPropagation();selectAlbum(album.id,null);});frag.appendChild(dot);
      }
    });
    els.nodeLayer.appendChild(frag);
  }

  function buildArtwork(container,album){
    const url=coverUrl(album);
    if(url){
      const img=document.createElement('img');img.loading='lazy';img.alt=`${album.artist} ${album.title} artwork`;img.src=url;
      img.addEventListener('error',()=>{container.innerHTML='';container.appendChild(makePlaceholder(album));},{once:true});container.appendChild(img);
    }else container.appendChild(makePlaceholder(album));
  }
  function makePlaceholder(album){
    const p=document.createElement('div');p.className='art-placeholder';const h=hash(album.artist+'|'+album.title);const hue=h%360;const hue2=(hue+50+(h%80))%360;p.style.background=`linear-gradient(${35+(h%110)}deg,hsl(${hue} 46% 34%),hsl(${hue2} 62% 58%))`;
    const b=document.createElement('b');b.textContent=album.title;const s=document.createElement('small');s.textContent=album.artist;p.append(b,s);return p;
  }

  function findAlbumForRef(ref, list=collection){
    const ar=norm(cleanArtist(ref.artist));const tr=norm(ref.title);let best=null,bestScore=-1;
    for(const a of list){
      const aa=norm(cleanArtist(a.artist)); if(aa!==ar && !aa.includes(ar) && !ar.includes(aa)) continue;
      const at=norm(a.title); let score=0;
      if(at===tr) score=100; else if(at.includes(tr)||tr.includes(at)) score=70+Math.min(at.length,tr.length)/Math.max(at.length,tr.length)*20; else {
        const words=tr.split(' ').filter(w=>w.length>2); score=words.length?words.filter(w=>at.includes(w)).length/words.length*60:0;
      }
      const yi=yearInfo(a); if(yi.resolved) score+=3; if(score>bestScore){bestScore=score;best=a;}
    }
    return bestScore>=45?best:null;
  }

  function edgeColor(e){ return e.reliabilityBand==='high'?'#f2a20a':e.reliabilityBand==='medium'?'#2f7df0':'#a5acb8'; }
  function edgeWidth(e){ return 0.8+Number(e.strength||1)*0.75; }
  function renderEdges(d){
    els.edgeLayer.innerHTML=''; if(!networkEnabled) return;
    const visibleSet=new Set(visibleAlbums.map(a=>a.id));
    const ns='http://www.w3.org/2000/svg';
    const defs=document.createElementNS(ns,'defs');
    [['high','#f2a20a'],['medium','#2f7df0'],['low','#a5acb8']].forEach(([id,color])=>{const m=document.createElementNS(ns,'marker');m.setAttribute('id','arrow-'+id);m.setAttribute('markerWidth','7');m.setAttribute('markerHeight','7');m.setAttribute('refX','6');m.setAttribute('refY','3.5');m.setAttribute('orient','auto');const p=document.createElementNS(ns,'path');p.setAttribute('d','M0,0 L7,3.5 L0,7 z');p.setAttribute('fill',color);m.appendChild(p);defs.appendChild(m);});els.edgeLayer.appendChild(defs);
    INFLUENCES.forEach(edge=>{
      const from=findAlbumForRef(edge.from),to=findAlbumForRef(edge.to); if(!from||!to||!visibleSet.has(from.id)||!visibleSet.has(to.id)) return;
      const p1=nodePositions.get(from.id),p2=nodePositions.get(to.id);if(!p1||!p2)return;
      const dx=Math.max(50,Math.abs(p2.x-p1.x)*0.42);const direction=p2.x>=p1.x?1:-1;const bend=((hash(edge.id)%3)-1)*18;
      const pathD=`M ${p1.x} ${p1.y} C ${p1.x+direction*dx} ${p1.y+bend}, ${p2.x-direction*dx} ${p2.y-bend}, ${p2.x} ${p2.y}`;
      const group=document.createElementNS(ns,'g');group.classList.add('edge-group');group.dataset.edgeId=edge.id;
      const hit=document.createElementNS(ns,'path');hit.setAttribute('d',pathD);hit.classList.add('edge-hit');
      const path=document.createElementNS(ns,'path');path.setAttribute('d',pathD);path.classList.add('edge-visible');path.setAttribute('stroke',edgeColor(edge));path.setAttribute('stroke-width',edgeWidth(edge));path.setAttribute('marker-end',`url(#arrow-${edge.reliabilityBand})`); if(edge.id===selectedEdgeId){path.setAttribute('opacity','1');path.setAttribute('stroke-width',edgeWidth(edge)+2);}
      const title=document.createElementNS(ns,'title');title.textContent=`${edge.from.artist} → ${edge.to.artist}\nソース: ${edge.source.publisher}\n信頼度: ${Math.round(edge.reliability*100)}% / 強さ: ${edge.strength.toFixed(1)}`;path.appendChild(title);
      hit.addEventListener('click',(ev)=>{ev.stopPropagation();selectedEdgeId=edge.id;selectAlbum(to.id,edge.id);});group.append(hit,path);els.edgeLayer.appendChild(group);
    });
  }

  function updateStats(){
    els.statTotal.textContent=collection.length.toLocaleString('ja-JP');els.statVisible.textContent=visibleAlbums.length.toLocaleString('ja-JP');
    els.statGenres.textContent=new Set(visibleAlbums.map(a=>a.genre)).size;
    const years=visibleAlbums.map(a=>yearInfo(a).year).filter(Boolean);els.statPeriod.textContent=years.length?`${Math.min(...years)} – ${Math.max(...years)}`:'–';
    const resolved=collection.filter(a=>yearInfo(a).resolved).length;els.statResolved.textContent=`${resolved}/${collection.length}`;
  }

  function renderAll(){
    renderDecadeFilters();renderGenreLabels();const d=plotDimensions();renderAxisAndBands(d);renderNodes(d);renderEdges(d);updateStats();els.zoomLabel.textContent=Math.round(zoom*100)+'%';
    if(selectedAlbumId) renderDetail();
  }

  function setDetailPanelVisible(visible,{returnFocus=false}={}){
    detailPanelVisible=visible;
    els.appShell.classList.toggle('detail-collapsed',!visible);
    els.detailPanel.classList.toggle('open',visible);
    els.detailPanel.setAttribute('aria-hidden',String(!visible));
    els.detailToggle.setAttribute('aria-expanded',String(visible));
    els.detailToggle.classList.toggle('detail-visible',visible);
    els.detailToggleLabel.textContent=visible?'詳細を隠す':'詳細を表示';
    els.detailToggle.title=visible?'アルバム詳細を非表示にする':'アルバム詳細を表示する';
    if(returnFocus) els.detailToggle.focus();
  }
  function selectAlbum(id,edgeId){ selectedAlbumId=id;if(edgeId!==undefined&&edgeId!==null)selectedEdgeId=edgeId;setDetailPanelVisible(true);renderAll();renderDetail();const a=collection.find(x=>x.id===id);if(a&&!getEnriched(a)) enrichSingle(a,true); }
  function closeDetail(){setDetailPanelVisible(false,{returnFocus:true});}

  function renderDetail(){
    const album=collection.find(a=>a.id===selectedAlbumId);if(!album){els.detailContent.classList.add('hidden');els.detailEmpty.classList.remove('hidden');return;}
    els.detailEmpty.classList.add('hidden');els.detailContent.classList.remove('hidden');els.detailCover.innerHTML='';buildArtwork(els.detailCover,album);els.detailTitle.textContent=album.title;els.detailArtist.textContent=album.artist;els.detailGenre.textContent=album.genre;const g=getGenre(album);els.detailGenre.style.background=g.bg;els.detailGenre.style.color=g.color;
    const yi=yearInfo(album);els.detailYear.textContent=yi.year||'未照合';els.detailYearSource.textContent=yi.source+(getEnriched(album)?.matchScore?` / match ${getEnriched(album).matchScore}`:'');els.detailLabel.textContent=album.label||'–';els.detailFormat.textContent=album.format||'–';
    if(album.discogsUrl){els.detailDiscogs.href=album.discogsUrl;els.detailDiscogs.style.pointerEvents='auto';els.detailDiscogs.style.opacity='1';}else{els.detailDiscogs.removeAttribute('href');els.detailDiscogs.style.pointerEvents='none';els.detailDiscogs.style.opacity='.45';}
    renderRelations(album);renderEvidence(selectedEdgeId?INFLUENCES.find(e=>e.id===selectedEdgeId):null);
  }

  function renderRelations(album){
    els.relationList.innerHTML=''; const rels=[];
    INFLUENCES.forEach(e=>{const f=findAlbumForRef(e.from),t=findAlbumForRef(e.to);if(f?.id===album.id||t?.id===album.id) rels.push({edge:e,from:f,to:t});});
    if(!rels.length){const p=document.createElement('div');p.className='relation-item';p.textContent='現在の根拠データには接続がありません。';els.relationList.appendChild(p);return;}
    rels.forEach(({edge,from,to})=>{const div=document.createElement('div');div.className='relation-item';const outgoing=from?.id===album.id;const direction=edge.scope==='lineage'?(outgoing?'直接系譜':'前身・所属元'):(outgoing?'影響を与えた':'影響を受けた');const other=outgoing?to:from;const a=document.createElement('div');a.className='relation-arrow';a.textContent=`${direction} → ${other?other.artist:'不明'} / ${other?other.title:''}`;const m=document.createElement('div');m.className='relation-meta';const dot=document.createElement('span');dot.className='dot-badge';dot.style.background=edgeColor(edge);const t=document.createElement('span');t.textContent=`${edge.scope==='lineage'?'直接系譜':'影響'} ・ ${edge.source.publisher} ・ 信頼度 ${Math.round(edge.reliability*100)}% ・ 強さ ${edge.strength.toFixed(1)}`;m.append(dot,t);div.append(a,m);div.addEventListener('click',()=>{selectedEdgeId=edge.id;renderEvidence(edge);renderAll();});els.relationList.appendChild(div);});
  }

  function renderEvidence(edge){
    if(!edge){els.evidenceBox.classList.add('hidden');return;}els.evidenceBox.classList.remove('hidden');els.evidenceReliability.className='reliability-badge '+edge.reliabilityBand;els.evidenceReliability.textContent=`ソース信頼度 ${Math.round(edge.reliability*100)}%`;els.evidenceRelation.textContent=`${edge.from.artist} → ${edge.to.artist}`;els.evidenceNote.textContent=edge.note;els.strengthFill.style.width=`${Math.min(100,(edge.strength/5)*100)}%`;els.strengthValue.textContent=edge.strength.toFixed(1);els.evidenceLink.href=edge.source.url;els.evidenceLink.textContent=`${edge.source.publisher}: ${edge.source.title} ↗`;
  }

  function luceneEscape(s){ return String(s||'').replace(/[+\-!(){}\[\]^"~*?:\\/]/g,' ').replace(/\s+/g,' ').trim(); }
  function titleSimilarity(a,b){a=norm(a);b=norm(b);if(a===b)return 1;if(a.includes(b)||b.includes(a))return .82;const A=new Set(a.split(' ').filter(x=>x.length>2)),B=new Set(b.split(' ').filter(x=>x.length>2));if(!A.size||!B.size)return 0;let common=0;A.forEach(x=>{if(B.has(x))common++});return (2*common)/(A.size+B.size);}
  function artistCreditText(rg){try{return (rg['artist-credit']||[]).map(c=>c.name||c.artist?.name||'').join(' ')}catch{return ''}}

  async function lookupMusicBrainz(album){
    const artist=luceneEscape(cleanArtist(album.artist));const title=luceneEscape(album.title);
    const q=`releasegroup:"${title}" AND artist:"${artist}"`;const url=`https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(q)}&fmt=json&limit=5`;
    const res=await fetch(url,{headers:{'Accept':'application/json'}});if(!res.ok)throw new Error(`MusicBrainz ${res.status}`);const data=await res.json();const groups=data['release-groups']||[];if(!groups.length) return {notFound:true};
    let best=null,bestScore=-Infinity;for(const rg of groups){const mbScore=Number(rg.score||0)/100;const ts=titleSimilarity(album.title,rg.title||'');const as=titleSimilarity(cleanArtist(album.artist),artistCreditText(rg));const s=mbScore*.55+ts*.30+as*.15;if(s>bestScore){bestScore=s;best=rg;}}
    if(!best||bestScore<.52)return {notFound:true,matchScore:Math.round(bestScore*100)};
    const fr=String(best['first-release-date']||'');const yr=/^\d{4}/.test(fr)?Number(fr.slice(0,4)):null;return {mbid:best.id,firstYear:yr,coverUrl:`https://coverartarchive.org/release-group/${best.id}/front-250`,matchScore:Math.round(bestScore*100),matchedTitle:best.title,matchedArtist:artistCreditText(best),checkedAt:new Date().toISOString()};
  }

  async function enrichSingle(album,silent=false){
    if(getEnriched(album)?.checkedAt) return getEnriched(album);
    try{const result=await lookupMusicBrainz(album);cache[album.id]={...result,checkedAt:new Date().toISOString()};writeJSON(STORAGE.cache,cache);if(!silent)toast(result.notFound?`未一致: ${albumLabel(album)}`:`補完: ${albumLabel(album)}`);if(selectedAlbumId===album.id)renderDetail();return result;}catch(err){if(!silent)toast(`補完失敗: ${err.message}`);return {error:String(err)}}
  }

  async function runEnrichment(list,{auto=false}={}){
    if(enrichmentRunning){enrichmentCancel=true;return;}enrichmentRunning=true;enrichmentCancel=false;els.enrichButton.classList.add('running');els.enrichButton.textContent='補完を停止';
    const queue=list.filter(a=>!getEnriched(a)?.checkedAt);let done=0,ok=0;const total=queue.length; if(!auto) toast(`${total}件を順次補完します（約1件/秒）`);
    for(const album of queue){if(enrichmentCancel)break;els.enrichStatus.textContent=`${done}/${total}`;const r=await enrichSingle(album,true);done++;if(r&&!r.error&&!r.notFound)ok++;if(done%5===0||done===total){renderAll();}await sleep(1100);}
    enrichmentRunning=false;els.enrichButton.classList.remove('running');els.enrichButton.textContent='初版年・アートワークを補完';els.enrichStatus.textContent=enrichmentCancel?`停止 ${done}/${total}`:`完了 ${ok}/${total}`;renderAll(); if(!auto)toast(enrichmentCancel?'補完を停止しました':`補完完了: ${ok}/${total}件`);
  }

  function parseCSV(text){
    const rows=[];let row=[],field='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(q){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')q=false;else field+=c;}else{if(c==='"')q=true;else if(c===','){row.push(field);field='';}else if(c==='\n'){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}}if(field.length||row.length){row.push(field);rows.push(row);}if(!rows.length)return[];const head=rows[0].map(x=>x.trim());return rows.slice(1).filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(head.map((h,i)=>[h,r[i]??''])));}

  function makeImported(rows){
    const bundledByRid=new Map(BUNDLED.filter(x=>x.releaseId).map(x=>[String(x.releaseId),x]));const artistGenres=new Map();BUNDLED.forEach(a=>{const k=norm(cleanArtist(a.artist));if(!artistGenres.has(k))artistGenres.set(k,[]);artistGenres.get(k).push(a.genre)});
    const mode=arr=>arr?.sort((a,b)=>arr.filter(v=>v===a).length-arr.filter(v=>v===b).length).pop();
    return rows.map((r,i)=>{const rid=r.release_id?Number(r.release_id):null;const old=rid?bundledByRid.get(String(rid)):null;const artist=cleanArtist(r.Artist||'');const genre=old?.genre||mode(artistGenres.get(norm(artist)))||'ワールド / その他';const csvYear=Number(r.Released)>0?Number(r.Released):null;return {id:rid?`d${rid}`:`import-${i}`,releaseId:rid,artist,artistRaw:r.Artist||artist,title:r.Title||'',label:r.Label||'',format:r.Format||'',rating:r.Rating?Number(r.Rating):null,csvYear,firstYear:old?.firstYear||null,yearSource:old?.firstYear?'seed':csvYear?'csv':'unknown',genre,dateAdded:r['Date Added']||'',mediaCondition:r['Collection Media Condition']||'',sleeveCondition:r['Collection Sleeve Condition']||'',notes:r['Collection Notes']||'',discogsUrl:rid?`https://www.discogs.com/release/${rid}`:null,featured:old?.featured||false};});
  }

  els.search.addEventListener('input',()=>{query=els.search.value;renderAll();});
  els.networkToggle.addEventListener('click',()=>{networkEnabled=!networkEnabled;els.networkToggle.classList.toggle('network-on',networkEnabled);els.networkToggle.textContent=networkEnabled?'⌘ つながり ON':'⌘ つながり OFF';renderAll();});
  els.detailToggle.addEventListener('click',()=>setDetailPanelVisible(!detailPanelVisible));
  els.enrichButton.addEventListener('click',()=>{if(enrichmentRunning){enrichmentCancel=true;return;}const target=visibleAlbums.slice().sort((a,b)=>(b.featured?1:0)-(a.featured?1:0));runEnrichment(target);});
  els.zoomIn.addEventListener('click',()=>{zoom=Math.min(1.65,Math.round((zoom+.1)*10)/10);renderAll();});els.zoomOut.addEventListener('click',()=>{zoom=Math.max(.65,Math.round((zoom-.1)*10)/10);renderAll();});
  els.closeDetail.addEventListener('click',closeDetail);els.csvFileInput.addEventListener('change',async()=>{const f=els.csvFileInput.files?.[0];if(!f)return;const text=await f.text();const rows=parseCSV(text);if(!rows.length||!('Artist' in rows[0])||!('Title' in rows[0])){toast('Discogs形式のCSVとして読み取れませんでした');return;}collection=makeImported(rows);writeJSON(STORAGE.imported,collection);selectedAlbumId=null;selectedEdgeId=null;query='';decade='all';activeGenre=null;els.search.value='';renderAll();toast(`${collection.length}件を読み込みました`);});
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{const a=btn.dataset.action;if(a==='import'){els.csvFileInput.value='';els.csvFileInput.click();}else if(a==='search-focus'){els.search.focus();}else if(a==='reset'){localStorage.removeItem(STORAGE.imported);collection=BUNDLED.map(x=>({...x}));selectedAlbumId=null;selectedEdgeId=null;renderAll();toast('同梱コレクションへ戻しました');}else if(a==='map'){els.plotViewport.scrollTo({left:0,behavior:'smooth'});}}));
  window.addEventListener('resize',()=>renderAll());
  document.addEventListener('keydown',(event)=>{if(event.key==='Escape'&&detailPanelVisible)closeDetail();});
  els.plotCanvas.addEventListener('click',()=>{selectedEdgeId=null;if(selectedAlbumId){renderEvidence(null);renderEdges(plotDimensions());}});

  setDetailPanelVisible(detailPanelVisible);
  renderAll();
  // Load a small starter batch automatically so real cover art appears without hammering the public API.
  if(!new URLSearchParams(location.search).has('noauto')) setTimeout(()=>{if(autoStarted)return;autoStarted=true;const connected=connectedAlbumKeys();const starter=collection.filter(a=>connected.has(a.id)||a.featured).filter(a=>!getEnriched(a)?.checkedAt).slice(0,10);if(starter.length)runEnrichment(starter,{auto:true});},1200);
})();
