import {DirectRecognizer} from './direct-touch.js';
export function initDirectTouch({board,snapshot,emit,beginInput}){
  const recognizer=new DirectRecognizer({snapshot,emit}),pointers=new Set();
  let owner=null,blocked=false;
  const isTouch=event=>event.pointerType==='touch'||event.pointerType==='pen';
  const point=event=>({x:event.clientX,y:event.clientY});
  // Keep native touch's fling/click-suppression path out of matrix gestures.
  // Pointer cancellation alone does not suppress that legacy path in Chromium.
  board.addEventListener('touchstart',event=>{if(snapshot().enabled)event.preventDefault();},{passive:false});
  function cancel(suppress=false){
    recognizer.cancel();owner=null;blocked=suppress;
    const ids=[...pointers];if(!suppress)pointers.clear();
    for(const id of ids)try{if(board.hasPointerCapture(id))board.releasePointerCapture(id);}catch{}
  }
  board.addEventListener('pointerdown',event=>{
    if(!isTouch(event)||event.button!==0||!snapshot().enabled)return;
    event.preventDefault();
    if(pointers.size||blocked||event.isPrimary===false){recognizer.cancel();owner=null;blocked=true;if(pointers.size<10)pointers.add(event.pointerId);try{board.setPointerCapture(event.pointerId);}catch{}return;}
    beginInput();
    try{board.setPointerCapture(event.pointerId);}catch{cancel();return;}
    const rect=board.getBoundingClientRect();
    if(!recognizer.begin(point(event),performance.now(),rect)){try{board.releasePointerCapture(event.pointerId);}catch{}return;}
    pointers.add(event.pointerId);owner=event.pointerId;
  });
  window.addEventListener('pointerdown',event=>{if(pointers.size&&isTouch(event)&&event.target!==board)cancel(true);},true);
  window.addEventListener('pointermove',event=>{
    if(event.pointerId!==owner||blocked)return;
    if(!snapshot().enabled||!board.hasPointerCapture(owner)||(event.pointerType!=='touch'&&!(event.buttons&1))){cancel(true);return;}
    recognizer.move(point(event),performance.now());
  },true);
  window.addEventListener('pointerup',event=>{
    if(!pointers.has(event.pointerId))return;
    if(event.pointerId===owner&&!blocked)recognizer.end(point(event),performance.now());
    pointers.delete(event.pointerId);if(event.pointerId===owner)owner=null;
    if(!pointers.size)blocked=false;
  },true);
  for(const type of ['pointercancel','lostpointercapture'])window.addEventListener(type,event=>{if(pointers.has(event.pointerId)){if(!blocked)cancel(true);if(type==='pointercancel'){pointers.delete(event.pointerId);if(!pointers.size)blocked=false;}}},true);
  window.addEventListener('touchend',event=>{if(event.touches?.length===0){if(pointers.size)cancel();blocked=false;}},{capture:true,passive:true});
  window.addEventListener('touchcancel',()=>cancel(),{capture:true,passive:true});
  return {cancel,advance(now){if(owner!==null&&!board.hasPointerCapture(owner)){cancel(true);return;}recognizer.advance(now);}};
}
