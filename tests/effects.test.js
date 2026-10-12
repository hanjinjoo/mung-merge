import test from 'node:test';
import assert from 'node:assert/strict';
import { MergeSystem } from '../src/systems/MergeSystem.js';
const object=(stageId=1)=>({stageId,body:{position:{x:200,y:550}},spawnTime:0,removed:false,mergeLocked:false});
test('60ms 대기 동안 잠금, 생성 이후 점수 1회, 삭제된 충돌 무시',()=>{
  let starts=0,creates=0,scores=0;
  const merge=new MergeSystem({mergeDelay:60,remove:()=>{},create:()=>{creates++;},onBegin:()=>starts++,onSuccess:()=>scores++});
  const a=object(),b=object();merge.reserve(a,b,100);merge.flush(100);
  assert.equal(starts,1);assert.equal(creates,0);assert.equal(scores,0);
  assert.equal(merge.reserve(b,a,150),false);merge.flush(159);assert.equal(creates,0);
  merge.flush(160);merge.flush(180);assert.equal(creates,1);assert.equal(scores,1);assert.equal(merge.reserve(a,object(),200),false);
});
test('연출 또는 팝업 실패와 점수·생성 분리',()=>{
  let scores=0,creates=0;
  const merge=new MergeSystem({remove:()=>{},create:()=>creates++,onBegin:()=>{throw Error('연출 실패');},onComplete:()=>{throw Error('팝업 실패');},onSuccess:()=>scores++});
  merge.reserve(object(),object(),100);merge.flush(100);assert.equal(scores,1);assert.equal(creates,1);assert.equal(merge.presentationFailures,2);
});
test('게임오버·재시작 취소 시 예약 생성·지연 점수 없음',()=>{
  let scores=0;const a=object(),b=object();const merge=new MergeSystem({mergeDelay:60,remove:()=>{},create:()=>{},onSuccess:()=>scores++});
  merge.reserve(a,b,100);merge.flush(100);merge.cancel();merge.flush(1000);assert.equal(scores,0);assert.equal(a.mergeLocked,false);assert.equal(merge.queue.length,0);
});
