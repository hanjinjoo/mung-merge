const memory={bestScore:0,finalStageUnlocked:false};
export function readProgress(){
  try {
    const value=Number(localStorage.getItem('bestScore'));
    if(Number.isSafeInteger(value)&&value>=0)memory.bestScore=Math.max(memory.bestScore,value);
    memory.finalStageUnlocked ||= localStorage.getItem('finalStageUnlocked')==='true';
  } catch { /* 저장소가 막혀 있어도 현재 실행의 기록은 유지한다. */ }
  return {...memory};
}
export function saveProgress(bestScore,finalStageUnlocked){
  memory.bestScore=Math.max(memory.bestScore,bestScore);
  memory.finalStageUnlocked ||= finalStageUnlocked;
  try {localStorage.setItem('bestScore',String(memory.bestScore));localStorage.setItem('finalStageUnlocked',String(memory.finalStageUnlocked));} catch { /* 저장 실패가 게임 진행을 중단하지 않는다. */ }
}
