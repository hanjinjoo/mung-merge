const names = ['Hi 강아지','누운 강아지','장미 강아지','휴대폰 강아지','하얀 고양이','웃는 강아지','멍한 강아지','최종 가나디'];
const radii = [20,25,30,36,43,51,61,73];
const bags = [8,6,4,2,0,0,0,0];
const scores = [10,20,40,80,160,320,1000,0];
export const STAGES = names.map((name, i) => ({ id:i+1, key:`stage${i+1}`, name, radius:radii[i], nextId:i===7?null:i+2, bagCount:bags[i], image:new URL(`../../assets/images/stage${i+1}.png`,import.meta.url).href, spriteScale:i===7?1.65:1/0.94 }));
STAGES.forEach((stage,i)=>{stage.scoreOnMerge=scores[i];});
export const stageById = id => STAGES[id-1];

