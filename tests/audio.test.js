import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioSystem } from '../src/systems/AudioSystem.js';
function fixture(){
  globalThis.document={hidden:false};
  return Object.assign(Object.create(AudioSystem.prototype),{enabled:true,gestureReceived:true,paused:false,gameOver:false,destroyed:false,debug:false,master:{},active:new Set(),pending:new Set(),buffers:new Map([['drop',{}]]),raw:new Map(),counts:{drop:0},epoch:0,context:{createBufferSource:()=>({connect(){},disconnect(){},start(){throw Error('장치 오류');}}),createGain:()=>({gain:{},connect(){},disconnect(){}})}});
}
test('오디오 재생 장치 예외는 전파하지 않고 voice 참조 정리',()=>{const audio=fixture();assert.equal(audio.playDrop(),false);assert.equal(audio.counts.drop,0);assert.equal(audio.active.size,0);});
test('디코딩 대기 중 재시작하면 이전 음을 뒤늦게 재생하지 않음',async()=>{
  const audio=fixture();audio.buffers.clear();audio.raw.set('drop',{});let resolve;audio.decode=()=>new Promise(done=>{resolve=done;});audio.pairs=new Map();
  audio.playDrop();assert.equal(audio.pending.size,1);audio.resetRound();resolve({});await Promise.resolve();assert.equal(audio.pending.size,0);assert.equal(audio.counts.drop,0);
});
test('음소거·일시정지·게임오버·사용자 입력 전 재생 차단',()=>{
  for(const changed of [{enabled:false},{paused:true},{gameOver:true},{gestureReceived:false}]){const audio=Object.assign(fixture(),changed);assert.equal(audio.canPlay('drop'),false);}
});
