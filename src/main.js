import Phaser from 'phaser';
import '../style.css';
import { GameScene } from './GameScene.js';
import { STAGES } from './data/stages.js';
import { FIELD } from './constants.js';
for(const stage of STAGES){const figure=document.createElement('figure');const img=document.createElement('img');img.src=stage.image;img.alt=stage.name;const caption=document.createElement('figcaption');caption.textContent=stage.id;figure.append(img,caption);document.querySelector('#stages').append(figure);}
const debug=new URLSearchParams(location.search).get('debug')==='true';
const game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:FIELD.width,height:FIELD.height,backgroundColor:'#fffdf7',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:'matter',matter:{gravity:{y:1},enableSleeping:true,positionIterations:8,velocityIterations:8,debug}},scene:[GameScene],input:{activePointers:1},render:{antialias:true},audio:{noAudio:true}});
// 개발 서버의 명시적 테스트 모드에서만 내부 상태를 제공한다.
if(import.meta.env.DEV&&new URLSearchParams(location.search).has('test'))window.__game=game;
