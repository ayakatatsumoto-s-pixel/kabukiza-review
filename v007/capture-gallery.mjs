const mounts=[...document.querySelectorAll('[data-gallery]')];
if(mounts.length){
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  fetch('assets/omniverse_captures.json').then(response=>{if(!response.ok)throw Error('撮影画像を読み込めません');return response.json();}).then(data=>{
    for(const mount of mounts){
      const kind=mount.dataset.gallery,isMatch=kind==='camera-match',isLegacy=kind==='legacy-review';
      const title=isMatch?'写真とOmniverse v007のカメラ比較':isLegacy?'v007 全景・部位別カメラ（21視点）':'Omniverse共通環境での確認画像';
      const note=isMatch?'6視点の手動カメラを使用。対応点は旧版由来で、今回の誤差測定は未実施です。':isLegacy?'従来ギャラリーと同じ固定21視点をv007モデルで撮り直しました。camera_005は共通環境の地面を撮影時だけ非表示にしています。':'正面上部の軒を含む最新v007。Webカラー表示の色・光の確認基準です。';
      const head=el('div','capture-gallery-head');head.append(el('h2','',title),el('p','',note));mount.append(head);
      const grid=el('div','capture-gallery-grid');
      const rows=isMatch?data.camera_match:isLegacy?data.legacy_review:data.feedback;
      if(!Array.isArray(rows)||!rows.length)throw Error('撮影画像の一覧がありません');
      for(const row of rows){
        const card=el('figure','capture-card'),caption=el('figcaption','',row.label||row.id);card.append(caption);
        const pair=el('div',isMatch?'capture-pair':'capture-single');
        const picture=(src,label)=>{const wrap=el('div','capture-image-wrap');wrap.append(el('span','',label));const link=el('a');link.href=src;link.target='_blank';link.rel='noopener';const img=el('img','capture-image');img.src=src;img.alt=(row.label||row.id)+'・'+label;img.loading='lazy';link.append(img);wrap.append(link);return wrap;};
        if(isMatch)pair.append(picture(row.photo,'資料写真'));
        pair.append(picture(row.image,'Omniverse v007'));card.append(pair);
        if(isMatch){const button=el('button','capture-focus','このカメラで3D比較');button.type='button';button.onclick=()=>{const camera=document.getElementById('camera'),reference=document.getElementById('reference');camera.value=row.id;camera.dispatchEvent(new Event('change'));reference.value='omniverse';reference.dispatchEvent(new Event('change'));document.getElementById('view-area').scrollIntoView({behavior:'smooth',block:'center'});};card.append(button);}
        grid.append(card);
      }
      mount.append(grid);
    }
  }).catch(error=>{for(const mount of mounts)mount.append(el('p','note',error.message));});
}
