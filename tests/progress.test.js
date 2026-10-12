import test from 'node:test';
import assert from 'node:assert/strict';
import { MergeSystem } from '../src/systems/MergeSystem.js';
import { ScoreSystem } from '../src/systems/ScoreSystem.js';
import { GameOverSystem } from '../src/systems/GameOverSystem.js';
const item=(id,y=140)=>({uniqueId:id,stageId:1,body:{position:{x:200,y}},spawnTime:0,removed:false,mergeLocked:false});
test('중복 충돌·반복 flush에도 성공한 합체당 점수 1회',()=>{
  const score=new ScoreSystem();const a=item(1),b=item(2);const merge=new MergeSystem({remove:()=>{},create:()=>{},onSuccess:id=>score.award(id)});
  merge.reserve(a,b,200);merge.reserve(b,a,200);merge.reserve(a,b,200);merge.flush(200);merge.flush(200);assert.equal(score.current,10);
});
test('단계별 점수와 최종 해금, 저장 접근 실패에도 진행',()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('저장 거부');}});
  const score=new ScoreSystem();const values=[10,20,40,80,160,320,1000];let total=0;
  values.forEach((value,i)=>{total+=value;score.award(i+1,i*1201);assert.equal(score.current,total);});assert.equal(score.finalStageUnlocked,true);
  assert.equal(new ScoreSystem().current,0);delete globalThis.localStorage;
});
test('상단 기준 1초 강조·1.5초 경고·2초 종료 및 내려오면 초기화',()=>{
  const danger=new GameOverSystem();const a=item(1,160);
  danger.update([a],1000,1000);assert.equal(danger.elapsed,1000);assert.equal(danger.over,false);
  a.body.position.y=180;danger.update([a],1100,100);assert.equal(danger.elapsed,0);
  a.body.position.y=160;danger.update([a],2600,1500);assert.equal(danger.elapsed,1500);assert.equal(danger.over,false);
  danger.update([a],3100,500);assert.equal(danger.over,true);
});
test('드롭 후 800ms 제외, 개체별 타이머·삭제된 개체 정리',()=>{
  const danger=new GameOverSystem();const a=item(1),b=item(2);a.dangerIgnoreUntil=800;
  danger.update([a],799,799);assert.equal(danger.elapsed,0);
  danger.update([a],900,100);assert.equal(danger.elapsed,100);
  danger.update([b],1900,1000);assert.equal(danger.elapsed,1000);assert.equal(danger.timers.has(1),false);assert.equal(danger.over,false);
});
