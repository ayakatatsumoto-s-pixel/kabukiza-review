const mount=document.getElementById('evaluation-panel');
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
async function start(){
 const response=await fetch('assets/joint_review.json');if(!response.ok)throw Error('評価項目を読み込めません');
 const data=await response.json(),key='kabukiza-evaluation-v1-'+data.model_sha256;
 let saved={schema:'kabukiza.evaluation.v1',model_sha256:data.model_sha256,author:'',items:{}};
 try{const old=JSON.parse(localStorage.getItem(key));if(old?.model_sha256===data.model_sha256)saved=old;}catch{}
 mount.append(el('h2','今回のモデル評価'));
 mount.append(el('p','各項目を表示して「OK・要修正・保留」を記録してください。評価はこのブラウザに保存されます。共有・保管にはJSON出力を使ってください。'));
 const author=el('input');author.placeholder='評価者名（任意）';author.value=saved.author||'';author.maxLength=100;author.setAttribute('aria-label','評価者名');mount.append(author);
 const status=el('p');status.setAttribute('role','status');mount.append(status);
 const inputs=[];
 const persist=()=>{saved.author=author.value;saved.updated_at=new Date().toISOString();for(const {id,select,note} of inputs)saved.items[id]={judgment:select.value,comment:note.value};try{localStorage.setItem(key,JSON.stringify(saved));status.textContent='このブラウザに保存しました';}catch{status.textContent='端末内保存に失敗しました。JSON出力で保存してください。';}};
 author.addEventListener('input',persist);
 for(const j of data.joints){
  const card=el('article');card.className='joint-card';card.append(el('h3',j.id+' '+j.label),el('p',j.result),el('p','確認点：'+j.unresolved));
  const show=el('button','この部位を3Dで確認');show.type='button';show.onclick=()=>{const r=window.kabukizaReview;if(!r?.ready){status.textContent='3Dモデルの読込完了を待ってください';return;}r.select(j.connected_parts.filter(id=>r.viewer.partById.has(id)));r.viewer.focus(j.bounds);document.getElementById('view-area').scrollIntoView({behavior:'smooth'});};
  const select=el('select');select.setAttribute('aria-label',j.id+' 判定');for(const [v,t] of [['','未評価'],['ok','OK'],['revise','要修正'],['hold','保留']]){const o=el('option',t);o.value=v;select.append(o);}select.value=saved.items[j.id]?.judgment||'';
  const note=el('textarea');note.rows=2;note.maxLength=4000;note.placeholder='評価理由・残っている不具合';note.setAttribute('aria-label',j.id+' 評価コメント');note.value=saved.items[j.id]?.comment||'';
  inputs.push({id:j.id,select,note});select.onchange=persist;note.oninput=persist;card.append(show,select,note);mount.append(card);
 }
 const download=el('button','評価をJSON出力');download.className='primary';download.onclick=()=>{persist();const url=URL.createObjectURL(new Blob([JSON.stringify(saved,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='kabukiza_v007_evaluation_'+data.model_sha256.slice(0,12)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const label=el('label','評価JSON読込 '),file=el('input');file.type='file';file.accept='.json,application/json';file.onchange=async()=>{try{const d=JSON.parse(await file.files[0].text());if(d.schema!=='kabukiza.evaluation.v1'||d.model_sha256!==data.model_sha256)throw Error('モデル版が異なる評価は上書きできません');if(!d.items||typeof d.items!=='object')throw Error('評価形式が不正です');for(const {id} of inputs){const i=d.items[id];if(i&&(!['','ok','revise','hold'].includes(i.judgment)||typeof i.comment!=='string'||i.comment.length>4000))throw Error('評価内容が不正です');}author.value=typeof d.author==='string'?d.author.slice(0,100):'';for(const {id,select,note} of inputs){select.value=d.items[id]?.judgment||'';note.value=d.items[id]?.comment||'';}persist();}catch(e){status.textContent=e.message;}};label.append(file);mount.append(download,label);
 window.kabukizaEvaluation={key,data,inputs};
}
start().catch(e=>mount.append(el('p',e.message)));
