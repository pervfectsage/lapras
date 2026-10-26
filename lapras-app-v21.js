'use strict';
const $=id=>document.getElementById(id);
const starters={hello:'#include <iostream.h>\n#include <conio.h>\n\nint main()\n{\n    clrscr();\n    cout << "Welcome to Lapras!";\n    getch();\n    return 0;\n}\n',input:'#include <iostream.h>\n#include <conio.h>\n\nint main()\n{\n    clrscr();\n    int a, b;\n    cout << "Enter two numbers: ";\n    cin >> a >> b;\n    cout << "Sum = " << a + b;\n    getch();\n    return 0;\n}\n',graphics:'#include <graphics.h>\n#include <conio.h>\n\nint main()\n{\n    int gd = DETECT, gm;\n    initgraph(&gd, &gm, "C:\\\\TURBOC3\\\\BGI");\n    circle(320, 240, 100);\n    getch();\n    closegraph();\n    return 0;\n}\n'};
let runtime,ci,busy=false;
function say(s){$('message').textContent=s}
function persist(){try{localStorage.setItem('turbo-classroom-draft',JSON.stringify({name:$('filename').value,code:$('code').value}))}catch{}}
$('code').value=starters.hello;try{const d=JSON.parse(localStorage.getItem('turbo-classroom-draft'));if(d){$('code').value=d.code;$('filename').value=d.name}}catch{}
$('code').addEventListener('input',persist);$('filename').addEventListener('input',persist);
function filename(){const n=$('filename').value.trim().toUpperCase();if(!/^[A-Z0-9_]{1,8}\.(C|CPP|H)$/.test(n))throw Error('Use 1–8 letters, numbers or underscores, followed by .C, .CPP or .H.');return n}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function keys(codes){if(!ci)return;$('dos').focus();codes.forEach(k=>ci.simulateKeyEvent(k,true));await delay(90);codes.slice().reverse().forEach(k=>ci.simulateKeyEvent(k,false));$('dos').focus()}
async function type(text){for(const ch of text){await keys([(ch===':'||ch==='_')?16:0,ch===':'?186:ch==='\\'?220:ch==='.'?190:ch==='_'?189:ch.charCodeAt(0)].filter(Boolean));await delay(25)}}
function deadline(promise, label, ms=30000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out. Reload and try again.')),ms)})]).finally(()=>clearTimeout(timer))}
function fitDosCanvas(){const canvas=$('dos'),screen=$('screen');if(!canvas.width||!canvas.height)return;const scale=Math.min(screen.clientWidth/canvas.width,screen.clientHeight/canvas.height);canvas.style.width=Math.floor(canvas.width*scale)+'px';canvas.style.height=Math.floor(canvas.height*scale)+'px'}
document.addEventListener('fullscreenchange',()=>requestAnimationFrame(fitDosCanvas));
new ResizeObserver(fitDosCanvas).observe($('screen'));
new MutationObserver(fitDosCanvas).observe($('dos'),{attributes:true,attributeFilter:['width','height']});
$('dos').addEventListener('mousedown',()=>{$('dos').focus();if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock()},true);
function stage(text){$('status').textContent=text;$('start').textContent=text+'…'}
window.addEventListener('error',e=>{if(busy&&!ci)say('Emulator error: '+e.message)});
window.addEventListener('unhandledrejection',e=>{if(busy&&!ci)say('Emulator error: '+String(e.reason))});
$('start').onclick=async()=>{if(busy)return;busy=true;$('start').disabled=true;try{
 stage('Starting emulator');
 if(typeof Dos!=='function'||typeof WDOSBOX!=='function')throw new Error('The emulator scripts did not load. Please reload.');
 // Load the factory directly, avoiding js-dos 6's dynamic eval loader.
 window.exports.WDOSBOX=WDOSBOX;
 const binary=await deadline(fetch('wdosbox.wasm.js?v=2').then(async r=>{if(!r.ok)throw new Error('Emulator download failed ('+r.status+')');return r.arrayBuffer()}),'Emulator download');
 const module=await deadline(WebAssembly.compile(binary),'WebAssembly initialization');
 window.exports.instantiateWasm=(imports,done)=>{imports.env.globalscall=()=>{};WebAssembly.instantiate(module,imports).then(instance=>done(instance,module)).catch(e=>say('WebAssembly error: '+String(e)));return {}};
 runtime=await deadline(Dos($('dos'),{wdosboxUrl:'wdosbox.js',autolock:false,elementPointerLock:false,onprogress:(text)=>stage(text),onerror:e=>say('Emulator error: '+String(e))}),'Starting emulator');
 stage('Downloading compiler');
 const archive=await deadline(fetch('compiler.zip?v=4',{cache:'no-store'}).then(async response=>{
 if(!response.ok)throw new Error('Compiler download failed ('+response.status+')');
 const data=await response.arrayBuffer();
 if(data.byteLength<4||new Uint8Array(data)[0]!==80||new Uint8Array(data)[1]!==75)throw new Error('The server did not return a valid compiler ZIP');
 return new Uint8Array(data);
 }),'Compiler download',60000);
 stage('Extracting compiler');
 // Extract directly into the in-memory filesystem; no legacy XHR/cache/IDB sync.
 const em=runtime.fs.em;
 runtime.fs.chdir('/');
 for(const dir of ['TURBOC3/BIN','TURBOC3/INCLUDE/SYS','TURBOC3/LIB','TURBOC3/BGI','TC/INCLUDE/SYS','TC/LIB'])runtime.fs.fs.mkdirTree('/'+dir);
 const ptr=em._malloc(archive.length);
 if(!ptr)throw new Error('Not enough memory to load the compiler');
 let result;
 try{em.HEAPU8.set(archive,ptr);result=em._extract_zip(ptr,archive.length)}finally{em._free(ptr)}
 if(result!==0)throw new Error('Compiler extraction failed (code '+result+')');
 if(!runtime.fs.fs.analyzePath('/TURBOC3/BIN/TC.EXE').exists)throw new Error('Compiler extraction did not produce TC.EXE');
 const r=await fetch('dosbox.conf');if(!r.ok)throw new Error('Cannot load DOS configuration');runtime.fs.createFile('class.conf',await r.text());
 stage('Restoring IDE settings');
 try{LaprasSettings.restore(runtime.fs.fs,localStorage);LaprasSettings.watch(runtime.fs.fs,localStorage,e=>say('Browser could not save IDE settings: '+e.message));}catch(e){say('Browser could not restore IDE settings: '+e.message)}
 stage('Opening Turbo C++');
 // Show the DOS screen before waiting for the command interface.
 $('launch').hidden=true;$('launch').style.display='none';
 ci=await deadline(runtime.main(['-c','cd \\TURBOC3\\BIN','-c','TC.EXE HELLO.CPP']),'Opening Turbo C++');
 document.querySelectorAll('[data-keys],#load,#retrieve').forEach(b=>b.disabled=false);$('status').textContent='Lab running';fitDosCanvas();$('dos').focus();say('The lab is ready. To remember IDE colours and preferences, use Options → Save in Turbo C++.');
 }catch(e){$('status').textContent='Launch failed';say(String(e.message||e));$('start').textContent='Reload and retry';$('start').disabled=false;$('start').onclick=()=>location.reload();}
};
let runPending=false;
async function runProgram(){
 if(!ci||runPending)return;
 runPending=true;
 try{
  $('dos').focus();
  // Open the IDE Run menu; release Alt before executing its first item.
  // Avoid holding Ctrl+F9 while the IDE switches into the user program.
  await keys([18,82]);
  await delay(100);
  ci.simulateKeyEvent(13,true);
  ci.simulateKeyEvent(13,false);
  $('dos').focus();
 }finally{runPending=false}
}
document.querySelectorAll('[data-keys]').forEach(b=>{
 b.addEventListener('mousedown',e=>e.preventDefault());
 b.onclick=()=>b.dataset.keys==='17,120'?runProgram():keys(b.dataset.keys.split(',').map(Number));
});
$('load').onclick=async()=>{if(!ci||$('load').disabled)return;$('load').disabled=true;try{const n=filename();runtime.fs.fs.writeFile('/TURBOC3/BIN/'+n,new TextEncoder().encode($('code').value.replace(/\r?\n/g,'\r\n')));await keys([27]);await keys([114]);await delay(350);await keys([35]);for(let i=0;i<128;i++){ci.simulateKeyEvent(8,true);ci.simulateKeyEvent(8,false);await delay(8)}await type('C:\\TURBOC3\\BIN\\'+n);await keys([13]);say(n+' sent to the IDE. If a save prompt appears, resolve it, then open the file with F3.');persist()}catch(e){say(e.message)}finally{$('load').disabled=false}};
$('retrieve').onclick=()=>{try{const n=filename();const bytes=runtime.fs.fs.readFile('/TURBOC3/BIN/'+n);$('code').value=new TextDecoder().decode(bytes);persist();say('Read '+n+'. Any unsaved IDE edits are not included.')}catch(e){say('Cannot read the file. Save it in the IDE as C:\\TURBOC3\\BIN\\'+$('filename').value+' first.')}};
$('download').onclick=()=>{try{const n=filename();const url=URL.createObjectURL(new Blob([$('code').value],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say(n+' downloaded from the code panel.')}catch(e){say(e.message)}};
$('import').onclick=()=>$('file').click();$('file').onchange=async()=>{const f=$('file').files[0];if(!f)return;if(f.size>250000){say('Please import a source file smaller than 250 KB.');return}$('code').value=await f.text();updateLineCount();$('filename').value=f.name.toUpperCase();persist();say('Imported into the panel. Select Open code to send it to the IDE.');$('file').value=''};
$('examples').onchange=()=>{if($('code').value!==starters.hello&&!confirm('Replace the code panel with this starter?'))return;$('code').value=starters[$('examples').value];$('filename').value=$('examples').value==='graphics'?'CIRCLE.CPP':$('examples').value==='input'?'ADD.CPP':'HELLO.CPP';persist()};
$('full').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('screen').requestFullscreen();$('dos').focus()}catch{say('Fullscreen is not available in this browser.')}};

// Theme changes are local and do not restart the DOS session.
function updateThemeControl(){const dark=document.documentElement.dataset.theme==='dark';$('theme-toggle').setAttribute('aria-pressed',String(dark));$('theme-toggle').setAttribute('aria-label',dark?'Switch to light theme':'Switch to dark theme');$('theme-icon').textContent=dark?'☀':'☾';$('theme-label').textContent=dark?'Light mode':'Dark mode'}
$('theme-toggle').onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('turbo-classroom-theme',document.documentElement.dataset.theme)}catch{}updateThemeControl()};
updateThemeControl();

$('copy').onclick=async()=>{
 const button=$('copy'),code=$('code');
 if(!code.value){$('copy-status').textContent='The code panel is empty.';return}
 button.disabled=true;
 try{
  try{await navigator.clipboard.writeText(code.value)}catch{
   const start=code.selectionStart,end=code.selectionEnd;
   code.focus();code.select();
   if(!document.execCommand('copy'))throw new Error('Copy is unavailable');
   code.setSelectionRange(start,end);button.focus();
  }
  $('copy-status').textContent='Code copied!';
 }catch{
  code.focus();code.select();
  $('copy-status').textContent='Press Ctrl+C (Cmd+C on Mac) to copy the selected code.';
 }finally{button.disabled=false}
};
$('code').addEventListener('input',()=>{$('copy-status').textContent=''});
$('retrieve').addEventListener('click',()=>{$('copy-status').textContent=''});

// SDL listens on document: native form controls must retain browser editing.
for(const eventName of ['keydown','keypress','keyup']){
 document.querySelector('aside').addEventListener(eventName,event=>{
  if(event.target.closest('textarea,input,select,[contenteditable="true"]'))event.stopPropagation();
 });
}
// Translate conventional editing keys to Turbo C++'s CUA shortcuts.
// The DOS editor uses its own clipboard; browser textareas use the OS clipboard.
let editQueue=Promise.resolve();
const translatedKeys=new Set();
window.addEventListener('keydown',event=>{
 if(!event.isTrusted||!ci||document.activeElement!==$('dos')||!(event.ctrlKey||event.metaKey)||event.altKey)return;
 const key=event.key.toLowerCase();
 const sequences={a:[[17,36],[17,16,35]],c:[[17,45]],x:[[16,46]],v:[[16,45]],z:event.shiftKey?[[16,18,8]]:[[18,8]],y:[[16,18,8]],s:[[113]]};
 const sequence=sequences[key];if(!sequence)return;
 event.preventDefault();event.stopImmediatePropagation();translatedKeys.add(event.code);
 if(event.repeat)return;
 editQueue=editQueue.then(async()=>{
  for(const modifier of [16,17,18,91,93])ci.simulateKeyEvent(modifier,false);
  for(const chord of sequence)await keys(chord);
 }).catch(error=>say('Editor shortcut failed: '+error.message));
},true);
window.addEventListener('keyup',event=>{
 if(event.isTrusted&&translatedKeys.delete(event.code)){event.preventDefault();event.stopImmediatePropagation()}
},true);

document.querySelector('aside').addEventListener('focusin',()=>{
 if(ci)for(const modifier of [16,17,18,91,93])ci.simulateKeyEvent(modifier,false);
});

function updateLineCount(){const count=$('code').value.split('\n').length;$('line-count').textContent=count+' '+(count===1?'line':'lines')}
$('code').addEventListener('input',updateLineCount);
$('retrieve').addEventListener('click',updateLineCount);
$('examples').addEventListener('change',updateLineCount);
updateLineCount();

// Resizable split view. The DOS canvas already observes its container size.
const divider=$('panel-divider'),workspace=document.querySelector('.workspace');
const wideLayout=matchMedia('(min-width:951px)');
let panelWidth=320;
try{const saved=Number(localStorage.getItem('lapras-code-panel-width'));if(saved>=260)panelWidth=saved}catch{}
function sizeCodePanel(width,remember=false){
 if(!wideLayout.matches)return;
 const maximum=Math.max(260,Math.min(680,workspace.clientWidth-398));
 panelWidth=Math.round(Math.min(maximum,Math.max(260,width)));
 workspace.style.setProperty('--code-panel-width',panelWidth+'px');
 divider.setAttribute('aria-valuemax',maximum);
 divider.setAttribute('aria-valuenow',panelWidth);
 divider.setAttribute('aria-valuetext','Code panel '+panelWidth+' pixels wide');
 if(remember)try{localStorage.setItem('lapras-code-panel-width',String(panelWidth))}catch{}
}
let draggingPointer=null;
divider.addEventListener('pointerdown',event=>{
 if(event.button!==0||!wideLayout.matches)return;
 event.preventDefault();divider.focus();draggingPointer=event.pointerId;
 divider.setPointerCapture(event.pointerId);document.body.classList.add('is-resizing');
});
divider.addEventListener('pointermove',event=>{
 if(event.pointerId!==draggingPointer)return;
 sizeCodePanel(workspace.getBoundingClientRect().right-event.clientX-9);
});
function finishPanelResize(){if(draggingPointer===null)return;draggingPointer=null;document.body.classList.remove('is-resizing');sizeCodePanel(panelWidth,true)}
divider.addEventListener('pointerup',finishPanelResize);
divider.addEventListener('pointercancel',finishPanelResize);
divider.addEventListener('lostpointercapture',finishPanelResize);
divider.addEventListener('dblclick',()=>sizeCodePanel(320,true));
for(const eventName of ['keydown','keypress','keyup'])divider.addEventListener(eventName,event=>event.stopPropagation());
divider.addEventListener('keydown',event=>{
 const widths={ArrowLeft:panelWidth+24,ArrowRight:panelWidth-24,Home:260,End:680};
 if(event.key in widths){event.preventDefault();sizeCodePanel(widths[event.key],true)}
});
window.addEventListener('resize',()=>sizeCodePanel(panelWidth));
sizeCodePanel(panelWidth);

// Retain the app title when the emulated DOS program changes its caption.
const appTitle='Turbo C/C++ IDE';
new MutationObserver(()=>{if(document.title!==appTitle)document.title=appTitle}).observe(document.querySelector('title'),{childList:true,subtree:true,characterData:true});

// Physical Ctrl+F9 must follow the toolbar's safe Run-menu action.
// Never forward the raw chord while DOS switches into the user program.
let runShortcutHeld=false;
window.addEventListener('keydown',event=>{
 if(!event.isTrusted||!ci||!(event.ctrlKey||event.metaKey)||event.altKey||!(event.key==='F9'||event.code==='F9'||event.keyCode===120))return;
 event.preventDefault();event.stopImmediatePropagation();
 if(runShortcutHeld||event.repeat)return;
 runShortcutHeld=true;
 for(const modifier of [16,17,18,91,93])ci.simulateKeyEvent(modifier,false);
 void runProgram().catch(error=>say('Run failed: '+error.message));
},true);
window.addEventListener('keyup',event=>{
 if(!event.isTrusted||!runShortcutHeld||!(event.key==='F9'||event.code==='F9'||event.keyCode===120))return;
 event.preventDefault();event.stopImmediatePropagation();runShortcutHeld=false;
},true);
window.addEventListener('blur',()=>{runShortcutHeld=false});
