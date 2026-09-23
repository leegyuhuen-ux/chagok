'use strict';
function eventMillis(value){return value?.toMillis?value.toMillis():(value?.seconds||0)*1000;}
function eventInput(value){return new Date(eventMillis(value)+9*60*60*1000).toISOString().slice(0,16);}
function eventTime(value){return new Date(eventMillis(value)).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'long',day:'numeric',weekday:'short',hour:'2-digit',minute:'2-digit'});}
function eventLabel(e){return e.status==='draft'?'작성 중':e.status==='cancelled'?'취소됨':eventMillis(e.endsAt)<Date.now()?'종료':'예정';}
function renderEvents(){
 if(!requireMember())return;
 const items=[...(community.events||[])].filter(e=>isAdmin()||e.status!=='draft').sort((a,b)=>{
  const pastA=eventMillis(a.endsAt)<Date.now(),pastB=eventMillis(b.endsAt)<Date.now();return Number(pastA)-Number(pastB)||(pastA?-1:1)*(eventMillis(a.startsAt)-eventMillis(b.startsAt));
 });
 $('#app').innerHTML=head('함께하는 찻자리','차를 나누는 약속, 이곳에서 만나요.',isAdmin()?'<button class="primary" onclick="editEvent()">＋ 이벤트 만들기</button>':'')+
 (community.eventsPhase==='error'?'<div class="notice" role="alert">이벤트를 불러오지 못했어요. <button class="small-btn" onclick="retryCommunity()">다시 시도</button></div>':community.eventsPhase!=='ready'?'<p class="empty" role="status">이벤트를 불러오고 있어요…</p>':'')+
 `<div class="event-list">${items.map(e=>`<article class="event-card"><span class="event-badge ${e.status}">${eventLabel(e)}</span><h2>${esc(e.title)}</h2><dl><div><dt>시작</dt><dd>${esc(eventTime(e.startsAt))}</dd></div><div><dt>종료</dt><dd>${esc(eventTime(e.endsAt))}</dd></div><div><dt>장소</dt><dd>${esc(e.venue||'추후 안내')}</dd></div></dl><p class="post-note">${esc(e.description)}</p>${isAdmin()?`<div class="card-actions"><button class="small-btn" onclick="editEvent(${jsArg(e.id)})">이벤트 수정</button><button class="danger" onclick="askDeleteEvent(${jsArg(e.id)})">이벤트 삭제</button></div>`:''}</article>`).join('')||(community.eventsPhase==='ready'?'<div class="empty">예정된 이벤트가 없어요. 새 찻자리가 열리면 이곳에서 안내할게요.</div>':'')}</div><p class="sub">이벤트 시간은 한국 시간 기준이에요.</p>`;refreshNotices();
}
function editEvent(id=null){
 if(!requireMember()||!isAdmin())return;
 const e=id?community.events.find(e=>e.id===id):{title:'',description:'',venue:'',status:'draft',startsAt:{seconds:Math.ceil((Date.now()+86400000)/3600000)*3600},endsAt:{seconds:Math.ceil((Date.now()+90000000)/3600000)*3600}};
 if(!e)return;closeModal();openModal(id?'이벤트 수정':'새로운 찻자리',`<form id="event-form"><label class="field">이벤트 이름<input name="title" maxlength="80" required value="${esc(e.title)}"></label><div class="form-row"><label class="field">시작 시간 (한국 시간)<input name="startsAt" type="datetime-local" required value="${eventInput(e.startsAt)}"></label><label class="field">종료 시간 (한국 시간)<input name="endsAt" type="datetime-local" required value="${eventInput(e.endsAt)}"></label></div><label class="field">장소<input name="venue" maxlength="100" value="${esc(e.venue)}" placeholder="장소 또는 온라인 모임 안내"></label><label class="field">이벤트 안내<textarea name="description" maxlength="2000" required>${esc(e.description)}</textarea></label><label class="field">공개 상태<select name="status"><option value="draft" ${e.status==='draft'?'selected':''}>작성 중 · 관리자만 보기</option><option value="published" ${e.status==='published'?'selected':''}>공개 · 모든 회원에게 안내</option><option value="cancelled" ${e.status==='cancelled'?'selected':''}>취소 · 취소 안내 표시</option></select></label><p id="community-error" class="form-error" role="alert"></p><div class="form-actions"><button type="button" class="small-btn" onclick="closeModal()">닫기</button><button type="submit" class="primary">이벤트 저장</button></div></form>`);
 const version=modalVersion;$('#event-form').onsubmit=async action=>{
  action.preventDefault();if(!isAdmin())return;const data=Object.fromEntries(new FormData(action.target));
  data.startsAt=new Date(data.startsAt+':00+09:00');data.endsAt=new Date(data.endsAt+':00+09:00');
  if(!data.title.trim()||!data.description.trim()){$('#community-error').textContent='이벤트 이름과 안내를 입력해주세요.';return;}
  if(!Number.isFinite(data.startsAt.getTime())||!Number.isFinite(data.endsAt.getTime())||data.endsAt<=data.startsAt){$('#community-error').textContent='종료 시간은 시작 시간보다 늦게 설정해주세요.';return;}
  if(await communityAction(api=>api.saveEvent(currentUser.uid,data,id,e.revision),action.target)){if(version===modalVersion){closeModal();go('events');toast('이벤트를 저장했어요.');}}
 };
}
function askDeleteEvent(id){if(!requireMember()||!isAdmin())return;const e=community.events.find(e=>e.id===id);if(!e)return;closeModal();openModal('이벤트를 삭제할까요?',`<p class="sub">${esc(e.title)}<br>삭제하면 회원 화면에서도 사라져요.</p><p id="community-error" class="form-error" role="alert"></p><div class="form-actions"><button class="small-btn" onclick="closeModal()">돌아가기</button><button class="primary" onclick="deleteSharedEvent(${jsArg(id)},${e.revision})">삭제하기</button></div>`);}
async function deleteSharedEvent(id,revision){if(!isAdmin())return;const version=modalVersion;if(await communityAction(api=>api.deleteEvent(currentUser.uid,id,revision))){if(version===modalVersion)closeModal();toast('이벤트를 삭제했어요.');}}
