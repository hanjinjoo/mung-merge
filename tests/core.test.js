import test from 'node:test';
import assert from 'node:assert/strict';
import { SpawnSystem } from '../src/systems/SpawnSystem.js';
import { MergeSystem } from '../src/systems/MergeSystem.js';
import { FIELD } from '../src/constants.js';
function item(stageId,x=200,y=300){return {stageId,body:{position:{x,y}},spawnTime:0,mergeLocked:false,removed:false};}
function harness(){const removed=[],created=[];const system=new MergeSystem({remove:o=>removed.push(o),create:(...args)=>created.push(args)});return {system,removed,created};}
test('20개 bag마다 8:6:4:2 구성과 NEXT 일치',()=>{
  const spawn=new SpawnSystem();
  for(let bag=0;bag<20;bag++){
    const count=[0,0,0,0];
    for(let i=0;i<20;i++){count[spawn.current-1]++;const next=spawn.next;spawn.advance();assert.equal(spawn.current,next);}
    assert.deepEqual(count,[8,6,4,2]);
  }
});
test('모든 단계 1~7은 정확히 다음 단계 하나 생성',()=>{
  for(let stage=1;stage<=7;stage++){const {system,created,removed}=harness();assert.ok(system.reserve(item(stage),item(stage),200));system.flush(200);assert.equal(created.length,1);assert.equal(created[0][0],stage+1);assert.equal(removed.length,2);}
});
test('동시 3개 충돌과 역순 중복 이벤트에서 한 번만 합체',()=>{
  const {system,created}=harness();const a=item(1),b=item(1),c=item(1);
  assert.ok(system.reserve(a,b,200));assert.equal(system.reserve(b,a,200),false);assert.equal(system.reserve(a,c,200),false);system.flush(200);assert.equal(created.length,1);assert.equal(c.removed,false);assert.equal(system.reserve(a,c,300),false);
});
test('다른 단계, 최종 단계, 삭제됨, 잠금, 자기 자신은 합체 금지',()=>{
  const {system,created}=harness();const a=item(1);
  assert.equal(system.reserve(a,item(2),200),false);assert.equal(system.reserve(item(8),item(8),200),false);assert.equal(system.reserve({...a,removed:true},item(1),200),false);assert.equal(system.reserve({...a,mergeLocked:true},item(1),200),false);assert.equal(system.reserve(a,a,200),false);system.flush(200);assert.equal(created.length,0);
});
test('새 바디는 100ms 보호 후 지속 충돌로 합체 가능',()=>{const {system}=harness();const a=item(2),b=item(2);assert.equal(system.reserve(a,b,99),false);assert.equal(system.reserve(a,b,100),true);});
test('벽과 바닥 근처 합체 위치를 새 반지름으로 보정',()=>{
  for(const x of [-20,430]){const {system,created}=harness();system.reserve(item(7,x,590),item(7,x,590),200);system.flush(200);const [,nx,ny]=created[0];assert.ok(nx>=FIELD.left+73&&nx<=FIELD.right-73);assert.equal(ny,FIELD.floor-73);}
});
