export function initOffline({pause,focusGame,isActive}) {
 const $=id=>document.getElementById(id);
 let ready=false,failed=false,registration=null,deferred=null,updating=false,attempt=0;
 function status(){
  $('offline-status').textContent=ready?(navigator.onLine?'Ready to play offline':'Offline · ready to play'):failed?'Offline download incomplete · retry':'Downloading offline play…';
  $('offline-detail').textContent=ready?'This browser has downloaded the complete game. You can reopen it without Wi-Fi. If you add it to the iOS Home Screen, open that installed app once online and wait for this message there too; Safari and Home Screen storage may be separate.':failed?'The download did not finish. Your existing scores and preferences are safe. Reconnect and choose Retry offline download.':'Keep this page open online until “Ready to play offline” appears. The first visit needs internet; installation is optional.';
  $('offline-retry').hidden=!failed;
 }
 function active(reg){if(reg.active)return Promise.resolve(reg.active);return new Promise((resolve,reject)=>{
  const worker=reg.installing||reg.waiting;if(!worker){reject(new Error('No download'));return;}
  const timer=setTimeout(()=>finish(new Error('Download timed out')),30000);
  function finish(error){clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve(reg.active||worker);}
  function check(){if(worker.state==='activated')finish();else if(worker.state==='redundant')finish(new Error('Download failed'));}
  worker.addEventListener('statechange',check);check();
 });}
 function cacheStatus(worker){return new Promise((resolve,reject)=>{const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();reject(new Error('Cache verification timed out'));},3000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.ready===true);};worker.postMessage({type:'CACHE_STATUS'},[channel.port2]);});}
 async function setup(){
  if(!('serviceWorker'in navigator)){failed=false;$('offline-status').textContent='Offline play is unavailable in this browser';return;}
  const current=++attempt;failed=false;status();
  try{
   registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
   const checkUpdate=()=>{$('update').hidden=!registration.waiting;};
   registration.onupdatefound=()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)checkUpdate();});};
   checkUpdate();const worker=await active(registration),complete=await cacheStatus(worker);if(current!==attempt)return;
   if(!complete)throw new Error('Cache incomplete');ready=true;failed=false;status();worker.postMessage({type:'CLEANUP'});
  }catch{if(current!==attempt)return;ready=false;failed=true;status();}
 }
 $('install').onclick=()=>{pause();$('install-dialog').showModal();};
 $('close-install').onclick=()=>$('install-dialog').close();$('install-dialog').addEventListener('close',focusGame);
 $('offline-retry').onclick=setup;
 window.addEventListener('online',status);window.addEventListener('offline',status);
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;$('install-prompt').hidden=false;});
 $('install-prompt').onclick=async()=>{if(!deferred)return;try{await deferred.prompt();await deferred.userChoice;}finally{deferred=null;$('install-prompt').hidden=true;}};
 window.addEventListener('appinstalled',()=>{deferred=null;$('install-prompt').hidden=true;});
 $('update').onclick=()=>{const confirmActive=isActive();pause();if(confirmActive&&!confirm('Update now? Your current game will restart. Your best score and options stay saved.'))return;updating=true;registration?.waiting?.postMessage({type:'ACTIVATE_UPDATE'});};
 navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(updating)location.reload();});
 // Safari exposes cancellable gesture events separately from Pointer Events. Do not cancel scrolling touchmoves.
 for(const type of ['gesturestart','gesturechange'])document.addEventListener(type,event=>{if(event.cancelable)event.preventDefault();},{passive:false});
 setup();
}
