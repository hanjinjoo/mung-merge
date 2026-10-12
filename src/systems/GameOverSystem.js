import { FIELD } from '../constants.js';
import { stageById } from '../data/stages.js';
export class GameOverSystem {
  constructor(){this.timers=new Map();this.elapsed=0;this.over=false;}
  update(objects,now,delta){
    if(this.over)return;
    const alive=new Set();this.elapsed=0;
    for(const item of objects){
      if(item.removed)continue;
      alive.add(item.uniqueId);
      const top=item.body.position.y-stageById(item.stageId).radius;
      const eligible=now>=(item.dangerIgnoreUntil??0);
      const activeDelta=Math.min(delta,Math.max(0,now-(item.dangerIgnoreUntil??0)));
      const duration=eligible&&top<FIELD.danger?(this.timers.get(item.uniqueId)??0)+activeDelta:0;
      this.timers.set(item.uniqueId,duration);this.elapsed=Math.max(this.elapsed,duration);
    }
    for(const id of this.timers.keys())if(!alive.has(id))this.timers.delete(id);
    this.over=this.elapsed>=2000;
  }
}
