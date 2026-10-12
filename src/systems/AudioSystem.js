const audioUrl=name=>new URL(`../../assets/audio/${name}.mp3`,import.meta.url).href;
export const AUDIO_FILES={drop:audioUrl('drop'),collision:audioUrl('collision'),merge:audioUrl('merge'),big_merge:audioUrl('big_merge'),final:audioUrl('final'),gameover:audioUrl('gameover')};
export const AUDIO_VOLUMES={drop:.40,collision:.12,merge:.50,big_merge:.60,final:.68,gameover:.48};

// Phaser 사운드 매니저와 이중 재생되지 않도록 독립 Web Audio 경로 하나만 사용한다.
// 인스턴스와 DOM 리스너는 Scene이 아니라 Game 수명에 귀속된다.
export class AudioSystem {
  static forGame(game){
    let audio=game.registry.get('audioSystem');
    if(!audio){audio=new AudioSystem();game.registry.set('audioSystem',audio);game.events.once('destroy',()=>audio.destroy());}
    return audio;
  }
  constructor(){
    this.enabled=true;try{this.enabled=localStorage.getItem('soundEnabled')!=='false';}catch{}
    this.context=null;this.master=null;this.raw=new Map();this.buffers=new Map();this.decoding=new Map();this.active=new Set();this.pending=new Set();
    this.epoch=0;this.gestureReceived=false;this.destroyed=false;this.paused=false;this.gameOver=false;this.gameOverSoundPlayed=false;this.finalEvents=new Set();this.finalPriorityUntil=0;
    this.lastCollisionSoundTime=-Infinity;this.pairs=new Map();this.counts={drop:0,collision:0,merge:0,big_merge:0,final:0,gameover:0};this.unlockCount=0;this.preloadPromise=null;
    this.debug=new URLSearchParams(location.search).get('debug')==='true';
    this.button=document.querySelector('#sound-toggle');this.syncButton();
    this.onGesture=event=>{if(event.isTrusted&&!event.repeat)this.unlock();};
    this.pointerEvent='PointerEvent' in window?'pointerdown':'touchstart';
    document.addEventListener(this.pointerEvent,this.onGesture,{capture:true,passive:true});
    document.addEventListener('keydown',this.onGesture,true);
    this.blockPointer=event=>event.stopPropagation();
    this.onToggle=event=>{event.stopPropagation();this.setMuted(this.enabled);};
    this.button?.addEventListener('pointerdown',this.blockPointer);this.button?.addEventListener('pointerup',this.blockPointer);this.button?.addEventListener('click',this.onToggle);
    this.onVisibility=()=>{if(document.hidden){this.stopAll();}};
    document.addEventListener('visibilitychange',this.onVisibility);
  }
  warn(message){if(this.debug)console.warn(`[사운드] ${message}`);}
  preload(){
    if(this.preloadPromise)return this.preloadPromise;
    // 오디오 누락이나 네트워크 지연이 이미지 로더와 게임 시작을 막지 않는다.
    this.preloadPromise=Promise.all(Object.entries(AUDIO_FILES).map(async([key,url])=>{
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),5000);
      try{const response=await fetch(url,{signal:controller.signal});if(!response.ok)return;
        const bytes=await response.arrayBuffer();if(this.destroyed)return;this.raw.set(key,bytes);if(this.context)await this.decode(key);
      }catch{this.warn(`${key} 불러오기 생략`);}finally{clearTimeout(timeout);}
    }));return this.preloadPromise;
  }
  decode(key){
    if(this.decoding.has(key))return this.decoding.get(key);
    if(!this.context||!this.raw.has(key))return Promise.resolve(null);
    const promise=Promise.resolve().then(()=>this.context.decodeAudioData(this.raw.get(key).slice(0))).then(buffer=>{if(!this.destroyed)this.buffers.set(key,buffer);return buffer;}).catch(()=>{this.warn(`${key} 디코딩 생략`);return null;});
    this.decoding.set(key,promise);return promise;
  }
  unlock(){
    if(this.destroyed)return;
    try{
      if(!this.gestureReceived){this.gestureReceived=true;this.unlockCount++;}
      if(!this.context){
        const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
        this.context=new Context();this.master=this.context.createGain();this.master.gain.value=this.enabled ? 0.6 : 0;this.master.connect(this.context.destination);
        for(const key of this.raw.keys())this.decode(key);
      }
      if(this.context.state!=='running'&&!this.resumePromise){this.resumePromise=this.context.resume().catch(()=>this.warn('오디오 활성화 생략')).finally(()=>{this.resumePromise=null;});}
    }catch{this.warn('오디오 초기화 생략');}
  }
  syncButton(){if(this.button){this.button.textContent=this.enabled?'🔊 소리 켬':'🔇 소리 끔';this.button.setAttribute('aria-pressed',String(this.enabled));this.button.setAttribute('aria-label',this.enabled?'사운드 끄기':'사운드 켜기');}}
  setMuted(muted){
    this.enabled=!muted;
    try{localStorage.setItem('soundEnabled',String(this.enabled));}catch{}
    try{if(this.master)this.master.gain.setValueAtTime(this.enabled ? 0.6 : 0,this.context.currentTime);}catch{}
    if(muted)this.stopAll();this.syncButton();
  }
  canPlay(key){return !this.destroyed&&this.enabled&&this.gestureReceived&&!this.paused&&!document.hidden&&(!this.gameOver||key==='gameover');}
  play(key,{defer=true}={}){
    if(key!=='final'&&key!=='gameover'&&performance.now()<(this.finalPriorityUntil??0))return false;
    if(!this.canPlay(key)||!this.context||!this.master||!Object.hasOwn(AUDIO_VOLUMES,key))return false;
    const buffer=this.buffers.get(key);
    if(!buffer){
      // 첫 입력에서 디코딩 중인 음은 짧게만 기다린다. 과거 소리를 몰아서 재생하지 않는다.
      if(defer&&this.raw.has(key)&&this.pending.size<8){const token={epoch:this.epoch,time:performance.now()};this.pending.add(token);this.decode(key).then(()=>{this.pending.delete(token);if(token.epoch===this.epoch&&performance.now()-token.time<150)this.play(key,{defer:false});}).catch(()=>{});}
      return false;
    }
    let voice;
    try{
      // 동시 합체 음은 최대6개로 제한하며 가장 오래된 음을 교체한다.
      if(this.active.size>=6)this.stopVoice(this.active.values().next().value);
      if(key==='collision'&&[...this.active].some(v=>v.key==='collision'))return false;
      const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=AUDIO_VOLUMES[key];source.connect(gain);gain.connect(this.master);
      voice={source,gain,key};source.onended=()=>this.releaseVoice(voice);this.active.add(voice);source.start();this.counts[key]++;return true;
    }catch{if(voice)this.releaseVoice(voice);this.warn(`${key} 재생 생략`);return false;}
  }
  releaseVoice(voice){this.active.delete(voice);try{voice.source.disconnect();voice.gain.disconnect();}catch{}}
  stopVoice(voice){try{voice.source.stop();}catch{}this.releaseVoice(voice);}
  stopAll(){this.epoch++;this.pending.clear();this.finalPriorityUntil=0;for(const voice of [...this.active])this.stopVoice(voice);}
  playDrop(){return this.play('drop');}
  playCollision(speed,pairId,now=performance.now()){
    if(speed<3||now-this.lastCollisionSoundTime<120||now-(this.pairs.get(pairId)??-Infinity)<300||!this.canPlay('collision'))return false;
    if(!this.play('collision',{defer:false}))return false;
    this.lastCollisionSoundTime=now;this.pairs.set(pairId,now);
    if(this.pairs.size>256)for(const [id,time] of this.pairs)if(now-time>1000)this.pairs.delete(id);
    return true;
  }
  playMerge(resultStage,eventId){return resultStage===8?this.playFinal(eventId):this.play(resultStage>=6?'big_merge':'merge');}
  playFinal(eventId){
    if(eventId!==undefined){if(this.finalEvents.has(eventId))return false;this.finalEvents.add(eventId);}
    if(!this.canPlay('final'))return false;
    this.stopAll();this.finalPriorityUntil=performance.now()+600;return this.play('final');
  }
  playGameOver(){if(this.gameOverSoundPlayed)return false;this.gameOverSoundPlayed=true;this.gameOver=true;this.stopAll();return this.play('gameover');}
  setPaused(paused){this.paused=paused;if(paused)this.stopAll();}
  resetRound(){this.stopAll();this.finalEvents?.clear();this.gameOver=false;this.gameOverSoundPlayed=false;this.paused=false;this.lastCollisionSoundTime=-Infinity;this.pairs.clear();}
  status(){return {soundEnabled:this.enabled,context:this.context?.state??'입력 대기',loaded:this.buffers.size,downloaded:this.raw.size,lastCollisionSoundTime:this.lastCollisionSoundTime,active:this.active.size,unlocks:this.unlockCount};}
  destroy(){this.destroyed=true;this.stopAll();document.removeEventListener(this.pointerEvent,this.onGesture,true);document.removeEventListener('keydown',this.onGesture,true);document.removeEventListener('visibilitychange',this.onVisibility);this.button?.removeEventListener('pointerdown',this.blockPointer);this.button?.removeEventListener('pointerup',this.blockPointer);this.button?.removeEventListener('click',this.onToggle);try{this.context?.close().catch(()=>{});}catch{}this.raw.clear();this.buffers.clear();}
}
