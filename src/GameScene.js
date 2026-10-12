import Phaser from 'phaser';
import { STAGES,stageById } from './data/stages.js';
import { FIELD as F,DROP_COOLDOWN,FRESH_TIME,STEP,MAX_OBJECTS,clamp } from './constants.js';
import { SpawnSystem } from './systems/SpawnSystem.js';
import { MergeSystem } from './systems/MergeSystem.js';
import { ScoreSystem } from './systems/ScoreSystem.js';
import { GameOverSystem } from './systems/GameOverSystem.js';
import { EffectSystem } from './systems/EffectSystem.js';
import { AudioSystem } from './systems/AudioSystem.js';
export class GameScene extends Phaser.Scene {
  constructor(){super('Game');}
  preload(){
    this.audioSystem=AudioSystem.forGame(this.game);this.audioSystem.preload();
    this.assetError=false;
    if(this.onLoadError)this.load.off('loaderror',this.onLoadError);
    this.onLoadError=file=>{document.querySelector('#status').textContent=`이미지 로드 실패: ${file.key}. 새로고침해 주세요.`;this.assetError=true;};
    this.load.on('loaderror',this.onLoadError);
    for(const stage of STAGES)this.load.image(stage.key,stage.image);
  }
  create(){
    if(this.assetError)return;
    this.objects=new Map();this.serial=0;this.simTime=0;this.accumulator=0;this.cooldown=0;this.aimX=210;this.heldPointer=null;this.hitStopRemaining=0;
    this.spawn=new SpawnSystem();
    this.audioSystem.resetRound();
    this.gameOver=false;this.highestStage=1;this.score=new ScoreSystem();this.danger=new GameOverSystem();
    document.querySelector('#result').close();this.updateScoreUI();
    this.game.canvas.tabIndex=0;this.game.canvas.focus({preventScroll:true});
    this.effects=new EffectSystem(this);
    this.merge=new MergeSystem({remove:item=>this.removeCharacter(item),create:(...args)=>this.createCharacter(...args),onSuccess:(id,item)=>{const reward=this.score.award(id,this.simTime);this.audioSystem.playMerge(stageById(id).nextId,item.uniqueId);this.updateScoreUI();return reward;},mergeDelay:60,onBegin:(...args)=>this.effects.beginMerge(...args),onComplete:(...args)=>this.effects.appear(...args)});
    this.matter.world.autoUpdate=false;
    this.matter.add.rectangle(-14,220,60,900,{isStatic:true});
    this.matter.add.rectangle(434,220,60,900,{isStatic:true});
    this.matter.add.rectangle(210,608,500,60,{isStatic:true});
    const g=this.add.graphics();
    g.fillStyle(0xf0f3e6).fillRoundedRect(16,12,388,55,15);
    g.lineStyle(2,0xd6dfc5).strokeRoundedRect(15,78,390,501,15);
    g.fillStyle(0xdce5cd).fillRoundedRect(16,578,388,10,4);
    this.dangerLine=this.add.graphics();
    this.warning=this.label(210,169,'위험해요! 아래로 내려야 해요',12,'#b74c35').setOrigin(.5,0).setVisible(false);
    this.label(30,27,'같은 친구를 만나게 해주세요',13,'#536349');
    this.label(308,21,'NEXT',9,'#7b876b');
    this.label(29,155,'위험선',9,'#bb9278');
    this.guide=this.add.graphics();
    this.preview=this.add.image(this.aimX,F.spawnY,'stage1');
    this.nextImage=this.add.image(372,39,'stage1');
    this.syncPreview();
    const collision=event=>{if(this.gameOver)return;for(const pair of event.pairs)this.merge.reserve(this.objects.get(pair.bodyA.id),this.objects.get(pair.bodyB.id),this.simTime);};
    this.matter.world.on('collisionstart',collision);
    this.matter.world.on('collisionactive',collision);
    // 충돌 해결 후 속도는 작아지므로 스텝 시작 시 속도를 저장한다.
    const impact=event=>{for(const pair of event.pairs){
      const a=this.objects.get(pair.bodyA.id),b=this.objects.get(pair.bodyB.id);
      const av=a?.impactVelocity??{x:0,y:0},bv=b?.impactVelocity??{x:0,y:0};
      const speed=Math.abs((av.x-bv.x)*pair.collision.normal.x+(av.y-bv.y)*pair.collision.normal.y);
      this.effects.impact(a,speed,this.simTime);this.effects.impact(b,speed,this.simTime);
      if(!a?.mergeLocked&&!b?.mergeLocked)this.audioSystem.playCollision(speed,[pair.bodyA.id,pair.bodyB.id].sort((x,y)=>x-y).join(':'));
    }};
    this.matter.world.on('collisionstart',impact);
    const down=p=>{if(!this.gameOver&&p.y>=78&&p.y<F.floor&&this.heldPointer===null){this.heldPointer=p.id;this.moveAim(p.x);}};
    const move=p=>{if(!p.wasTouch||this.heldPointer===p.id)this.moveAim(p.x);};
    const up=p=>{if(this.heldPointer!==p.id)return;this.heldPointer=null;if(p.y>=78&&p.y<F.floor){this.moveAim(p.x);this.drop();}};
    const cancel=()=>{this.heldPointer=null;};
    this.input.on('pointerdown',down);this.input.on('pointermove',move);this.input.on('pointerup',up);this.input.on('pointerupoutside',cancel);
    this.game.canvas.addEventListener('pointercancel',cancel);
    const blur=()=>{cancel();this.accumulator=0;};
    this.game.events.on('blur',blur);
    this.keys=this.input.keyboard.addKeys('LEFT,RIGHT,A,D,SPACE');
    const keyboard=this.input.keyboard;
    const space=event=>{if(!event.repeat&&document.activeElement===this.game.canvas)this.drop();};
    keyboard.on('keydown-SPACE',space);
    const reset=()=>this.scene.restart();
    const world=this.matter.world;
    document.querySelector('#reset').addEventListener('click',reset);
    document.querySelector('#result-reset').addEventListener('click',reset);
    const pauseAudio=()=>this.audioSystem.setPaused(true),resumeAudio=()=>this.audioSystem.setPaused(false);
    this.events.on('pause',pauseAudio);this.events.on('resume',resumeAudio);
    const preventClose=e=>e.preventDefault();document.querySelector('#result').addEventListener('cancel',preventClose);
    this.events.once('shutdown',()=>{
      document.querySelector('#reset').removeEventListener('click',reset);
      document.querySelector('#result-reset').removeEventListener('click',reset);
      document.querySelector('#result').removeEventListener('cancel',preventClose);
      this.game.canvas.removeEventListener('pointercancel',cancel);this.game.events.off('blur',blur);
      this.input.off('pointerdown',down);this.input.off('pointermove',move);this.input.off('pointerup',up);this.input.off('pointerupoutside',cancel);
      world.off('collisionstart',collision);world.off('collisionactive',collision);
      world.off('collisionstart',impact);
      keyboard.off('keydown-SPACE',space);
      this.events.off('pause',pauseAudio);this.events.off('resume',resumeAudio);this.audioSystem.stopAll();
      this.merge.cancel();this.effects.stop();this.objects.clear();
      if(window.debugSpawnStage===debugSpawn)delete window.debugSpawnStage;
    });
    document.querySelector('#status').textContent='원하는 곳으로 움직이고, 놓아주세요.';
    this.debugMode=new URLSearchParams(location.search).get('debug')==='true';
    const debugSpawn=(stageId,x=210,y=350)=>{
      if(!this.debugMode||this.gameOver||!Number.isInteger(stageId)||!stageById(stageId)||!Number.isFinite(x)||!Number.isFinite(y)||this.objects.size>=MAX_OBJECTS)return null;
      const r=stageById(stageId).radius;return this.createCharacter(stageId,clamp(x,F.left+r,F.right-r),clamp(y,r,F.floor-r));
    };
    if(this.debugMode)window.debugSpawnStage=debugSpawn;
    if(this.debugMode)this.debugLabel=this.label(25,555,'',10,'#60704f').setDepth(100);
    if(this.debugMode)this.audioDebugLabel=this.label(25,535,'',9,'#60704f').setDepth(100);
  }
  label(x,y,text,size,color){return this.add.text(x,y,text,{fontFamily:'Malgun Gothic, sans-serif',fontSize:`${size}px`,color});}
  fit(image,id,maxSize){const source=this.textures.get(stageById(id).key).getSourceImage();image.setTexture(stageById(id).key).setScale(maxSize/Math.max(source.width,source.height));}
  syncPreview(){const s=stageById(this.spawn.current);this.fit(this.preview,s.id,s.radius*2*s.spriteScale);this.fit(this.nextImage,this.spawn.next,38);this.moveAim(this.aimX);}
  moveAim(x){if(this.gameOver)return;const r=stageById(this.spawn.current).radius;this.aimX=clamp(x,F.left+r,F.right-r);this.preview.x=this.aimX;}
  createCharacter(stageId,x,y,now=this.simTime){
    const stage=stageById(stageId);
    const body=this.matter.add.circle(x,y,stage.radius,{restitution:0.1,friction:0.06,frictionAir:0.012,density:0.001+stageId*0.00005,sleepThreshold:60});
    const sprite=this.add.image(x,y,stage.key);this.fit(sprite,stageId,stage.radius*2*stage.spriteScale);
    const item={uniqueId:++this.serial,stageId,mergeLocked:false,removed:false,spawnTime:now,isFresh:true,body,sprite,baseScale:sprite.scaleX,visual:{sx:1,sy:1,pull:0},isAnimating:false,lastSquashTime:-Infinity};
    this.highestStage=Math.max(this.highestStage,stageId);this.objects.set(body.id,item);return item;
  }
  removeCharacter(item){item.removed=true;this.effects.remove(item);this.objects.delete(item.body.id);this.matter.world.remove(item.body);item.sprite.destroy();}
  drop(){
    if(this.gameOver||this.hitStopRemaining>0||this.cooldown>0)return false;
    if(this.objects.size>=MAX_OBJECTS){document.querySelector('#status').textContent='필드가 가득 찼어요. 다시 하기로 새로 시작해 주세요.';return false;}
    const radius=stageById(this.spawn.current).radius;
    const blocked=[...this.objects.values()].some(o=>Math.hypot(o.body.position.x-this.aimX,o.body.position.y-F.spawnY)<radius+stageById(o.stageId).radius);
    if(blocked){document.querySelector('#status').textContent='이곳은 꽉 찼어요. 옆으로 이동해서 놓아주세요.';return false;}
    const dropped=this.createCharacter(this.spawn.current,this.aimX,F.spawnY);dropped.dangerIgnoreUntil=this.simTime+800;this.spawn.advance();this.cooldown=DROP_COOLDOWN;this.syncPreview();this.preview.setVisible(false);
    this.audioSystem.playDrop();
    document.querySelector('#status').textContent='같은 친구끼리 닿으면 합쳐져요.';return true;
  }
  update(time,delta){
    if(!this.objects||this.gameOver)return;
    if(this.hitStopRemaining>0){this.hitStopRemaining=Math.max(0,this.hitStopRemaining-delta);this.accumulator=0;return;}
    this.cooldown=Math.max(0,this.cooldown-delta);
    this.preview.setVisible(this.cooldown===0);
    const direction=(this.keys.RIGHT.isDown||this.keys.D.isDown?1:0)-(this.keys.LEFT.isDown||this.keys.A.isDown?1:0);
    if(direction)this.moveAim(this.aimX+direction*Math.min(delta,50)*0.3);
    this.accumulator+=Math.min(delta,100);
    while(this.accumulator>=STEP){
      this.simTime+=STEP;
      for(const item of this.objects.values())item.impactVelocity={...item.body.velocity};
      this.matter.world.step(STEP);
      this.merge.flush(this.simTime);
      if(this.score.expireCombo(this.simTime))this.effects.hideCombo();
      for(const item of this.objects.values()){
        item.isFresh=this.simTime-item.spawnTime<FRESH_TIME;
        const body=item.body;
        if(Math.abs(body.angularVelocity)>0.1)this.matter.body.setAngularVelocity(body,clamp(body.angularVelocity,-0.1,0.1));
      }
      this.accumulator-=STEP;
      this.danger.update(this.objects.values(),this.simTime,STEP);
      if(this.danger.over){this.finishGame();break;}
      if(this.hitStopRemaining>0){this.accumulator=0;break;}
    }
    for(const item of this.objects.values())this.effects.render(item);
    this.guide.clear();
    if(!this.cooldown&&!this.gameOver){this.guide.lineStyle(1,0x92a47f,0.25);for(let y=130;y<F.floor;y+=12)this.guide.lineBetween(this.aimX,y,this.aimX,y+5);}
    this.dangerLine.clear().lineStyle(this.danger.elapsed>=1000?3:1,this.danger.elapsed>=1000?0xc85b42:0xd39f84,0.85);
    for(let x=26;x<398;x+=12)this.dangerLine.lineBetween(x,F.danger,x+6,F.danger);
    this.warning.setVisible(this.danger.elapsed>=1500);
    if(this.debugLabel)this.debugLabel.setText(`개체 ${this.objects.size} · ${Math.round(this.game.loop.actualFps)} FPS · 잠금 ${[...this.objects.values()].filter(o=>o.mergeLocked).length}`);
    if(this.audioDebugLabel){const audio=this.audioSystem.status();this.audioDebugLabel.setText(`소리 ${audio.soundEnabled?'켬':'끔'} · ${audio.context} · 음원 ${audio.loaded}/6`);}
  }
  updateScoreUI(){document.querySelector('#score').textContent=this.score.current.toLocaleString('ko-KR');document.querySelector('#best').textContent=this.score.bestScore.toLocaleString('ko-KR');}
  finishGame(){
    if(this.gameOver)return;
    this.gameOver=true;this.heldPointer=null;this.accumulator=0;this.matter.world.pause();this.preview.setVisible(false);this.guide.clear();
    this.merge.cancel();this.effects.stop(this.objects.values());
    this.score.resetCombo();
    this.hitStopRemaining=0;
    this.audioSystem.playGameOver();
    document.querySelector('#result-score').textContent=this.score.current.toLocaleString('ko-KR');
    document.querySelector('#result-best').textContent=this.score.bestScore.toLocaleString('ko-KR');
    document.querySelector('#result-stage').textContent=`${this.highestStage}단계`;
    document.querySelector('#status').textContent='게임이 끝났어요. 다시 도전해 보세요.';
    document.querySelector('#result').showModal();document.querySelector('#result-reset').focus();
  }
}
