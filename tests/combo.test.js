import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreSystem } from '../src/systems/ScoreSystem.js';
import { MergeSystem } from '../src/systems/MergeSystem.js';
test('첫 합체·1200ms 경계·초과 후 초기화',()=>{const s=new ScoreSystem();assert.deepEqual(s.award(1,0),{points:10,multiplier:1,comboCount:1});assert.deepEqual(s.award(1,1200),{points:12,multiplier:1.2,comboCount:2});assert.equal(s.award(1,2401).comboCount,1);});
test('배수 상한·반올림·최종 단계 점수',()=>{const s=new ScoreSystem();s.award(1,100);s.award(1,200);assert.equal(s.award(7,300).points,1500);assert.equal(s.award(1,400).points,20);assert.equal(s.award(1,500).points,25);assert.equal(s.award(1,600).points,25);assert.equal(s.finalStageUnlocked,true);});
test('중복 충돌은 콤보와 점수를 한 번만 변경',()=>{const s=new ScoreSystem(),a={stageId:1,spawnTime:0,body:{position:{x:100,y:300}}},b={...a};const m=new MergeSystem({remove:()=>{},create:()=>{},onSuccess:id=>s.award(id,200)});m.reserve(a,b,200);m.reserve(b,a,200);m.flush(200);m.flush(200);assert.equal(s.current,10);assert.equal(s.comboCount,1);});
test('시간 만료·종료·새 게임은 콤보0/시간0',()=>{const s=new ScoreSystem();s.award(1,100);assert.equal(s.expireCombo(1300),false);assert.equal(s.expireCombo(1301),true);assert.equal(s.lastMergeTime,0);s.award(1,1400);s.resetCombo();assert.equal(s.comboCount,0);assert.equal(s.lastMergeTime,0);assert.equal(new ScoreSystem().comboCount,0);});
