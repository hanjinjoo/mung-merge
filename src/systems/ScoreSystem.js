import { stageById } from '../data/stages.js';
import { readProgress,saveProgress } from '../storage.js';
export class ScoreSystem {
  constructor(){this.current=0;this.resetCombo();Object.assign(this,readProgress());}
  resetCombo(){this.comboCount=0;this.lastMergeTime=0;}
  expireCombo(now){if(this.comboCount&&now-this.lastMergeTime>1200){this.resetCombo();return true;}return false;}
  award(stageId,now=performance.now()){
    this.comboCount=this.comboCount>0&&now-this.lastMergeTime<=1200?this.comboCount+1:1;
    this.lastMergeTime=now;
    const multiplier=[1,1.2,1.5,2,2.5][Math.min(this.comboCount,5)-1];
    const points=Math.round(stageById(stageId).scoreOnMerge*multiplier);
    this.current+=points;
    this.bestScore=Math.max(this.bestScore,this.current);
    if(stageById(stageId).nextId===8)this.finalStageUnlocked=true;
    saveProgress(this.bestScore,this.finalStageUnlocked);
    return {points,multiplier,comboCount:this.comboCount};
  }
}
