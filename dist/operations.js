'use strict';
let searchTerm='',feedLimit=24;
function matchingPosts(items){const q=searchTerm.trim().toLocaleLowerCase();return q?items.filter(p=>[p.name,p.note,p.author].some(v=>String(v||'').toLocaleLowerCase().includes(q))):items;}
function searchControls(){return `<form id="post-search" class="search-bar" role="search"><label class="sr-only" for="search-term">게시글 검색</label><input id="search-term" name="query" type="search" maxlength="100" value="${esc(searchTerm)}" placeholder="제목, 내용, 닉네임으로 검색"><button class="small-btn" type="submit">검색</button>${searchTerm?'<button class="small-btn" type="button" onclick="clearSearch()">초기화</button>':''}</form>`;}
function bindSearch(){const form=$('#post-search');if(form)form.onsubmit=e=>{e.preventDefault();searchTerm=new FormData(form).get('query').trim();feedLimit=24;refreshCommunityView();};}
function clearSearch(){searchTerm='';feedLimit=24;refreshCommunityView();}
function morePosts(items){const count=matchingPosts(items).length;return `<p class="sub result-count" role="status">${count}개의 글${searchTerm?' · 검색 결과':''}</p>${count>feedLimit?'<button class="small-btn load-more" onclick="feedLimit+=24;refreshCommunityView()">글 더 보기</button>':''}`;}
function reportPost(id){
 if(!requireMember())return;const p=posts().find(p=>p.id===id);if(!p||p.authorUid===currentUser.uid)return;
 openModal('게시글 신고',`<p>${esc(p.name)}</p><p class="sub">신고 내용은 관리자만 확인해요. 게시글은 검토 후 조치해요.</p><form id="report-form"><label class="field">신고 사유<select name="reason">${['주제와 무관한 글','광고·도배','욕설·괴롭힘','개인정보 노출','기타'].map(r=>`<option>${r}</option>`).join('')}</select></label><p id="community-error" role="alert" class="form-error"></p><div class="form-actions"><button class="small-btn" type="button" onclick="closeModal()">취소</button><button class="primary" type="submit">신고 접수</button></div></form>`);
 const version=modalVersion,uid=currentUser.uid;$('#report-form').onsubmit=async e=>{e.preventDefault();const reason=new FormData(e.target).get('reason');if(await communityAction(api=>api.report(uid,id,reason),e.target)){if(version===modalVersion){closeModal();toast('신고를 접수했어요. 운영자가 확인할게요.');}}};
}
const adminWithPosts=renderAdmin;renderAdmin=function(){
 adminWithPosts();if(!isAdmin())return;
 const html=community.reportsPhase==='error'?'<p role="alert">신고 목록을 불러오지 못했어요. <button class="small-btn" onclick="retryCommunity()">다시 시도</button></p>':community.reportsPhase==='loading'?'<p role="status">신고를 불러오는 중…</p>':community.reports.map(r=>{const p=community.items.find(p=>p.id===r.postId);return `<div class="list-item"><div><h3>${esc(p?.name||'삭제되었거나 불러오지 못한 글')}</h3><p>${esc(r.reason)}</p><p class="post-note">${esc(p?.note||'')}</p></div><div class="report-actions">${p&&!p.deleted?`<button class="small-btn" onclick="moderate(${jsArg(p.id)})">${p.hidden?'다시 공개':'글 숨기기'}</button>`:''}<button class="small-btn" onclick="resolveReport(${jsArg(r.postId)},${jsArg(r.reporterUid)})">검토 완료</button></div></div>`;}).join('')||'<p class="empty">검토할 신고가 없어요.</p>';
 $('#app').insertAdjacentHTML('beforeend',`<section class="report-section"><h2>접수된 신고</h2>${html}</section>`);
};
async function resolveReport(postId,uid){if(isAdmin()&&await communityAction(api=>api.resolveReport(currentUser.uid,postId,uid)))toast('검토 완료로 표시했어요.');}
function exportRecords(){
 if(!requireMember())return;
 const snapshot={site:'차곡 by 바라티',exportedAt:new Date().toISOString(),nickname:nickname(),records:draftState().records};
 const content=JSON.stringify(snapshot,null,2),blob=new Blob([content],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob);
 openModal('내 기록 내보내기',`<p class="sub">닉네임과 차 기록을 JSON 파일로 저장해요. 사진 파일은 포함되지 않아요.</p><a class="primary" href="${url}" download="차곡-내기록-${fmt(new Date())}.json">JSON 파일 저장</a><details><summary>다운로드가 안 되면 내용 복사</summary><label class="field">내 기록 데이터<textarea readonly rows="8">${esc(content)}</textarea></label></details>`);
 setTimeout(()=>URL.revokeObjectURL(url),300000);
}
function showGuide(){
 openModal('차곡 이용 안내',`<div class="guide-content"><p>차곡 by 바라티는 중국·대만·홍콩의 차문화에서 즐기는 보이차·우롱차·홍차를 기록하고 나누는 공간이에요. 가향차와 대용차는 다루지 않아요.</p><h3>기록과 공개 범위</h3><p>Google 로그인 후 닉네임을 설정하면 이용할 수 있어요. ‘나만 보기’ 기록과 사진은 본인만 읽을 수 있고, ‘게시판에 공개’를 선택하면 로그인한 회원들이 차 이름·감상·사진을 볼 수 있어요. 공개 기록을 수정하면 게시글도 함께 바뀌어요. 다시 비공개로 저장하면 게시글이 내려가요.</p><h3>함께 지키는 약속</h3><p>서로의 취향을 존중해주세요. 광고·도배·괴롭힘·타인의 개인정보 노출은 신고할 수 있어요. 직접 촬영했거나 공유할 권한이 있는 사진을 올려주세요. 운영자는 신고를 검토하고 게시글을 숨길 수 있어요.</p><h3>내 정보 관리</h3><p>닉네임과 기록은 계정에 저장돼요. 구글 계정의 이름과 이메일은 게시글에 표시하지 않아요. 사진은 저장 전에 크기를 줄이고 위치 등 원본 메타데이터를 제거해요. 내 계정에서 닉네임을 바꾸고 기록을 JSON 파일로 내보낼 수 있어요. 내보내기에는 사진 파일이 포함되지 않아요.</p><h3>이벤트</h3><p>이벤트는 관리자만 등록해요. 참여 방법과 장소·시간은 각 이벤트의 안내를 확인해주세요.</p></div>`);
}
