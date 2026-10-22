'use strict';
// Member restrictions and account withdrawal.
const startWithoutMembers=startCommunity;startCommunity=async function(){
 await startWithoutMembers();if(!isMember()||community.uid!==currentUser.uid||community.memberWatch)return;
 const session=community,uid=currentUser.uid;session.memberWatch=true;
 try{const api=await chagokAuth.getCommunity();if(session!==community)return;
  session.stops.push(api.watchBan(uid,ban=>{if(session!==community)return;session.ban=ban;refreshNotices();},()=>{}));
  if(isAdmin())session.stops.push(api.watchBans(uid,items=>{if(session!==community)return;session.bans=items;if(page==='admin')renderAdmin();},()=>{}));
 }catch{}
};
const noticesWithoutBan=refreshNotices;refreshNotices=function(){
 noticesWithoutBan();document.querySelector('#ban-notice')?.remove();
 if(isMember()&&community.ban)$('#app').insertAdjacentHTML('afterbegin','<div id="ban-notice" class="notice warning" role="alert">운영 정책에 따라 글쓰기·댓글·신고가 제한된 계정이에요. 내 기록은 계속 남길 수 있어요. 문의는 이용 안내의 운영자 연락처로 보내주세요.</div>');
};
const cloudErrorWithoutBan=cloudError;cloudError=function(code){return code==='permission-denied'&&community.ban?'운영 정책에 따라 글쓰기·댓글·신고가 제한된 계정이에요.':cloudErrorWithoutBan(code);};
function banMember(target){
 if(!isAdmin()||target===currentUser.uid)return;const theirs=community.items.filter(p=>p.authorUid===target&&!p.deleted),name=newest(theirs)[0]?.author||'';
 openModal('이용 제한',`<p>${esc(name||'이 회원')}</p><p class="sub">제한된 회원은 글쓰기·댓글·신고를 할 수 없어요. 개인 기록은 계속 이용할 수 있어요.</p><form id="ban-form"><label class="field">제한 사유 (관리자만 확인)<input name="reason" required maxlength="200" placeholder="예: 반복적인 광고 게시"></label><label class="consent"><input type="checkbox" name="hide" checked> 이 회원의 공개 글 ${theirs.filter(p=>!p.hidden).length}개도 모두 숨기기</label><p id="community-error" class="form-error" role="alert"></p><div class="form-actions"><button class="small-btn" type="button" onclick="closeModal()">취소</button><button class="primary" type="submit">이용 제한</button></div></form>`);
 const version=modalVersion;$('#ban-form').onsubmit=async e=>{e.preventDefault();const data=new FormData(e.target),reason=data.get('reason').trim();if(!reason)return;
  const hide=data.get('hide')?theirs.filter(p=>!p.hidden):[];
  if(await communityAction(api=>api.ban(currentUser.uid,target,name,reason,hide),e.target)){if(version===modalVersion)closeModal();toast('이용을 제한했어요.');}};
}
async function unbanMember(target){if(isAdmin()&&await communityAction(api=>api.unban(currentUser.uid,target)))toast('이용 제한을 해제했어요.');}
const adminWithoutBans=renderAdmin;renderAdmin=function(){
 adminWithoutBans();if(!isAdmin())return;const bans=newest(community.bans||[]);
 $('#app').insertAdjacentHTML('beforeend',`<section class="report-section"><h2>이용 제한 회원</h2>${bans.map(b=>`<div class="list-item"><div><h3>${esc(b.nickname||'닉네임 없음')}</h3><p>${esc(b.reason)} · ${b.createdAt?.seconds?new Date(b.createdAt.seconds*1000).toLocaleDateString('ko-KR'):'방금'}</p></div><button class="small-btn" onclick="unbanMember(${jsArg(b.id)})">제한 해제</button></div>`).join('')||'<p class="empty">이용 제한된 회원이 없어요.</p>'}</section>`);
};
function askWithdraw(){
 if(!requireMember())return;
 openModal('회원 탈퇴',`<p class="sub">탈퇴하면 아래 정보가 삭제되고 되돌릴 수 없어요.</p><ul class="guide-list"><li>닉네임, 차 기록 ${state.records.length}개, 기록 사진, 저장 목록</li><li>내가 쓴 게시글과 첨부 사진, 내가 쓴 댓글</li><li>Google 로그인 연결</li></ul><p class="sub">필요하면 먼저 ‘내 기록 내보내기’로 기록을 저장해주세요. 신고·이용 제한 처리 기록은 운영을 위해 보관해요.</p><label class="consent"><input type="checkbox" id="withdraw-confirm"> 안내를 확인했고 탈퇴할게요.</label><p id="withdraw-error" class="form-error" role="alert"></p><div class="form-actions"><button class="small-btn" onclick="showProfile()">돌아가기</button><button class="primary danger-fill" id="withdraw-start" onclick="withdraw()">Google 계정 확인 후 탈퇴</button></div>`);
}
async function withdraw(){
 if(!requireMember())return;const uid=currentUser.uid,button=$('#withdraw-start'),error=$('#withdraw-error');
 if(!$('#withdraw-confirm').checked){error.textContent='안내를 확인하고 체크해주세요.';return;}
 button.disabled=true;error.textContent='';let accountDeleted=false;
 try{
  // Keep the popup inside the click gesture, before any other await.
  await chagokAuth.reauthenticate();if(currentUser?.uid!==uid)return;
  button.textContent='탈퇴 처리 중…';
  const api=await chagokAuth.getCommunity();await api.removeMemberContent(uid);
  const store=await chagokAuth.getStore();await store.deleteAccount(uid);accountDeleted=true;
  try{localStorage.removeItem('chagok-user-'+uid)}catch{}
  await chagokAuth.deleteAccount();toast('탈퇴를 완료했어요. 그동안 차곡과 함께해주셔서 고마워요.');
 }catch(e){
  if(accountDeleted){await logoutGoogle();toast('기록은 삭제했지만 Google 연결 해제를 마치지 못했어요. 다시 로그인한 뒤 탈퇴를 한 번 더 진행해주세요.');return;}
  if(currentUser?.uid!==uid||!$('#withdraw-start'))return;
  button.disabled=false;button.textContent='Google 계정 확인 후 탈퇴';
  error.textContent=e.code==='auth/user-mismatch'?'지금 로그인한 계정과 같은 Google 계정을 선택해주세요.':e.code?.startsWith('auth/')?authMessage(e.code):cloudError(e.code);
 }
}
