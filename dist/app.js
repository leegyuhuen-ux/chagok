'use strict';
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=new Date(), fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`, today=fmt(now), base=today.slice(0,7);
let state;try{state=JSON.parse(localStorage.getItem('chagok-v1'))}catch{}
const defaults={records:[],likes:[],saved:[],comments:{},joined:[],hidden:[],announcements:[],nickname:''};
state={...JSON.parse(JSON.stringify(defaults)),...(state&&Array.isArray(state.records)?state:{})};
if(!state.cleanStart){
 const removed=new Set(state.records.filter(r=>r.sample===true).map(r=>r.id));
 ['p1','p2','p3','t1','t2','t3'].forEach(id=>removed.add(id));
 state.records=state.records.filter(r=>r.sample!==true);
 for(const key of ['likes','saved','hidden'])state[key]=state[key].filter(id=>!removed.has(id));
 for(const id of removed)delete state.comments[id];
 state.joined=state.joined.filter(id=>!['e1','e2'].includes(id));
 state.cleanStart=true;
 try{localStorage.setItem('chagok-v1',JSON.stringify(state))}catch{}
}
let storageKey='chagok-v1', currentUser=null;
let cloud={uid:null,phase:'idle',revision:null,error:null},cloudGeneration=0;
let page='calendar',month=new Date(now.getFullYear(),now.getMonth(),1),selected=today,filter='전체';
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function chip(r){return `<span class="tea-chip ${r.type}">${esc(r.type)}</span>`}function head(title,sub,action=''){return `<div class="page-heading"><div><div class="eyebrow">차곡 by 바라티</div><h1>${title}</h1><p class="sub">${sub}</p></div>${action}</div>`}
function openModal(title,body){$('#modal-body').innerHTML=`<div class="modal-head"><h2>${title}</h2><button aria-label="닫기" onclick="closeModal()">×</button></div>${body}`;if(!$('#modal').open)$('#modal').showModal()}
function closeModal(){$('#modal').close()}
function go(p){if(!requireMember())return;page=p;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#breadcrumb').textContent='나의 찻자리 / '+({calendar:'내 차생활',feed:'차생활 둘러보기',talk:'이야기방',events:'이벤트',admin:'관리자'}[p]);render()}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));$('.brand').onclick=()=>go('calendar');
function render(){if(!requireMember())return;document.body?.classList.remove('membership-locked');({calendar:renderCalendar,feed:renderFeed,talk:renderTalk,events:renderEvents,admin:renderAdmin}[page]||renderCalendar)();}
function renderCalendar(){if(!requireMember())return;const prefix=fmt(month).slice(0,7),records=state.records.filter(r=>r.date.startsWith(prefix));const count={};records.forEach(r=>count[r.type]=(count[r.type]||0)+1);const favorite=Object.keys(count).sort((a,b)=>count[b]-count[a])[0]||'—';const first=new Date(month);first.setDate(1-first.getDay());let cells='';for(let i=0;i<42;i++){const d=new Date(first);d.setDate(first.getDate()+i);const date=fmt(d),rs=state.records.filter(r=>r.date===date);cells+=`<button class="day ${d.getMonth()!==month.getMonth()?'out':''} ${date===today?'today':''} ${date===selected?'selected':''}" aria-label="${date}, 기록 ${rs.length}개" aria-pressed="${date===selected}" onclick="selectDay('${date}')"><span class="day-number">${d.getDate()}</span>${rs.slice(0,2).map(r=>`<span class="tea-chip ${r.type}">${esc(r.name)}</span>`).join('')}${rs.length>2?`<span class="record-meta day-more">+${rs.length-2}</span>`:''}<span class="day-markers" aria-hidden="true">${[...new Set(rs.map(r=>r.type))].map(t=>`<i class="dot ${t}"></i>`).join('')}${rs.length?`<span>${rs.length}잔</span>`:''}</span></button>`}const dayRecords=state.records.filter(r=>r.date===selected);$('#app').innerHTML=head('내 차생활','한 잔의 차, 오래 기억하고 싶은 순간.',`<button class="primary" onclick="editRecord()">＋ 차 기록하기</button>`)+`<div class="stats"><div class="stat"><div><span class="stat-label">차와 함께한 날</span><strong>${new Set(records.map(r=>r.date)).size}<small>일</small></strong></div><span class="stat-icon">◷</span></div><div class="stat"><div><span class="stat-label">이번 달의 기록</span><strong>${records.length}<small>잔의 이야기</small></strong></div><span class="stat-icon">▤</span></div><div class="stat"><div><span class="stat-label">가장 자주 만난 차</span><strong style="font-size:20px">${favorite}</strong></div><span class="stat-icon">♧</span></div></div><div class="workspace"><div class="calendar-box"><div class="calendar-toolbar"><div class="month-nav"><strong>${month.getFullYear()}. ${String(month.getMonth()+1).padStart(2,'0')}</strong><button aria-label="이전 달" onclick="moveMonth(-1)">‹</button><button aria-label="다음 달" onclick="moveMonth(1)">›</button><button class="small-btn" style="font-size:11px;border:1px solid var(--line);padding:2px 8px" onclick="showToday()">오늘</button></div><div class="legend">${['보이차','우롱차','홍차'].map(t=>`<span><i class="dot ${t}"></i>${t}</span>`).join('')}</div></div><div class="week">${['일','월','화','수','목','금','토'].map(d=>`<span>${d}</span>`).join('')}</div><div class="grid">${cells}</div><p class="calendar-help">날짜를 선택해 그날의 차를 만나보세요.</p></div><aside class="day-panel" aria-label="선택한 날짜의 차 기록"><div class="date">${selected.replaceAll('-','. ')} ${selected===today?'· 오늘':''}</div><h2>이날의 찻자리</h2>${dayRecords.length?dayRecords.map(r=>`<article class="record">${chip(r)}<h3>${esc(r.name)}</h3><div class="record-meta">${esc(r.origin||'나의 찻자리')} · ${'나만 보기'}</div><p>${esc(r.note)}</p><button class="text-button" onclick="editRecord('${r.id}')">기록 자세히 보기 ↗</button></article>`).join(''):'<p class="empty">아직 기록이 없어요.<br>이날의 첫 잔을 남겨볼까요?</p>'}<button class="text-button" onclick="editRecord()">＋ 이 날짜에 기록 남기기</button></aside></div>`}
function selectDay(d){if(!requireMember())return;selected=d;renderCalendar()}
function moveMonth(n){if(!requireMember())return;month=new Date(month.getFullYear(),month.getMonth()+n,1);renderCalendar()}function showToday(){if(!requireMember())return;month=new Date(now.getFullYear(),now.getMonth(),1);selected=today;renderCalendar()}
function editRecord(id){if(!requireMember())return;if(globalThis.chagokAuth?.configured&&!globalThis.chagokAuth.ready){toast('로그인 상태를 확인하고 있어요. 잠시 후 다시 시도해주세요.');return;}const r=state.records.find(r=>r.id===id)||{date:selected,type:'우롱차',visibility:'private'};openModal(id?'차 기록 살펴보기':'오늘의 차를 기록해요',`<form id="record-form"><p id="record-error" class="form-error" role="alert"></p><div class="form-row"><label class="field">마신 날짜<input name="date" type="date" value="${r.date}" required></label><label class="field">차 종류<select name="type">${['보이차','우롱차','홍차'].map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}</select></label></div><label class="field">차 이름<input name="name" placeholder="차 이름을 입력해주세요" maxlength="80" value="${esc(r.name||'')}" required></label><label class="field">오늘의 감상<textarea name="note" maxlength="3000" placeholder="향, 맛, 오늘의 기분. 편하게 남겨주세요.">${esc(r.note||'')}</textarea></label><details><summary>우리는 방법도 남기기</summary><div><label class="field">생산지 · 생산자<input name="origin" maxlength="100" value="${esc(r.origin||'')}" placeholder="생산지 또는 생산자"></label><div class="form-row"><label class="field">찻잎 (g)<input name="amount" type="number" min="0" max="1000" step="0.1" value="${esc(r.amount||'')}"></label><label class="field">물 (ml)<input name="water" type="number" min="0" max="10000" value="${esc(r.water||'')}"></label></div><label class="field">물 온도 (°C)<input name="temp" type="number" min="0" max="100" value="${esc(r.temp||'')}"></label></div></details><input type="hidden" name="visibility" value="private"><p class="sub">이 기록은 나만 볼 수 있어요. 저장한 기록은 별도의 게시글로 공유할 수 있어요.</p><div class="sub">보이차·우롱차·홍차를 기록해요. 가향차와 대용차는 다루지 않아요.</div><div class="form-actions">${id?`<button type="button" class="small-btn" onclick="shareRecord('${id}')">커뮤니티에 공유</button><button type="button" class="danger" onclick="deleteRecord('${id}')">삭제</button>`:''}<button type="button" class="small-btn" onclick="closeModal()">취소</button><button class="primary" type="submit">기록 저장</button></div></form>`);$('#record-form').onsubmit=async e=>{e.preventDefault();if(!requireMember())return;const data=Object.fromEntries(new FormData(e.target));data.name=data.name.trim();if(!data.name)return toast('차 이름을 입력해주세요.');const record={...data,id:id||'r-'+crypto.randomUUID(),author:nickname(),authorUid:currentUser.uid,sample:false};const next=draftState();if(id)next.records=next.records.map(x=>x.id===id?record:x);else next.records.push(record);const ok=await commitState(next);if(ok){selected=data.date;month=new Date(data.date+'T12:00:00');month.setDate(1);closeModal();render();toast('차생활을 서버에 저장했어요.');}}}
function deleteRecord(id){if(!requireMember())return;openModal('이 기록을 삭제할까요?',`<p class="sub">삭제한 기록은 되돌릴 수 없어요.</p><div class="form-actions"><button class="small-btn" onclick="editRecord('${id}')">돌아가기</button><button class="primary" onclick="confirmDelete('${id}')">삭제하기</button></div>`)}

function renderEvents(){if(!requireMember())return;$('#app').innerHTML=head('함께하는 찻자리','같은 시간, 서로 다른 잔에 담는 이야기.')+'<div class="empty">예정된 이벤트가 없어요. 새 찻자리가 열리면 이곳에서 안내할게요.</div>'}
$('#login').onclick=()=>currentUser?showProfile():startGoogleLogin();
$('#profile').onclick=showProfile;
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal()}});
if(document.modelContext?.registerTool){try{document.modelContext.registerTool({name:'start_tea_record',description:'Open the tea record form for a valid date; does not save a record.',inputSchema:{type:'object',properties:{date:{type:'string',pattern:'^\\d{4}-\\d{2}-\\d{2}$'}},required:['date'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!isMember())throw new Error('Sign in and set a nickname first');if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||Number.isNaN(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date)throw new Error('Invalid date');selected=input.date;editRecord();return {opened:true,date:selected}}})}catch{}}
render();

function authMessage(code){return ({'auth/invalid-api-key':'구글 로그인 설정의 API 키가 올바르지 않아요. 운영자에게 알려주세요.','auth/api-key-not-valid.-please-pass-a-valid-api-key.':'구글 로그인 설정의 API 키가 올바르지 않아요. 운영자에게 알려주세요.','app/not-configured':'구글 로그인 설정을 준비하고 있어요.','app/not-ready':'로그인 연결을 확인하고 있어요. 잠시 후 다시 시도해주세요.','app/https-required':'구글 로그인은 게시된 웹사이트에서 이용해주세요.','auth/popup-blocked':'브라우저에서 팝업을 허용한 뒤 다시 로그인해주세요.','auth/popup-closed-by-user':'로그인을 취소했어요.','auth/cancelled-popup-request':'이미 로그인 창이 열려 있어요.','auth/unauthorized-domain':'현재 사이트 주소의 로그인 허용 설정이 필요해요.','auth/operation-not-allowed':'구글 로그인 사용 설정이 필요해요.','auth/network-request-failed':'인터넷 연결을 확인하고 다시 시도해주세요.'})[code]||'로그인 연결에 실패했어요. 새로고침한 뒤 다시 시도해주세요.'}
function startGoogleLogin(){const a=globalThis.chagokAuth;if(!a?.configured){openModal('구글 로그인','<p>구글 로그인 설정을 준비하고 있어요.</p><p class="sub">설정이 완료되면 Google 계정으로 시작할 수 있어요.</p>');return;}if(a.error){toast(authMessage(a.error));return;}a.signIn().catch(e=>toast(authMessage(e.code)))}
async function logoutGoogle(){try{await globalThis.chagokAuth.signOut();toast('로그아웃했어요.')}catch(e){toast(authMessage(e.code))}}
if(typeof window!=='undefined'){window.addEventListener('chagok-auth-change',updateAuthUI);updateAuthUI();}



function nickname(){return typeof state.nickname==='string'?state.nickname:''}
function validNickname(value){return /^[가-힣a-zA-Z0-9_]{2,16}$/.test(value)}
function isMember(){const a=globalThis.chagokAuth;return !!(a?.ready&&!a.error&&currentUser&&a.user?.uid===currentUser.uid&&cloud.uid===currentUser.uid&&['ready','saving'].includes(cloud.phase)&&validNickname(nickname()))}
function requireMember(){if(cloud.phase==='saving'){toast('서버에 저장 중이에요. 잠시 기다려주세요.');return false;}if(isMember())return true;closeModal();renderGate();return false}
function renderGate(){
 document.body?.classList.add('membership-locked');
 const a=globalThis.chagokAuth;
 const loading=a?.configured&&!a.ready;
 $('#breadcrumb').textContent='차곡 by 바라티';
 if(currentUser&&a?.ready&&!a.error){if(cloud.phase!=='ready'){showCloudGate();return;}renderNicknameSetup();return;}
 $('#app').innerHTML=`<section class="access-card"><div class="eyebrow">차곡 by 바라티</div><h1>차 한 잔의 기록,<br>함께 나누는 차생활.</h1><p>보이차 · 우롱차 · 홍차</p><p class="sub">차생활 기록과 커뮤니티는 로그인 후 이용할 수 있어요.</p><button class="primary" ${loading?'disabled':''} onclick="startGoogleLogin()">${loading?'로그인 상태 확인 중…':'Google 계정으로 시작하기'}</button>${a?.error?`<p class="form-error" role="alert">${esc(authMessage(a.error))}</p>`:''}</section>`;
}
function renderNicknameSetup(editing=false){
 if(!currentUser){renderGate();return;}
 const body=`<p class="sub">기록과 댓글에 표시할 이름을 정해주세요. 구글 계정 이름은 커뮤니티에 표시하지 않아요.</p><form id="nickname-form"><label class="field">닉네임<input name="nickname" value="${esc(nickname())}" autocomplete="nickname" minlength="2" maxlength="16" pattern="[가-힣a-zA-Z0-9_]{2,16}" required aria-describedby="nickname-help" placeholder="사용할 닉네임"></label><p id="nickname-help" class="sub">한글, 영문, 숫자, 밑줄(_)로 2~16자 · 중복 사용 가능</p><p id="nickname-error" class="form-error" role="alert"></p><div class="form-actions"><button class="primary" id="save-nickname" type="submit">${editing?'닉네임 저장':'저장하고 시작하기'}</button></div></form>`;
 if(editing)openModal('닉네임 변경',body);
 else $('#app').innerHTML=`<section class="access-card"><div class="eyebrow">차곡 by 바라티</div><h1>어떤 이름으로 만날까요?</h1>${body}<button class="text-button" onclick="logoutGoogle()">다른 계정으로 로그인</button></section>`;
 const uid=currentUser.uid;
 $('#nickname-form').onsubmit=async e=>{e.preventDefault();await saveNickname(new FormData(e.target).get('nickname'),uid)};
}
function showProfile(){
 if(!requireMember())return;
 openModal('나의 찻자리',`<h3>${esc(nickname())}</h3><p id="server-check" role="status" class="sub"></p><p class="sub">내 기록 ${state.records.length}개 · 저장한 기록 ${state.saved.length}개</p><div class="notice">닉네임과 차 기록은 내 계정에 저장돼요. 다른 기기에서도 로그인하면 불러올 수 있어요. 커뮤니티에 게시한 글은 다른 회원도 볼 수 있어요.</div><div class="form-actions"><button class="small-btn" onclick="verifyServerData()">서버 저장 확인</button><button class="small-btn" onclick="closeModal();loadAccount()">서버 기록 다시 불러오기</button><button class="small-btn" onclick="renderNicknameSetup(true)">닉네임 변경</button><button class="small-btn" onclick="closeModal();filter='저장한 기록';go('feed')">저장한 기록</button><button class="primary" onclick="logoutGoogle()">로그아웃</button></div>`);
}
function cloudError(code){return ({'permission-denied':'데이터베이스 접근 규칙을 확인해주세요. 본인 계정의 저장 권한이 필요해요.','unavailable':'서버에 연결할 수 없어요. 인터넷 연결을 확인해주세요.','not-found':'데이터베이스가 아직 준비되지 않았어요.','app/conflict':'다른 기기에서 먼저 수정했어요. 서버 기록을 다시 불러온 후 수정해주세요.','app/account-changed':'계정이 변경되어 작업을 중단했어요.','app/storage-limit':'저장할 정보가 너무 커요. 기록을 정리한 뒤 다시 시도해주세요.','app/invalid-data':'저장된 데이터 형식을 확인해야 해요.'})[code]||'서버 작업을 완료하지 못했어요. 잠시 후 다시 시도해주세요.'}
function updateSyncStatus(){const el=$('#sync-status');if(el)el.textContent=cloud.phase==='loading'?'내 정보 불러오는 중…':cloud.phase==='saving'?'서버에 저장 중…':cloud.error?'저장 오류':cloud.phase==='ready'?'서버 연결됨':'';}
async function loadAccount(){
 const uid=currentUser?.uid;if(!uid)return;
 const version=++cloudGeneration;cloud={uid,phase:'loading',revision:null,error:null};state=JSON.parse(JSON.stringify(defaults));closeModal();renderGate();updateSyncStatus();
 try{
  let seed={};try{seed=JSON.parse(localStorage.getItem('chagok-user-'+uid))||{}}catch{}
  const store=await globalThis.chagokAuth.getStore();const result=await store.load(uid,seed);
  if(version!==cloudGeneration||currentUser?.uid!==uid)return;
  state={...JSON.parse(JSON.stringify(defaults)),...result.state};cloud={uid,phase:'ready',revision:result.revision,error:null};page='calendar';filter='전체';updateAuthUI();
 }catch(error){if(version!==cloudGeneration||currentUser?.uid!==uid)return;cloud={uid,phase:'error',revision:null,error:error.code||'unknown'};renderGate();updateSyncStatus();}
}
async function commitState(next){
 const uid=currentUser?.uid;if(!uid||globalThis.chagokAuth?.user?.uid!==uid||cloud.phase!=='ready')return false;
 const generation=cloudGeneration,revision=cloud.revision;
 cloud.phase='saving';cloud.error=null;updateSyncStatus();
 try{
  const store=await globalThis.chagokAuth.getStore();const result=await store.save(uid,next,revision);
  if(currentUser?.uid!==uid||generation!==cloudGeneration)return false;
  state={...JSON.parse(JSON.stringify(defaults)),...result.state};cloud={uid,phase:'ready',revision:result.revision,error:null};updateSyncStatus();return true;
 }catch(error){
  if(currentUser?.uid!==uid||generation!==cloudGeneration)return false;
  cloud.phase='ready';cloud.error=error.code||'unknown';updateSyncStatus();toast(cloudError(cloud.error));
  const inline=$('#record-error')||$('#comment-error');if(inline)inline.textContent=cloudError(cloud.error);
  return false;
 }
}
function draftState(){return JSON.parse(JSON.stringify(state))}
function showCloudGate(){
 const loading=cloud.phase==='loading';
 $('#app').innerHTML=`<section class="access-card"><div class="eyebrow">차곡 by 바라티</div><h1>${loading?'내 찻자리를 불러와요':'내 정보를 불러오지 못했어요'}</h1><p class="sub">${loading?'닉네임과 차 기록을 서버에서 확인하고 있어요.':esc(cloudError(cloud.error))}</p>${loading?'':'<button class="primary" onclick="loadAccount()">다시 불러오기</button>'}<button class="text-button" onclick="logoutGoogle()">로그아웃</button></section>`;
}
async function saveNickname(value,uid){
 if(!currentUser||currentUser.uid!==uid||globalThis.chagokAuth?.user?.uid!==uid||cloud.phase!=='ready')return false;
 value=String(value||'').trim().normalize('NFC');
 if(!validNickname(value)){$('#nickname-error').textContent='한글, 영문, 숫자, 밑줄로 2~16자를 입력해주세요.';return false;}
 const button=$('#save-nickname');button.disabled=true;button.textContent='저장 중…';
 const next=draftState();next.nickname=value;const ok=await commitState(next);
 if(currentUser?.uid!==uid)return false;
 if(ok){closeModal();updateAuthUI();toast('닉네임을 서버에 저장했어요.');}
 else if($('#nickname-error'))$('#nickname-error').textContent=cloudError(cloud.error);
 if($('#save-nickname')){$('#save-nickname').disabled=false;$('#save-nickname').textContent='닉네임 저장';}
 return ok;
}
async function confirmDelete(id){if(!requireMember())return;const next=draftState();next.records=next.records.filter(r=>r.id!==id);delete next.comments[id];next.likes=next.likes.filter(x=>x!==id);next.saved=next.saved.filter(x=>x!==id);if(await commitState(next)){closeModal();render();toast('기록을 삭제했어요.')}}
function updateAuthUI(){
 const a=globalThis.chagokAuth,user=a?.user||null;const changed=(currentUser?.uid||null)!==(user?.uid||null);
 if(changed){globalThis.resetCommunity?.();++cloudGeneration;closeModal();state=JSON.parse(JSON.stringify(defaults));cloud={uid:null,phase:'idle',revision:null,error:null};filter='전체';page='calendar';}
 currentUser=user;const adminButton=$('[data-page=admin]');if(adminButton)adminButton.hidden=!user?.isAdmin;storageKey=user?'chagok-user-'+user.uid:'chagok-v1';
 $('#login').textContent=user?'내 계정':a?.configured&&!a.ready?'로그인 확인 중…':'Google 로그인 ↗';
 $('#profile b').textContent=user?(nickname()||'내 계정'):'로그인이 필요해요';
 $('#profile .avatar').textContent=(user&&nickname()?nickname():'茶').slice(0,1);
 $('#profile small').textContent=user?'서버에 저장되는 차생활':'Google로 시작하기';
 document.body?.classList.toggle('membership-locked',!isMember());updateSyncStatus();
 if(user&&a?.ready&&!a.error&&(changed||cloud.uid!==user.uid)){void loadAccount();return;}
 if(isMember()){go(page);globalThis.startCommunity?.();}else renderGate();
}

async function verifyServerData(){
 if(!requireMember())return false;const uid=currentUser.uid,generation=cloudGeneration;
 const message=$('#server-check');if(message)message.textContent='서버에서 다시 읽어 확인하고 있어요…';
 try{
  const store=await globalThis.chagokAuth.getStore();const remote=await store.load(uid);
  if(generation!==cloudGeneration||currentUser?.uid!==uid)return false;
  const same=remote.revision===cloud.revision&&Object.keys(defaults).every(key=>JSON.stringify(remote.state[key])===JSON.stringify(state[key]));
  const result=same?'서버 저장 확인 완료 · 닉네임과 내 기록 '+state.records.length+'개가 일치해요.':'서버에 다른 변경이 있어요. 서버 기록을 다시 불러와주세요.';
  if($('#server-check'))$('#server-check').textContent=result;toast(result);return same;
 }catch(error){if(generation===cloudGeneration&&$('#server-check'))$('#server-check').textContent=cloudError(error.code);return false;}
}
