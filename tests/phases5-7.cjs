const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:process.env.QA_BROWSER||'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:1100,height:1000}});const errors=[],checks=[];
 page.setDefaultTimeout(12000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const ready=()=>page.waitForFunction(()=>window.__game?.scene.getScene('Game').objects);
 await page.goto('http://localhost:5173/?test=1');await ready();
 const reset=async()=>{await page.locator('#reset').click();await page.waitForFunction(()=>{const s=__game.scene.getScene('Game');return s.objects.size===0&&s.score.current===0&&!s.gameOver;});};
 await page.evaluate(()=>{const s=__game.scene.getScene('Game');s.createCharacter(1,180,450,-200);s.createCharacter(1,181,450,-200);});
 await page.waitForFunction(()=>__game.scene.getScene('Game').score.current===10);
 await page.waitForTimeout(200);assert.equal(await page.locator('#score').textContent(),'10');checks.push('QA1·2: stage1 실제 충돌 합체 +10 정확히 1회');
 await page.reload();await ready();assert.equal(await page.locator('#best').textContent(),'10');assert.equal(await page.locator('#score').textContent(),'0');checks.push('QA3: 새로고침 후 BEST 유지·현재 점수 초기화');
 await page.evaluate(()=>{const s=__game.scene.getScene('Game');s.createCharacter(7,180,450,-200);s.createCharacter(7,181,450,-200);});
 await page.waitForFunction(()=>__game.scene.getScene('Game').score.current===1000);assert.equal(await page.evaluate(()=>localStorage.getItem('finalStageUnlocked')),'true');checks.push('stage7 합체 +1000 및 finalStageUnlocked 저장');
 await reset();
 const addDanger=()=>page.evaluate(()=>{const s=__game.scene.getScene('Game');const o=s.createCharacter(1,200,160);s.matter.body.setStatic(o.body,true);return o.uniqueId;});
 await addDanger();await page.waitForFunction(()=>__game.scene.getScene('Game').danger.elapsed>=1050);
 assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').gameOver),false);
 await page.evaluate(()=>{const s=__game.scene.getScene('Game');s.matter.body.setPosition([...s.objects.values()][0].body,{x:200,y:200});});
 await page.waitForFunction(()=>__game.scene.getScene('Game').danger.elapsed===0);await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').gameOver),false);checks.push('QA4: 상단 기준 위험 감지·잠깐 넘은 뒤 타이머 초기화');
 await reset();await page.evaluate(()=>{const s=__game.scene.getScene('Game');s.drop();const o=[...s.objects.values()][0];s.matter.body.setStatic(o.body,true);});
 await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').danger.elapsed),0);assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').gameOver),false);checks.push('QA6: 새 드롭 800ms 유예 중 위험 시간 누적 없음');
 await reset();await addDanger();await page.waitForFunction(()=>__game.scene.getScene('Game').danger.elapsed>=1500);
 assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').warning.visible),true);assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').gameOver),false);
 await page.waitForFunction(()=>__game.scene.getScene('Game').gameOver);
 assert.equal(await page.locator('#result').evaluate(d=>d.open),true);assert.equal(await page.locator('#result-stage').textContent(),'1단계');checks.push('QA5: 1.5초 경고·2초 게임오버·결과 화면');
 const frozen=await page.evaluate(()=>{const s=__game.scene.getScene('Game');return {t:s.simTime,x:s.aimX,count:s.objects.size};});
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');
 assert.equal(await page.evaluate(()=>{const s=__game.scene.getScene('Game');s.moveAim(300);return s.drop();}),false);
 await page.waitForTimeout(300);assert.deepEqual(await page.evaluate(()=>{const s=__game.scene.getScene('Game');return {t:s.simTime,x:s.aimX,count:s.objects.size};}),frozen);checks.push('QA7: 게임오버 후 물리·이동·드롭 정지');
 fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:'test-results/gameover.png',fullPage:true});
 await page.locator('#result-reset').click();await page.waitForFunction(()=>!__game.scene.getScene('Game').gameOver);
 const baseline=await page.evaluate(()=>{const s=__game.scene.getScene('Game');return [s.matter.world.listenerCount('collisionstart'),s.matter.world.listenerCount('collisionactive'),s.input.listenerCount('pointerup')];});
 for(let i=0;i<5;i++){
  await page.evaluate(()=>{const s=__game.scene.getScene('Game');s.createCharacter(1,180,450,-200);s.createCharacter(1,181,450,-200);});
  await page.waitForFunction(()=>__game.scene.getScene('Game').score.current===10);await reset();
  assert.deepEqual(await page.evaluate(()=>{const s=__game.scene.getScene('Game');return [s.matter.world.listenerCount('collisionstart'),s.matter.world.listenerCount('collisionactive'),s.input.listenerCount('pointerup')];}),baseline);
  assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').matter.world.getAllBodies().length),3);
  assert.equal(await page.evaluate(()=>__game.scene.getScene('Game').danger.timers.size),0);
 }
 checks.push('QA8·9·10: 반복 재시작 5회, 바디·점수·위험 시간 초기화, 이벤트 수 일정');
 await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await page.waitForTimeout(100);console.log('키보드 검사',await page.evaluate(()=>{const s=__game.scene.getScene('Game');return {active:document.activeElement.tagName,enabled:s.input.keyboard.enabled,space:s.keys.SPACE._justDown,count:s.objects.size,over:s.gameOver,status:document.querySelector('#status').textContent};}));await page.waitForFunction(()=>__game.scene.getScene('Game').objects.size===1);checks.push('재시작 후 키보드 드롭·물리 재개');
 await page.waitForTimeout(1800);
 const pos=await page.evaluate(()=>[...__game.scene.getScene('Game').objects.values()].map(o=>({...o.body.position})));
 for(const size of [{width:360,height:800},{width:390,height:844},{width:430,height:932},{width:844,height:390},{width:1200,height:900}]){
  await page.setViewportSize(size);await page.waitForTimeout(200);
  const geometry=await page.evaluate(()=>{const c=document.querySelector('canvas').getBoundingClientRect(),g=document.querySelector('#game').getBoundingClientRect();return {canvasFits:c.left>=g.left&&c.right<=g.right+1&&c.top>=g.top&&c.bottom<=g.bottom+1,width:document.documentElement.scrollWidth,viewport:innerWidth,bottom:document.querySelector('main').getBoundingClientRect().bottom};});
  assert.ok(geometry.canvasFits);assert.ok(geometry.width<=size.width);
  if(size.width<500){assert.ok(geometry.bottom<=size.height,JSON.stringify(geometry));await page.screenshot({path:`test-results/phase7-${size.width}.png`});}
  const current=await page.evaluate(()=>[...__game.scene.getScene('Game').objects.values()].map(o=>({...o.body.position})));
  assert.ok(Math.abs(current[0].x-pos[0].x)<1&&Math.abs(current[0].y-pos[0].y)<1);
 }
 checks.push('QA13·14: 세로 3종 화면 전체 표시, 회전·PC resize 후 바디 좌표 유지');
 await reset();await page.evaluate(()=>{const s=__game.scene.getScene('Game');const a=s.createCharacter(1,40,450,-200),b=s.createCharacter(2,375,450,-200);s.matter.body.setVelocity(a.body,{x:-15,y:0});s.matter.body.setVelocity(b.body,{x:15,y:0});});await page.waitForTimeout(1700);
 assert.ok(await page.evaluate(()=>[...__game.scene.getScene('Game').objects.values()].every(o=>o.body.position.x>=16&&o.body.position.x<=404&&o.body.position.y<=579)));checks.push('QA14: resize 후 좌우 벽 충돌·바닥 정착');
 const denied=await browser.newPage();await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('거부','SecurityError');}}));denied.on('pageerror',e=>errors.push(e.message));
 await denied.goto('http://localhost:5173/?test=1');await denied.waitForFunction(()=>window.__game?.scene.getScene('Game').objects);await denied.evaluate(()=>{const s=__game.scene.getScene('Game');s.createCharacter(1,180,450,-200);s.createCharacter(1,181,450,-200);});await denied.waitForFunction(()=>__game.scene.getScene('Game').score.current===10);checks.push('localStorage 접근 거부 상태에서도 게임·점수 정상');
 assert.deepEqual(errors,[]);checks.push('브라우저 콘솔·런타임 오류 0건');
 fs.writeFileSync('test-results/phases5-7.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
