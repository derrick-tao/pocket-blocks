// CSS-pixel gesture rules; this module has no timers, DOM, or game mutations.
export const TOUCH_RULES=Object.freeze({tapMs:250,doubleMs:240,slopPx:8,slopCells:.35,doublePx:18,doubleCells:.9,dominance:1.35,upPx:24,upCells:1.25,flickMs:180,flickCells:2.5,flickSpeedCells:.025,flickDominance:2,frameMoves:4,releaseMoves:10,releaseDown:20});
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const inside=(p,r)=>p.x>=r.left&&p.x<r.left+r.width&&p.y>=r.top&&p.y<r.top+r.height;
export class DirectRecognizer {
  constructor({snapshot,emit}){this.snapshot=snapshot;this.emit=emit;this.gesture=null;this.pending=null;this.clock=-Infinity;}
  time(now){if(!Number.isFinite(now)||now<this.clock)return false;this.clock=now;return true;}
  valid(token){const s=this.snapshot();return s.enabled&&s.token===token;}
  cancel(){this.gesture=null;this.pending=null;}
  action(action,token){if(!this.valid(token)){this.cancel();return false;}const accepted=this.emit(action)!==false;if(!this.valid(token))this.cancel();return accepted;}
  flushTap(now,force=false){
    if(!this.pending)return;
    if(!this.valid(this.pending.token)){this.pending=null;return;}
    if(this.gesture?.second)return;
    if(force||now>=this.pending.deadline){const pending=this.pending;this.pending=null;this.action('cw',pending.token);}
  }
  begin(point,now,rect){
    if(!finitePoint(point)||!this.time(now)||!rect||![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0||!inside(point,rect))return false;
    let s=this.snapshot();if(!s.enabled||!s.piece)return false;
    const c=rect.width/10;
    let second=false;
    if(this.pending){
      second=this.valid(this.pending.token)&&now<=this.pending.deadline&&Math.hypot(point.x-this.pending.point.x,point.y-this.pending.point.y)<=Math.max(TOUCH_RULES.doublePx,TOUCH_RULES.doubleCells*c);
      if(!second){this.flushTap(now,true);s=this.snapshot();if(!s.enabled||!s.piece)return false;}
    }
    this.gesture={token:s.token,piece:{...s.piece,cells:s.piece.cells.map(row=>[...row])},rect:{left:rect.left,top:rect.top,width:rect.width,height:rect.height},c,slop:Math.max(TOUCH_RULES.slopPx,TOUCH_RULES.slopCells*c),start:{...point},point:{...point},startTime:now,lastTime:now,maxTravel:0,mode:null,second,soft:false,usedX:0,usedY:0,sequence:0,processed:-1};
    return true;
  }
  move(point,now){
    if(!this.gesture||!finitePoint(point)||!this.time(now))return;
    const g=this.gesture;if(!this.valid(g.token)){this.cancel();return;}
    g.point={...point};g.lastTime=now;g.sequence++;
    const dx=point.x-g.start.x,dy=point.y-g.start.y;
    g.maxTravel=Math.max(g.maxTravel,Math.hypot(dx,dy));
    if(g.second&&g.maxTravel>g.slop){g.second=false;this.pending=null;}
    if(!g.mode&&g.maxTravel>g.slop){
      if(Math.abs(dx)>=Math.abs(dy)*TOUCH_RULES.dominance)g.mode='horizontal';
      else if(Math.abs(dy)>=Math.abs(dx)*TOUCH_RULES.dominance)g.mode=dy>0?'down':'up';
    }
    if(g.mode==='horizontal'&&Math.abs(dy)>Math.max(g.slop,Math.abs(dx)*TOUCH_RULES.dominance))g.mode='canceled';
    if((g.mode==='down'||g.mode==='up')&&Math.abs(dx)>Math.max(g.slop,Math.abs(dy)*TOUCH_RULES.dominance))g.mode='canceled';
    if(g.mode==='down'&&dy<-g.slop)g.mode='canceled';
    if(g.mode==='up'&&dy>g.slop)g.mode='canceled';
  }
  advance(now,{final=false}={}){
    if(!this.time(now))return;
    this.flushTap(now);
    const g=this.gesture;if(!g)return;
    if(!this.valid(g.token)){this.cancel();return;}
    const dx=g.point.x-g.start.x,dy=g.point.y-g.start.y;
    if(g.mode==='down'&&(now-g.startTime>TOUCH_RULES.flickMs||final))g.soft=true;
    if(g.processed===g.sequence)return;
    if(g.mode==='horizontal'){
      const units=dx/g.c,target=Math.trunc(units+Math.sign(units)*1e-6),limit=final?TOUCH_RULES.releaseMoves:TOUCH_RULES.frameMoves;
      for(let n=0;n<limit&&g.usedX!==target;n++){
        const direction=Math.sign(target-g.usedX);g.usedX+=direction;
        if(!this.action(direction<0?'left':'right',g.token)){g.usedX=target;break;}
        if(this.gesture!==g)return;
      }
      g.processed=g.sequence;
    }else if(g.mode==='down'&&g.soft){
      const target=Math.max(0,Math.floor(dy/g.c+1e-6)),limit=final?TOUCH_RULES.releaseDown:TOUCH_RULES.frameMoves;
      for(let n=0;n<limit&&g.usedY<target;n++){
        g.usedY++;
        if(!this.action('down',g.token))break;
        if(this.gesture!==g)return;
      }
      g.processed=g.sequence;
    }
  }
  end(point,now){
    const before=this.gesture;if(!before||!finitePoint(point)||!this.time(now)){this.cancel();return;}
    this.move(point,now);const g=this.gesture;if(!g)return;
    if(!inside(point,g.rect)||!this.valid(g.token)){this.cancel();return;}
    const dx=point.x-g.start.x,dy=point.y-g.start.y,elapsed=now-g.startTime;
    if(g.maxTravel<=g.slop&&elapsed<=TOUCH_RULES.tapMs){
      this.gesture=null;
      if(g.second&&this.pending){this.pending=null;this.action('ccw',g.token);return;}
      const col=Math.floor((g.start.x-g.rect.left)/g.c),row=Math.floor((g.start.y-g.rect.top)/g.c);
      if(g.piece.cells[row-g.piece.y]?.[col-g.piece.x]){this.pending={token:g.token,point:g.start,deadline:now+TOUCH_RULES.doubleMs};return;}
      const columns=[];g.piece.cells.forEach((line,y)=>line.forEach((cell,x)=>{if(cell&&g.piece.y+y>=0)columns.push(g.piece.x+x);}));
      if(columns.length){const center=g.rect.left+(Math.min(...columns)+Math.max(...columns)+1)*g.c/2;if(g.start.x<center-g.c*.25)this.action('left',g.token);else if(g.start.x>center+g.c*.25)this.action('right',g.token);}
      return;
    }
    if(g.second){this.pending=null;g.second=false;}
    if(g.mode==='down'&&!g.soft&&elapsed>0&&elapsed<=TOUCH_RULES.flickMs&&dy>=TOUCH_RULES.flickCells*g.c&&dy/elapsed>=TOUCH_RULES.flickSpeedCells*g.c&&dy>=TOUCH_RULES.flickDominance*Math.abs(dx)){
      this.gesture=null;this.pending=null;this.action('drop',g.token);return;
    }
    if(g.mode==='up'&&-dy>=Math.max(TOUCH_RULES.upPx,TOUCH_RULES.upCells*g.c)){
      this.gesture=null;this.pending=null;this.action('cw',g.token);return;
    }
    this.advance(now,{final:true});this.gesture=null;
  }
}
