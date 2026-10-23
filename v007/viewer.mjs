const add=(a,b)=>a.map((x,i)=>x+b[i]), sub=(a,b)=>a.map((x,i)=>x-b[i]);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const scale=(a,s)=>a.map(x=>x*s), unit=a=>scale(a,1/Math.max(1e-15,Math.hypot(...a)));
export const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function multiply(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
export function vector(m,v){return [0,1,2,3].map(r=>v.reduce((s,x,c)=>s+m[c*4+r]*x,0));}
export function inverse(m){
 const rows=[0,1,2,3].map(r=>[...Array.from({length:4},(_,c)=>m[c*4+r]),...Array.from({length:4},(_,c)=>c===r?1:0)]);
 for(let c=0;c<4;c++){let k=c;for(let r=c+1;r<4;r++)if(Math.abs(rows[r][c])>Math.abs(rows[k][c]))k=r;
  if(Math.abs(rows[k][c])<1e-14)throw Error('カメラ行列が不正です。');[rows[k],rows[c]]=[rows[c],rows[k]];
  const d=rows[c][c];rows[c]=rows[c].map(x=>x/d);
  for(let r=0;r<4;r++)if(r!==c){const q=rows[r][c];rows[r]=rows[r].map((x,j)=>x-q*rows[c][j]);}
 }
 return new Float32Array(Array.from({length:16},(_,i)=>rows[i%4][4+Math.floor(i/4)]));
}
function lookAt(eye,target){const z=unit(sub(eye,target)),x=unit(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function perspective(fx,fy,near,far,ox=0,oy=0){
 // Reversed Z with floating-point depth keeps thin tile/lining offsets stable.
 return new Float32Array([fx,0,0,0,0,fy,0,0,ox,oy,(far+near)/(far-near),-1,0,0,2*far*near/(far-near),0]);
}
function rayTriangle(origin,direction,a,b,c){const ab=sub(b,a),ac=sub(c,a),h=cross(direction,ac),d=dot(ab,h);if(Math.abs(d)<1e-12)return Infinity;
 const inv=1/d,s=sub(origin,a),u=dot(s,h)*inv;if(u<0||u>1)return Infinity;const q=cross(s,ab),v=dot(direction,q)*inv;if(v<0||u+v>1)return Infinity;const t=dot(ac,q)*inv;return t>=0?t:Infinity;}

const vertexRegular=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;layout(location=2) in vec3 aColor;layout(location=3) in float aId;
uniform mat4 uVP;uniform vec3 uPartColor;uniform float uPart;
out vec3 vNormal;out vec3 vColor;out vec3 vPartColor;flat out float vId;flat out float vPart;
void main(){gl_Position=uVP*vec4(aPosition,1.);vNormal=aNormal;vColor=aColor;vPartColor=uPartColor;vId=aId;vPart=uPart;}`;
const vertexInstance=`#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;layout(location=1) in vec3 aNormal;
layout(location=4) in mat4 aMatrix;layout(location=8) in vec2 aInfo;layout(location=9) in vec3 aPartColor;
uniform mat4 uVP;uniform vec3 uColor;
out vec3 vNormal;out vec3 vColor;out vec3 vPartColor;flat out float vId;flat out float vPart;
void main(){gl_Position=uVP*aMatrix*vec4(aPosition,1.);mat3 basis=mat3(aMatrix);mat3 normalMatrix=mat3(cross(basis[1],basis[2]),cross(basis[2],basis[0]),cross(basis[0],basis[1]));vNormal=normalMatrix*aNormal;if(determinant(basis)<0.)vNormal=-vNormal;vColor=uColor;vPartColor=aPartColor;vId=aInfo.y;vPart=aInfo.x;}`;
const fragment=`#version 300 es
precision highp float;
in vec3 vNormal;in vec3 vColor;in vec3 vPartColor;flat in float vId;flat in float vPart;
uniform int uMode;uniform bool uPick;uniform bool uIsolate;uniform float uOpacity;uniform int uSelectedCount;uniform vec2 uSelected[30];uniform float uMesh;
out vec4 result;
void main(){bool chosen=false;for(int i=0;i<30;i++){if(i>=uSelectedCount)break;if(vPart>=uSelected[i].x-.1&&vPart<=uSelected[i].y+.1)chosen=true;}
 if(uIsolate&&!chosen)discard;
 if(uPick){float id=floor(vId+.5);result=vec4(mod(id,256.),mod(floor(id/256.),256.),mod(floor(id/65536.),256.),255.)/255.;return;}
 float light=.56+.44*abs(dot(normalize(vNormal),normalize(vec3(.4,.8,.5))));
 vec3 color=uMode==0?vPartColor*light:uMode==2?vec3(.67,.69,.71)*light:vec3(0.);
 if(uMode==1){
  // USD material colors are linear; the browser canvas displays sRGB.
  // A softer fill keeps the white facade and dark roof readable together.
  vec3 lit=max(vColor,vec3(0.))*(.68+.32*abs(dot(normalize(vNormal),normalize(vec3(.4,.8,.5)))));
  vec3 mapped=lit/(vec3(1.)+.18*lit);
  color=pow(mapped,vec3(1./2.2));
 }
 // Every selected part gets the same clear highlight, including multiple selections.
 // Picking IDs and the recorded precise hit remain independent of this visual treatment.
 if(uSelectedCount>0){
  if(chosen)color=vec3(1.,.48,.055)*(.8+.2*light);
  else color=vec3(.36,.39,.42)*light;
 }
 float alpha=(uSelectedCount>0&&chosen)?1.:(uMode==1?uOpacity:1.);
 result=vec4(color,alpha);}`;
const postVertex=`#version 300 es
precision highp float;out vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const postFragment=`#version 300 es
precision highp float;in vec2 uv;uniform sampler2D image;uniform vec2 pixel;uniform bool edges;uniform float opacity;out vec4 color;
void main(){vec4 c=texture(image,uv);if(edges){float e=0.;for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec4 n=texture(image,uv+vec2(x,y)*pixel);e=max(e,length(c.rgb-n.rgb)+abs(c.a-n.a));}color=vec4(1.,.27,.12,e>.10?opacity:0.);}else color=vec4(c.rgb,c.a*opacity);}`;

export class PartViewer{
 constructor(canvas,onPick,onChange){
  this.canvas=canvas;this.onPick=onPick;this.onChange=onChange;this.gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:true,premultipliedAlpha:false});
  if(!this.gl)throw Error('このブラウザーではWebGL 2を利用できません。対応ブラウザーで開いてください。');
  const gl=this.gl;this.programs=[this.program(vertexRegular,fragment),this.program(vertexInstance,fragment)];this.post=this.program(postVertex,postFragment);
  this.buckets=[];this.batches=[];this.proto=new Map();this.meshes=new Map();this.parts=new Map();this.selection=new Set();this.mode=2;this.opacity=1;this.edges=false;this.component='all';this.isolate=false;this.showSite=true;this.mesh=0;
  this.view=identity();this.projection=identity();this.target=[0,12,12];this.radius=125;this.yaw=.65;this.pitch=.35;this.cameraId=null;
  this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas);this.events();
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.onChange?.({error:'3D表示が中断しました。ページを再読込してください。'});});
 }
 program(v,f){const gl=this.gl;const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,v),fs=shader(gl.FRAGMENT_SHADER,f);gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.deleteShader(vs);gl.deleteShader(fs);return p;}
 uniform(p,n){return this.gl.getUniformLocation(p,n);}
 async data(url,type=Float32Array){
  const pack=this.scene?.asset_pack,name=url.split('/').pop(),entry=pack?.entries?.[name];
  if(entry){
   if(!this.packPromise)this.packPromise=(async()=>{const r=await fetch('assets/'+pack.file);if(!r.ok)throw Error('圧縮モデルデータを読み込めません');const bytes=await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();if(bytes.byteLength!==pack.bytes)throw Error('圧縮モデルデータの容量が一致しません');return bytes;})();
   const bytes=await this.packPromise;
   return new type(bytes.slice(entry[0],entry[0]+entry[1]));
  }
  const r=await fetch(url);if(!r.ok)throw Error('モデルデータを読み込めません: '+url);return new type(await r.arrayBuffer());
 }
 buffer(data,target){const gl=this.gl,b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,data,gl.STATIC_DRAW);return b;}
 attribute(i,size,stride,offset,divisor=0){const gl=this.gl;gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,stride,offset);gl.vertexAttribDivisor(i,divisor);}
 async load(scene,base='assets/',progress=()=>{}){
  this.scene=scene;scene.parts.forEach(p=>this.parts.set(p.number,p));this.partById=new Map(scene.parts.map(p=>[p.id,p]));scene.meshes.forEach(m=>this.meshes.set(m.id,m));
  const gl=this.gl;let completed=0,total=scene.buckets.length+Object.keys(scene.prototypes).length+scene.instance_batches.length;
  // Bounded concurrency prevents a large building from opening hundreds of requests at once.
  const parallel=async(items,fn)=>{let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<items.length){const i=cursor++;await fn(items[i],i);progress(++completed,total);}}));};
  const packed=scene.geometry_buffers?await Promise.all([this.data(base+scene.geometry_buffers.vertices),this.data(base+scene.geometry_buffers.indices,Uint32Array)]):null;
  await parallel(scene.buckets,async(b,i)=>{const [v,ix]=packed?[packed[0].subarray(b.vertex_offset,b.vertex_offset+b.vertex_count*10),packed[1].subarray(b.index_offset,b.index_offset+b.index_count)]:await Promise.all([this.data(base+b.vertices),this.data(base+b.indices,Uint32Array)]);const vao=gl.createVertexArray();gl.bindVertexArray(vao);this.buffer(v,gl.ARRAY_BUFFER);this.attribute(0,3,40,0);this.attribute(1,3,40,12);this.attribute(2,3,40,24);this.attribute(3,1,40,36);this.buffer(ix,gl.ELEMENT_ARRAY_BUFFER);gl.bindVertexArray(null);this.buckets[i]={...b,v,ix,vao};});
  await parallel(Object.entries(scene.prototypes),async([name,records])=>{const children=[];for(const p of records){const [v,ix]=await Promise.all([this.data(base+p.vertices),this.data(base+p.indices,Uint32Array)]);children.push({...p,v,ix,vbo:this.buffer(v,gl.ARRAY_BUFFER),ibo:this.buffer(ix,gl.ELEMENT_ARRAY_BUFFER)});}this.proto.set(name,children);});
  await parallel(scene.instance_batches,async(b,i)=>{const data=await this.data(base+b.data);const ibo=this.buffer(data,gl.ARRAY_BUFFER),children=[];for(const p of this.proto.get(b.prototype)){const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,p.vbo);this.attribute(0,3,24,0);this.attribute(1,3,24,12);gl.bindBuffer(gl.ARRAY_BUFFER,ibo);for(let j=0;j<4;j++)this.attribute(4+j,4,84,j*16,1);this.attribute(8,2,84,64,1);this.attribute(9,3,84,72,1);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,p.ibo);children.push({...p,vao});}gl.bindVertexArray(null);const partNumbers=new Set();for(let j=0;j<b.count;j++)partNumbers.add(data[j*21+16]);this.batches[i]={...b,data,children,partNumbers};});
  this.instanceSets=await Promise.all(scene.instance_sets.map(async s=>({...s,sourceIDs:s.source_ids?await this.data(base+s.source_ids,Int32Array):null,partIDs:await this.data(base+s.part_ids,Uint32Array)})));
  this.packPromise=null;this.loaded=true;this.home('theater');this.resize();return this;
 }
 makeTarget(w,h){const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT32F,w,h);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('3D描画領域を作成できません。');gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {fbo,texture,depth};}
 resize(){const gl=this.gl,dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.max(2,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(2,Math.floor(this.canvas.clientHeight*dpr));if(w===this.canvas.width&&h===this.canvas.height&&this.colorTarget)return;
  this.canvas.width=w;this.canvas.height=h;for(const t of [this.colorTarget,this.pickTarget])if(t){gl.deleteFramebuffer(t.fbo);gl.deleteTexture(t.texture);gl.deleteRenderbuffer(t.depth);}this.colorTarget=this.makeTarget(w,h);this.pickTarget=this.makeTarget(w,h);this.updateProjection();this.request();}
 updateProjection(){const aspect=this.canvas.width/this.canvas.height;if(this.fixedCamera){const c=this.fixedCamera;this.projection=perspective(2*c.focal/c.horizontal_aperture,2*c.focal/c.vertical_aperture,.1,2500,2*c.horizontal_offset/c.horizontal_aperture,2*c.vertical_offset/c.vertical_aperture);}else{const f=1/Math.tan((this.fovy||.72)/2);this.projection=perspective(f/aspect,f,Math.max(.025,Math.min(2,this.radius/100)),Math.max(500,this.radius*10));}}
 orbit(){const eye=add(this.target,[this.radius*Math.cos(this.pitch)*Math.sin(this.yaw),this.radius*Math.sin(this.pitch),this.radius*Math.cos(this.pitch)*Math.cos(this.yaw)]);this.view=lookAt(eye,this.target);this.fixedCamera=null;this.cameraId=null;this.updateProjection();this.onChange?.({free:true});this.request();}
 home(which='theater'){this.target=which==='all'?[0,65,0]:[0,12,10];this.radius=which==='all'?270:125;this.yaw=.65;this.pitch=.34;this.fovy=.72;this.orbit();}
 setCamera(c){this.fixedCamera=c;this.cameraId=c.id;this.view=inverse(new Float32Array(c.world));this.updateProjection();const eye=c.world.slice(12,15),f=scale(c.world.slice(8,11),-1),d=Math.max(8,Math.min(250,dot(sub(this.target,eye),f)));this.target=add(eye,scale(f,d));this.radius=d;const delta=sub(eye,this.target);this.pitch=Math.asin(Math.max(-.99,Math.min(.99,delta[1]/d)));this.yaw=Math.atan2(delta[0],delta[2]);this.fovy=2*Math.atan(c.vertical_aperture/(2*c.focal));this.request();}
 focus(bounds){const lo=bounds[0],hi=bounds[1];this.target=scale(add(lo,hi),.5);this.radius=Math.max(1.2,Math.hypot(...sub(hi,lo))*1.6);this.orbit();}
 snapshot(){return {view:Array.from(this.view),projection:Array.from(this.projection),preset:this.cameraId,target:this.target,radius:this.radius,yaw:this.yaw,pitch:this.pitch,show_site:this.showSite,aspect:this.canvas.width/this.canvas.height,fovy:this.fovy,mode:this.mode,component:this.component,isolate:this.isolate,edges:this.edges};}
 restore(c){this.view=new Float32Array(c.view);this.projection=new Float32Array(c.projection);this.target=c.target||this.target;this.radius=c.radius||this.radius;this.yaw=c.yaw??this.yaw;this.pitch=c.pitch??this.pitch;this.cameraId=c.preset||null;this.fixedCamera=this.scene.cameras.find(p=>p.id===c.preset)||null;this.fovy=c.fovy??this.fovy;this.mode=c.mode??this.mode;this.component=c.component??this.component;this.isolate=c.isolate??this.isolate;this.edges=c.edges??this.edges;this.showSite=c.show_site??this.showSite;this.request();}
 select(ids,mesh=0){this.selection=new Set(ids.map(id=>this.partById.get(id)?.number).filter(Boolean));this.selectionRanges=ids.map(id=>this.partById.get(id)?.selection_range||[this.partById.get(id)?.number,this.partById.get(id)?.number]).filter(r=>Number.isFinite(r[0]));this.mesh=mesh;this.request();}
 visible(part){return part&&(this.component==='all'||part.component===this.component)&&(this.showSite||part.component!=='site')&&(!this.isolate||!this.selection.size||(this.selectionRanges||[]).some(([a,b])=>part.number>=a&&part.number<=b));}
 settings(p,pick){const gl=this.gl;gl.useProgram(p);gl.uniformMatrix4fv(this.uniform(p,'uVP'),false,multiply(this.projection,this.view));gl.uniform1i(this.uniform(p,'uMode'),this.mode);gl.uniform1i(this.uniform(p,'uPick'),pick);gl.uniform1i(this.uniform(p,'uIsolate'),this.isolate&&this.selection.size>0);const a=(this.selectionRanges||[]).slice(0,30);gl.uniform1i(this.uniform(p,'uSelectedCount'),a.length);if(a.length)gl.uniform2fv(this.uniform(p,'uSelected[0]'),new Float32Array(a.flat()));gl.uniform1f(this.uniform(p,'uMesh'),this.mesh);}
 draw(target,pick=false){const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target.fbo);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.CULL_FACE);gl.disable(gl.DITHER);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.GREATER);gl.depthMask(true);gl.clearDepth(0);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.BLEND);
  const regular=this.programs[0],instanced=this.programs[1];
  for(const transparent of [false,true]){
   if(pick&&transparent)break;
   const isTransparent=x=>!pick&&this.mode===1&&x.opacity<1;
   if(transparent){gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
   this.settings(regular,pick);
   for(const b of this.buckets){const part=this.parts.get(b.part_number);if(!this.visible(part)||isTransparent(b)!==transparent)continue;gl.uniform3fv(this.uniform(regular,'uPartColor'),part.color);gl.uniform1f(this.uniform(regular,'uPart'),part.number);gl.uniform1f(this.uniform(regular,'uOpacity'),b.opacity);gl.bindVertexArray(b.vao);gl.drawElements(gl.TRIANGLES,b.index_count,gl.UNSIGNED_INT,0);}
   this.settings(instanced,pick);
   for(const b of this.batches){if(![...b.partNumbers].some(n=>this.visible(this.parts.get(n))))continue;for(const p of b.children){if(isTransparent(p)!==transparent)continue;gl.uniform3fv(this.uniform(instanced,'uColor'),p.color);gl.uniform1f(this.uniform(instanced,'uOpacity'),p.opacity);gl.bindVertexArray(p.vao);gl.drawElementsInstanced(gl.TRIANGLES,p.index_count,gl.UNSIGNED_INT,0,b.count);}}
  }
  gl.bindVertexArray(null);gl.depthMask(true);gl.disable(gl.BLEND);
 }
 request(){if(this.pending)return;this.pending=true;requestAnimationFrame(()=>{this.pending=false;if(!this.loaded)return;this.draw(this.colorTarget,false);const gl=this.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.disable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.post);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.colorTarget.texture);gl.uniform1i(this.uniform(this.post,'image'),0);gl.uniform2f(this.uniform(this.post,'pixel'),1/this.canvas.width,1/this.canvas.height);gl.uniform1i(this.uniform(this.post,'edges'),this.edges);gl.uniform1f(this.uniform(this.post,'opacity'),this.opacity);gl.drawArrays(gl.TRIANGLES,0,3);});}
 async pick(nx,ny,additive=false){if(!this.loaded)return;this.draw(this.pickTarget,true);const gl=this.gl,pixel=new Uint8Array(4);gl.readPixels(Math.min(this.canvas.width-1,Math.max(0,Math.floor(nx*this.canvas.width))),Math.min(this.canvas.height-1,Math.max(0,Math.floor((1-ny)*this.canvas.height))),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);gl.bindFramebuffer(gl.FRAMEBUFFER,null);const id=pixel[0]+pixel[1]*256+pixel[2]*65536;const hit=this.hitInfo(id,nx,ny);this.onPick?.(hit,{additive});this.request();return hit;}
 hitInfo(id,nx,ny){if(!id)return null;const inv=inverse(multiply(this.projection,this.view));const unproject=z=>{const q=vector(inv,[nx*2-1,1-ny*2,z,1]);return scale(q.slice(0,3),1/q[3]);};const origin=unproject(1),direction=unit(sub(unproject(-1),origin));let best=Infinity,result;
  const regular=this.meshes.get(id);
  if(regular){const b=this.buckets[regular.bucket];for(let j=regular.index_start;j<regular.index_start+regular.index_count;j+=3){const v=[0,1,2].map(k=>Array.from(b.v.subarray(b.ix[j+k]*10,b.ix[j+k]*10+3)));best=Math.min(best,rayTriangle(origin,direction,...v));}result={...regular,mesh_path:regular.source_mesh_path,render_mesh_path:regular.path};}
  else {const setIndex=this.instanceSets.findIndex(s=>id>=s.pick_start&&id<s.pick_start+s.count);if(setIndex<0)return null;const set=this.instanceSets[setIndex],ordinal=id-set.pick_start;const part=this.parts.get(set.partIDs[ordinal]);let source=set.sourceIDs?set.source_paths[set.sourceIDs[ordinal]]:null;result={id,part_id:part.id,parent_part_id:part.parent_id||part.id,mesh_path:source||null,render_mesh_path:set.path+'#'+ordinal,instance_index:ordinal,path:set.path};
   for(const b of this.batches){if(b.set!==setIndex)continue;let offset=-1;for(let i=0;i<b.count;i++)if(b.data[i*21+17]===id){offset=i*21;break;}if(offset<0)continue;const m=b.data.subarray(offset,offset+16);for(const p of b.children)for(let j=0;j<p.ix.length;j+=3){const v=[0,1,2].map(k=>vector(m,[...Array.from(p.v.subarray(p.ix[j+k]*6,p.ix[j+k]*6+3)),1]).slice(0,3));best=Math.min(best,rayTriangle(origin,direction,...v));}}
  }
  result.world_point=Number.isFinite(best)?add(origin,scale(direction,best)):null;result.screen_point=[nx,ny];return result;
 }
 events(){const c=this.canvas;let drag=null;
  c.addEventListener('contextmenu',e=>e.preventDefault());
  c.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,button:e.button,shift:e.shiftKey,moved:false};c.setPointerCapture(e.pointerId);});
  c.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>4)drag.moved=true;if(!drag.moved)return;
   if(drag.button===2||drag.shift){const world=inverse(this.view),right=Array.from(world.slice(0,3)),up=Array.from(world.slice(4,7)),s=this.radius/Math.max(c.clientHeight,1);this.target=add(this.target,add(scale(right,-dx*s),scale(up,dy*s)));}else{this.yaw-=dx*.007;this.pitch=Math.max(-1.48,Math.min(1.48,this.pitch+dy*.007));}drag.x=e.clientX;drag.y=e.clientY;this.orbit();});
  c.addEventListener('pointerup',e=>{if(drag&&!drag.moved){const r=c.getBoundingClientRect();this.pick((e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,e.ctrlKey||e.metaKey);}drag=null;});
  c.addEventListener('pointercancel',()=>drag=null);
  c.addEventListener('wheel',e=>{e.preventDefault();this.radius=Math.max(.2,Math.min(1200,this.radius*Math.exp(e.deltaY*.001)));this.orbit();},{passive:false});
  c.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Enter'].includes(e.key)){e.preventDefault();if(e.key==='Enter'){this.pick(.5,.5,e.ctrlKey);return;}if(e.key==='ArrowLeft')this.yaw-=.08;if(e.key==='ArrowRight')this.yaw+=.08;if(e.key==='ArrowUp')this.pitch=Math.min(1.48,this.pitch+.08);if(e.key==='ArrowDown')this.pitch=Math.max(-1.48,this.pitch-.08);if(e.key==='+')this.radius*=.9;if(e.key==='-')this.radius*=1.1;this.orbit();}});
 }
}
