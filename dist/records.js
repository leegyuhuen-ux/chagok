'use strict';
async function editRecord(id){
 if(!requireMember())return;
 const r=state.records.find(r=>r.id===id)||{id:'r-'+crypto.randomUUID(),date:selected,type:'보이차',visibility:'private'};
 const uid=currentUser.uid;let assets={photos:[],postRevision:null,postDeleted:false,postHidden:false};
 closeModal();
 if(r.photoCount||r.sharedPostId){
  openModal('기록 불러오기','<p role="status">기록의 사진과 공개 상태를 확인하고 있어요…</p>');const loadingVersion=modalVersion;
  try{const store=await chagokAuth.getStore();assets=await store.loadRecordAssets(uid,r);if(loadingVersion!==modalVersion||uid!==currentUser?.uid)return;}
  catch(error){if(loadingVersion===modalVersion)openModal('기록을 불러오지 못했어요',`<p>${esc(cloudError(error.code))}</p><button class="primary" onclick="editRecord(${jsArg(id)})">다시 시도</button>`);return;}
 }
 const isPublic=!!r.sharedPostId&&!assets.postDeleted;
 openModal(id?'차 기록 수정':'오늘의 차를 기록해요',`<form id="record-form"><div class="form-row"><label class="field">마신 날짜<input name="date" type="date" value="${esc(r.date)}" required></label><label class="field">차 종류<select name="type">${teaTypes.map(t=>`<option ${r.type===t?'selected':''}>${t}</option>`).join('')}</select></label></div><label class="field">차 이름<input name="name" maxlength="80" value="${esc(r.name||'')}" required placeholder="차 이름을 입력해주세요"></label><label class="field">오늘의 감상<textarea name="note" maxlength="3000" placeholder="향과 맛, 오늘의 기분을 남겨주세요.">${esc(r.note||'')}</textarea></label><div id="record-photo-editor"></div><fieldset class="visibility-choice"><legend>공개 범위</legend><label><input type="radio" name="visibility" value="private" ${!isPublic?'checked':''}><span>나만 보기</span></label><label><input type="radio" name="visibility" value="public" ${isPublic?'checked':''}><span>게시판에 공개</span></label></fieldset><p id="visibility-help" class="sub" role="status"></p>${assets.postHidden&&!assets.postDeleted?'<p class="notice">관리자가 숨긴 게시글이에요. 기록을 수정해도 게시판에는 표시되지 않아요.</p>':''}<details><summary>우리는 방법도 남기기</summary><label class="field">생산지 · 생산자<input name="origin" maxlength="100" value="${esc(r.origin||'')}"></label><div class="form-row"><label class="field">찻잎 (g)<input name="amount" type="number" min="0" max="1000" step="0.1" value="${esc(r.amount||'')}"></label><label class="field">물 (ml)<input name="water" type="number" min="0" max="10000" value="${esc(r.water||'')}"></label></div><label class="field">물 온도 (°C)<input name="temp" type="number" min="0" max="100" value="${esc(r.temp||'')}"></label></details><p class="sub">보이차·우롱차·홍차·녹차를 기록해요. 가향차와 대용차는 다루지 않아요.</p><p id="record-error" class="form-error" role="alert"></p><div class="form-actions">${id?`<button type="button" class="danger" onclick="deleteRecord(${jsArg(id)})">기록 삭제</button>`:''}<button type="button" class="small-btn" onclick="closeModal()">취소</button><button type="submit" class="primary" id="record-save">기록 저장</button></div></form>`);
 const version=modalVersion,form=$('#record-form');
 const photoEditor=ChagokPhotos.editor($('#record-photo-editor'),assets.photos,busy=>{if(version===modalVersion)$('#record-save').disabled=busy;});
 function selection(){const publish=form.elements.visibility.value==='public';$('#record-save').textContent=publish?'저장하고 공개':'기록 저장';$('#visibility-help').textContent=publish?'저장하면 차 이름·감상·사진이 차생활 게시판에 바로 등록돼요.':'기록과 사진은 본인만 볼 수 있어요.';if(isPublic&&!publish)$('#visibility-help').textContent+=' 저장하면 연결된 게시글도 게시판에서 내려가요.';}
 form.querySelectorAll('[name=visibility]').forEach(input=>input.onchange=selection);selection();
 form.onsubmit=async e=>{
  e.preventDefault();if(version!==modalVersion||!requireMember())return;const data=Object.fromEntries(new FormData(form));data.name=data.name.trim();if(!data.name)return toast('차 이름을 입력해주세요.');
  let photos;try{photos=photoEditor.get()}catch(error){$('#record-error').textContent=error.message;return;}
  const record={...data,id:r.id,author:nickname(),authorUid:uid};const next=draftState();if(id)next.records=next.records.map(item=>item.id===id?record:item);else next.records.push(record);
  const publish=data.visibility==='public';const ok=await commitState(next,{recordId:r.id,publish,photos,postRevision:assets.postRevision});
  if(ok&&version===modalVersion){selected=data.date;month=new Date(data.date+'T12:00:00');month.setDate(1);closeModal();if(publish)go('feed');else render();toast(publish?(assets.postHidden&&!assets.postDeleted?'기록을 저장했어요. 관리자 숨김 상태는 유지돼요.':'차 기록을 저장하고 게시판에 공개했어요.'):'나만 보는 차 기록을 저장했어요.');}
 };
}
function deleteRecord(id){if(!requireMember())return;const r=state.records.find(r=>r.id===id);openModal('이 기록을 삭제할까요?',`<p class="sub">기록과 사진을 삭제해요.${r?.sharedPostId?' 연결된 게시글도 게시판에서 내려가요.':''}</p><p id="record-error" class="form-error" role="alert"></p><div class="form-actions"><button class="small-btn" onclick="editRecord(${jsArg(id)})">돌아가기</button><button class="primary" onclick="confirmDelete(${jsArg(id)})">삭제하기</button></div>`);}
async function confirmDelete(id){
 if(!requireMember())return;const r=state.records.find(r=>r.id===id);if(!r)return;const uid=currentUser.uid,version=modalVersion;
 try{
  const store=await chagokAuth.getStore();const assets=r.sharedPostId?await store.loadRecordAssets(uid,r):{postRevision:null};if(uid!==currentUser?.uid||version!==modalVersion)return;
  const next=draftState();next.records=next.records.filter(item=>item.id!==id);
  next.saved=next.saved.filter(x=>x!==id&&x!==r.sharedPostId);
  if(await commitState(next,{recordId:id,publish:false,photos:[],postRevision:assets.postRevision})){if(version===modalVersion){closeModal();render();toast('기록과 연결된 게시글을 삭제했어요.');}}
 }catch(error){if(uid===currentUser?.uid&&version===modalVersion){toast(cloudError(error.code));$('#record-error').textContent=cloudError(error.code);}}
}
const originalAskDeletePost=askDeletePost;askDeletePost=function(id){
 const record=state.records.find(r=>r.sharedPostId===id);if(!record)return originalAskDeletePost(id);if(!requireMember())return;
 openModal('게시글을 내릴까요?',`<p class="sub">캘린더 기록과 사진은 나만 보기로 보관하고, 게시판에서는 내려요.</p><p id="record-error" class="form-error" role="alert"></p><div class="form-actions"><button class="small-btn" onclick="closeModal()">취소</button><button class="primary" onclick="unpublishRecord(${jsArg(record.id)})">게시글 내리기</button></div>`);
};
async function unpublishRecord(id){
 if(!requireMember())return;const r=state.records.find(r=>r.id===id),uid=currentUser.uid,version=modalVersion;if(!r)return;
 try{const store=await chagokAuth.getStore();const assets=await store.loadRecordAssets(uid,r);if(uid!==currentUser?.uid||version!==modalVersion)return;
  if(await commitState(draftState(),{recordId:id,publish:false,photos:assets.photos,postRevision:assets.postRevision})){if(version===modalVersion){closeModal();render();toast('게시글을 내리고 기록은 나만 보기로 보관했어요.');}}
 }catch(error){if(version===modalVersion)$('#record-error').textContent=cloudError(error.code);}
}
