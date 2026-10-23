const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const labels={validated:'形状・接続を検証済み',implemented:'修正済み・検証中',pending:'未完了',needs_identification:'対象の確認待ち',reference_limited:'資料の不足あり'};
export async function loadJointReview(mount,context){
 try{
  const response=await fetch('assets/joint_review.json');if(!response.ok)throw Error();const data=await response.json();
  if(data.schema!=='kabukiza.joint-review.v1'||!Array.isArray(data.joints))throw Error();
  mount.replaceChildren();const details=el('details',undefined,'joint-review'),summary=el('summary','接合部の修正・検証記録');details.append(summary);
  details.append(el('p',data.model_sha256===context.scene().model_sha256?'表示中のモデルに対応する検証記録です。':'この記録は表示中のモデルと版が異なります。','note'));
  details.append(el('p','図面の設計寸法と写真からの推定を区別しています。以前の「修正済み」コメント履歴はそのまま保持しています。','note'));
  if(data.summary)details.append(el('p',data.summary));
  for(const joint of data.joints){
   const card=el('article',undefined,'joint-card');card.append(el('strong',joint.id+' · '+joint.label),el('span',labels[joint.status]||joint.status,'badge'));
   card.append(el('p',joint.result||joint.current_mismatch),el('p','根拠資料：'+joint.reference_ids.join(' / '),'meta'));
   if(joint.dimensions)card.append(el('p',joint.dimensions,'meta'));if(joint.unresolved)card.append(el('p','未確定：'+joint.unresolved,'joint-pending'));
   const actions=el('div',undefined,'joint-actions');
   const select=el('button','周辺部材を選択');select.type='button';select.onclick=()=>{context.select(joint.connected_parts.filter(id=>context.viewer().partById.has(id)));if(joint.bounds)context.viewer().focus(joint.bounds);else context.focus();};actions.append(select);
   for(const [name,pitch,yaw] of [['平面',1.50,0],['正面',.04,0],['斜め上',.48,.65],['斜め下',-.25,.65]]){
    const button=el('button',name);button.type='button';button.onclick=()=>{select.onclick();const v=context.viewer();v.pitch=pitch;v.yaw=yaw;v.orbit();};actions.append(button);
   }
   const capture=el('button','この部位の画像でFBを作る');capture.type='button';capture.onclick=async()=>{select.onclick();context.prepare(joint);await context.capture();};actions.append(capture);card.append(actions);details.append(card);
  }
  const download=el('button','検証記録をJSONで保存');download.type='button';download.onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='kabukiza_v007_joint_review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};details.append(download);mount.append(details);return data;
 }catch{mount.textContent='接合部の検証記録はまだ公開されていません。';return null;}
}
