import { FIELD } from '../constants.js';
import { stageById } from '../data/stages.js';

// 물리 바디는 건드리지 않는다. visual 상태와 장식 오브젝트만 변경한다.
export class EffectSystem {
  constructor(scene){this.scene=scene;this.tweens=new Set();this.decorations=new Set();this.stopped=false;this.peakDecorations=0;this.peakTweens=0;
    this.comboText=scene.add.text(165,55,'',{fontFamily:'Malgun Gothic, sans-serif',fontSize:'12px',fontStyle:'bold',color:'#647945'}).setOrigin(.5).setDepth(40).setVisible(false);
    this.finalItems=new WeakSet();this.finalCount=0;
    this.finalText=scene.add.text(210,210,'최종 진화!',{fontFamily:'Malgun Gothic, sans-serif',fontSize:'25px',fontStyle:'bold',color:'#9d7c32',stroke:'#fffdf7',strokeThickness:5}).setOrigin(.5).setDepth(45).setVisible(false);
  }
  hideCombo(){this.comboTween?.stop();this.comboTween=null;this.comboText.setVisible(false);}
  showCombo(reward){
    this.hideCombo();if(this.stopped||!reward||reward.comboCount<2)return;
    this.comboText.setText(`${reward.comboCount}연속! ×${reward.multiplier}`).setVisible(true).setAlpha(1).setScale(1.08);
    this.comboTween=this.tween({targets:this.comboText,scale:{value:1,duration:120},alpha:{value:0,delay:250,duration:300},onComplete:()=>{this.comboTween=null;this.comboText.setVisible(false);}});
  }
  tween(config){
    if(this.stopped)return null;
    const complete=config.onComplete;
    const tween=this.scene.tweens.add({...config,onComplete:()=>{this.tweens.delete(tween);complete?.();},onStop:()=>this.tweens.delete(tween)});
    this.tweens.add(tween);this.peakTweens=Math.max(this.peakTweens,this.tweens.size);return tween;
  }
  resetItem(item){
    item.visualTween?.stop();item.visualTween=null;
    Object.assign(item.visual,{sx:1,sy:1,pull:0});item.isAnimating=false;
  }
  beginMerge(a,b,center){
    for(const item of [a,b]){
      this.resetItem(item);item.isAnimating=true;item.visual.target=center;
      item.visualTween=this.tween({targets:item.visual,sx:.85,sy:.85,pull:.28,duration:60,ease:'Sine.Out'});
    }
  }
  appear(item,sourceId,center,reward){
    if(this.stopped||!item)return;
    if(item.stageId===8){if(this.finalItems.has(item))return;this.finalItems.add(item);}
    this.resetItem(item);item.isAnimating=true;item.visual.sx=item.visual.sy=.75;
    item.visualTween=this.tween({targets:item.visual,sx:1,sy:1,delay:item.stageId===8?80:0,duration:120,ease:'Back.Out',onComplete:()=>{item.visualTween=null;item.isAnimating=false;}});
    if(item.stageId===8)this.finalEvolution(center);else this.flash(center,sourceId);
    this.showCombo(reward);
    this.scorePopup(center,reward?.points??stageById(sourceId).scoreOnMerge);
    // 일반 고단계 흔들림은 최종 연출을 덮어쓰지 않는다.
    if(item.stageId===6||item.stageId===7){const pixels=item.stageId===6?2:3;this.scene.cameras.main.shake(item.stageId===6?70:80,{x:pixels/FIELD.width,y:pixels/FIELD.height},false);}
  }
  finalEvolution({x,y}){
    this.finalCount++;this.scene.hitStopRemaining=80;
    this.finalTween?.stop();this.finalText.setVisible(true).setAlpha(1).setScale(.94);
    this.finalTween=this.tween({targets:this.finalText,scale:{value:1.04,duration:160,ease:'Back.Out'},alpha:{value:0,delay:650,duration:300},onComplete:()=>{this.finalText.setVisible(false);this.finalTween=null;}});
    this.scene.cameras.main.shake(120,{x:4/FIELD.width,y:4/FIELD.height},true);
    // 화면 전체의 강한 섬광 대신 생성 위치 주변에 짧고 옅은 빛을 둔다.
    if(this.decorations.size+7>48)return;
    const glow=this.scene.add.circle(x,y,45,0xffe6a3,.25);
    this.decorate(glow,{scale:2,alpha:0,duration:220,ease:'Quad.Out'});
    for(let i=0;i<6;i++){
      const angle=i*Math.PI/3;
      const star=this.scene.add.star(x+Math.cos(angle)*35,y+Math.sin(angle)*35,4,2,6,0xd6b96a,.9);
      this.decorate(star,{x:Math.max(22,Math.min(398,x+Math.cos(angle)*95)),y:Math.min(570,y+Math.sin(angle)*95),angle:90,alpha:0,duration:400,ease:'Quad.Out'});
    }
  }
  impact(item,speed,now){
    if(this.stopped||!item||item.removed||item.mergeLocked||item.isAnimating||speed<3||now-(item.lastSquashTime??-Infinity)<140)return;
    item.lastSquashTime=now;item.isAnimating=true;
    item.visual.sx=1.06;item.visual.sy=.94;
    item.visualTween=this.tween({targets:item.visual,sx:1,sy:1,duration:110,ease:'Sine.Out',onComplete:()=>{item.visualTween=null;item.isAnimating=false;}});
  }
  decorate(object,config){
    object.setDepth(30);this.decorations.add(object);this.peakDecorations=Math.max(this.peakDecorations,this.decorations.size);
    this.tween({targets:object,...config,onComplete:()=>{this.decorations.delete(object);object.destroy();}});
  }
  flash({x,y},sourceId){
    const count=sourceId<=3?3:sourceId<=5?4:5;
    // 전체 장식 수를 제한해 동시 합체에서도 비용을 제한한다.
    if(this.decorations.size+count+1>48)return;
    const radius=sourceId<=3?14:sourceId<=5?20:26;
    const ring=this.scene.add.circle(x,y,7,0xffe4a0,.12).setStrokeStyle(2,0xd6b967,.7);
    this.decorate(ring,{scale:radius/7,alpha:0,duration:240,ease:'Quad.Out'});
    for(let i=0;i<count;i++){
      const angle=(i/count)*Math.PI*2-.7;
      const dot=this.scene.add.circle(x+Math.cos(angle)*7,y+Math.sin(angle)*7,2,0xc7ad66,.85);
      this.decorate(dot,{x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius,alpha:0,duration:280,ease:'Quad.Out'});
    }
  }
  scorePopup({x,y},score){
    if(this.decorations.size>=48)return;
    const text=this.scene.add.text(x,y-12,`+${score}`,{fontFamily:'Malgun Gothic, sans-serif',fontSize:'15px',fontStyle:'bold',color:'#6d8050',stroke:'#fffdf7',strokeThickness:3}).setOrigin(.5);
    this.decorate(text,{y:y-42,alpha:0,duration:600,ease:'Quad.Out'});
  }
  render(item){
    const {visual:v,body,sprite}=item;
    const x=body.position.x+(v.target?v.target.x-body.position.x:0)*v.pull;
    const y=body.position.y+(v.target?v.target.y-body.position.y:0)*v.pull;
    sprite.setPosition(x,y).setRotation(body.angle).setScale(item.baseScale*v.sx,item.baseScale*v.sy);
  }
  remove(item){this.resetItem(item);}
  stop(objects=[]){
    this.stopped=true;
    this.hideCombo();
    this.finalTween?.stop();this.finalTween=null;this.finalText.setVisible(false);this.scene.hitStopRemaining=0;
    for(const tween of [...this.tweens])tween.stop();this.tweens.clear();
    for(const object of this.decorations)object.destroy();this.decorations.clear();
    for(const item of objects){this.resetItem(item);this.render(item);}
    this.scene.cameras.main?.shakeEffect.reset();
  }
}
