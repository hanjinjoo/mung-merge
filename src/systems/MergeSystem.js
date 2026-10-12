import { stageById } from '../data/stages.js';
import { FIELD, FRESH_TIME, clamp } from '../constants.js';
export class MergeSystem {
  constructor({remove,create,onSuccess=()=>{},onBegin=()=>{},onComplete=()=>{},mergeDelay=0}) {
    Object.assign(this,{remove,create,onSuccess,onBegin,onComplete,mergeDelay});this.queue=[];this.presentationFailures=0;
  }
  present(callback,...args){try{callback(...args);}catch{this.presentationFailures++;}}
  reserve(a,b,now) {
    if(!a||!b||a===b||a.removed||b.removed||a.mergeLocked||b.mergeLocked||a.stageId!==b.stageId) return false;
    const nextId=stageById(a.stageId)?.nextId;
    if(!nextId||now-a.spawnTime<FRESH_TIME||now-b.spawnTime<FRESH_TIME) return false;
    // 충돌 이벤트 안에서는 잠금만 수행한다. 바디 변경은 물리 스텝 이후에 처리한다.
    a.mergeLocked=b.mergeLocked=true;
    this.queue.push({a,b,nextId});
    return true;
  }
  flush(now) {
    const pending=this.queue.splice(0);
    for(const entry of pending) {
      const {a,b,nextId}=entry;
      if(a.removed||b.removed) { if(!a.removed)a.mergeLocked=false; if(!b.removed)b.mergeLocked=false; continue; }
      const radius=stageById(nextId).radius;
      const x=clamp((a.body.position.x+b.body.position.x)/2,FIELD.left+radius,FIELD.right-radius);
      const y=Math.min((a.body.position.y+b.body.position.y)/2,FIELD.floor-radius);
      if(entry.readyAt===undefined){entry.readyAt=now+this.mergeDelay;this.present(this.onBegin,a,b,{x,y});}
      if(now<entry.readyAt){this.queue.push(entry);continue;}
      a.removed=b.removed=true;
      this.remove(a); this.remove(b);
      const created=this.create(nextId,x,y,now);
      // 생성이 끝난 성공 경로에서만 한 번 지급한다.
      const reward=this.onSuccess(a.stageId,created);
      // 표시 실패와 실제 점수 지급을 분리한다.
      this.present(this.onComplete,created,a.stageId,{x,y},reward);
    }
  }
  cancel(){for(const {a,b} of this.queue){if(!a.removed)a.mergeLocked=false;if(!b.removed)b.mergeLocked=false;}this.queue.length=0;}
}
