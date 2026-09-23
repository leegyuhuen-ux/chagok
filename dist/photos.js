'use strict';
// Small pilot attachments live separately from the post text and load on demand.
const ChagokPhotos=(()=>{
 const valid=src=>typeof src==='string'&&src.length<=200000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(src);
 async function compress(file){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WebP 사진을 선택해주세요.');
  if(file.size>15*1024*1024)throw new Error('사진 한 장은 15MB 이하로 선택해주세요.');
  const url=URL.createObjectURL(file),img=new Image();
  try{
   await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('사진을 읽지 못했어요. 다른 사진을 선택해주세요.'));img.src=url;});
   if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>50000000)throw new Error('사진 해상도가 너무 높아요. 크기를 줄여 다시 선택해주세요.');
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   for(let edge=1280;edge>=320;edge=Math.floor(edge*.75)){
    const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.82,.68,.54,.4]){const data=canvas.toDataURL('image/jpeg',quality);if(valid(data))return data;}
   }
   throw new Error('사진 크기를 충분히 줄이지 못했어요. 다른 사진을 선택해주세요.');
  }finally{URL.revokeObjectURL(url);img.src='';}
 }
 function editor(container,initial=[],onBusy=()=>{}){
  let photos=initial.filter(valid).slice(0,3),busy=false,message='';
  function render(){
   container.innerHTML=`<label class="field">사진 첨부 (${photos.length}/3)<input type="file" accept="image/jpeg,image/png,image/webp" multiple ${busy||photos.length===3?'disabled':''} aria-describedby="photo-help"></label><p id="photo-help" class="sub">최대 3장 · JPG, PNG, WebP · 한 장 15MB 이하<br>사진은 자동으로 크기를 줄여 저장해요.</p><div class="photo-previews">${photos.map((src,i)=>`<figure><img src="${src}" alt="첨부 사진 ${i+1}"><button type="button" class="small-btn" data-remove="${i}" ${busy?'disabled':''}>사진 ${i+1} 삭제</button></figure>`).join('')}</div><p class="photo-status ${message?'form-error':''}" role="status">${busy?'사진을 준비하고 있어요…':message}</p>`;
   container.querySelector('input').onchange=async e=>{
    const files=Array.from(e.target.files||[]);if(!files.length)return;
    if(files.length+photos.length>3){message='사진은 최대 3장까지 첨부할 수 있어요.';render();return;}
    busy=true;message='';onBusy(true);render();
    try{const prepared=[];for(const file of files)prepared.push(await compress(file));if(container.isConnected)photos.push(...prepared);}
    catch(error){message=error.message;}
    finally{busy=false;if(container.isConnected){render();onBusy(false);}}
   };
   container.querySelectorAll('[data-remove]').forEach(button=>button.onclick=()=>{if(busy)return;photos.splice(Number(button.dataset.remove),1);message='';render();});
  }
  render();return {get(){if(busy)throw new Error('사진 준비가 끝나면 게시해주세요.');return [...photos]}};
 }
 return {valid,compress,editor};
})();

let photoSubscriptions=[],photoObserver=null,photoCache=new Map(),photoGeneration=0,activePhotoPost=null;
function resetPostPhotos(){photoGeneration++;photoObserver?.disconnect();photoObserver=null;photoSubscriptions.forEach(stop=>stop());photoSubscriptions=[];photoCache.clear();activePhotoPost=null;}
function mountPostPhotos(){
 const opened=activePhotoPost;resetPostPhotos();if(!isMember())return;
 if(opened){if(!posts().some(p=>p.id===opened))closeModal();else activePhotoPost=opened;}
 const generation=photoGeneration,uid=currentUser.uid;
 async function load(el){
  const id=el.dataset.postPhotos;
  try{const api=await chagokAuth.getCommunity();if(generation!==photoGeneration||!el.isConnected||uid!==currentUser?.uid)return;
   const stop=api.watchPhotos(uid,id,photos=>{if(generation!==photoGeneration||!el.isConnected)return;photoCache.set(id,photos);el.innerHTML=photos.map((src,i)=>`<button class="photo-thumb" onclick="openPostPhoto(${jsArg(id)},${i})" aria-label="사진 ${i+1} 크게 보기"><img src="${src}" alt="게시글 사진 ${i+1}" loading="lazy" decoding="async"></button>`).join('')||'<p class="sub">첨부된 사진이 없어요.</p>';},()=>{if(generation!==photoGeneration)return;photoCache.delete(id);el.textContent='사진을 불러오지 못했어요.';if(activePhotoPost===id)closeModal();});photoSubscriptions.push(stop);
  }catch{if(el.isConnected)el.textContent='사진을 불러오지 못했어요.';}
 }
 const nodes=document.querySelectorAll('[data-post-photos]');
 if(typeof IntersectionObserver==='undefined'){nodes.forEach(load);return;}
 photoObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){photoObserver.unobserve(entry.target);void load(entry.target);}},{rootMargin:'200px'});nodes.forEach(el=>photoObserver.observe(el));
}
function openPostPhoto(id,index){
 if(!requireMember())return;const photos=photoCache.get(id);if(!photos?.[index]||!posts().some(p=>p.id===id))return;
 openModal(`사진 ${index+1} / ${photos.length}`,`<img class="full-photo" src="${photos[index]}" alt="게시글 사진 ${index+1}"><div class="photo-pager">${photos.map((_,i)=>`<button class="small-btn" onclick="openPostPhoto(${jsArg(id)},${i})" aria-pressed="${i===index}">${i+1}</button>`).join('')}</div>`);$('#modal').classList.add('photo-viewer');activePhotoPost=id;
}
