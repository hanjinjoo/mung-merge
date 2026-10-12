import { STAGES } from '../data/stages.js';
export class SpawnSystem {
  constructor(random=Math.random) { this.random=random; this.bag=[]; this.current=this.draw(); this.next=this.draw(); }
  draw() {
    if(!this.bag.length) {
      this.bag=STAGES.flatMap(stage=>Array(stage.bagCount).fill(stage.id));
      for(let i=this.bag.length-1;i>0;i--) { const j=Math.floor(this.random()*(i+1)); [this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]]; }
    }
    return this.bag.pop();
  }
  advance() { this.current=this.next; this.next=this.draw(); }
}
