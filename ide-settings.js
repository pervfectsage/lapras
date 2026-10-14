'use strict';
// Turbo C++ writes these files when Options > Save is selected.
const LaprasSettings=(()=>{
 const key='lapras-ide-settings-v1';
 const allowed=p=>/^\/(?:TURBOC3|TC)\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:TC|CFG|DSK|DPR)$/i.test(p);
 const encode=b=>{let s='';for(const byte of b)s+=String.fromCharCode(byte);return btoa(s)};
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 function snapshot(fs){const files={};let total=0;function walk(dir){if(!fs.analyzePath(dir).exists)return;for(const name of fs.readdir(dir)){if(name==='.'||name==='..')continue;const p=dir+'/'+name;const stat=fs.stat(p);if(fs.isDir(stat.mode))walk(p);else if(allowed(p)&&stat.size<=262144){const bytes=fs.readFile(p);total+=bytes.length;if(total>1048576)throw Error('IDE settings are too large to save');files[p]=encode(bytes)}}}walk('/TURBOC3');walk('/TC');return files}
 function restore(fs,storage){const raw=storage.getItem(key);if(!raw)return false;const saved=JSON.parse(raw);if(saved.version!==1||!saved.files||typeof saved.files!=='object')throw Error('Saved IDE settings are invalid');for(const [p,data] of Object.entries(saved.files)){if(!allowed(p)||typeof data!=='string'||data.length>350000)throw Error('Saved IDE settings are invalid');const bytes=decode(data);fs.mkdirTree(p.slice(0,p.lastIndexOf('/')));fs.writeFile(p,bytes)}return true}
 function watch(fs,storage,onError){let last=JSON.stringify(snapshot(fs));function save(){try{const files=snapshot(fs),next=JSON.stringify(files);if(next!==last){storage.setItem(key,JSON.stringify({version:1,files}));last=next}}catch(e){onError(e)}}const timer=setInterval(save,1000);const hide=()=>save();const visibility=()=>{if(document.visibilityState==='hidden')save()};window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',visibility);return {save,stop(){clearInterval(timer);window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',visibility)}}}
 return {snapshot,restore,watch};
})();
