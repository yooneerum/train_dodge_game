import * as THREE from 'three';
import deadlockedMusic from './assets/deadlocked.mp3';
import gameoverMusic from './assets/gameover.mp3';

// ─────────────────────────────────────────────
//  상수
// ─────────────────────────────────────────────
const MAP_HALF        = 14;
const STAGE_DURATION  = 15000;
const WARN_DURATION   = 1000;
const COLOR_KEY_MAP   = {
  [0xff0000]:'1', [0x00ff00]:'2', [0x0000ff]:'3',
  [0xffff00]:'12',[0xff00ff]:'13',[0x00ffff]:'23'
};
const STAGE_COLORS_POOL = [
  [0xff0000, 0x00ff00, 0x0000ff],
  [0xff0000, 0x00ff00, 0x0000ff, 0xffff00],
  [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff],
  [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff],
];
const WHITE = 0xffffff;
const BLACK = 0x000000;

// ─────────────────────────────────────────────
//  UI
// ─────────────────────────────────────────────
const uiStyle = `position:fixed;font-family:'Courier New',monospace;pointer-events:none;z-index:10;`;

const helpEl = document.createElement('div');
helpEl.style.cssText = uiStyle + 'top:16px;left:16px;font-size:15px;line-height:2.1;';
helpEl.innerHTML = `
  <b style="font-size:25px;letter-spacing:1px;">🎮 조작법</b><br>
  <b style="font-size:20px;">방향키로 이동</b><br>
  <b style="font-size:20px;">1: 🔴 &nbsp;2: 🟢 &nbsp;3: 🔵</b><br>
  <b style="font-size:20px;">1+2: 💛 &nbsp;1+3: 🩷 &nbsp;2+3: 🩵</b><br>
  <hr style="border-color:currentColor;opacity:0.3;margin:4px 0">
  <b style="font-size:18px;">장애물을 피해 최대한 오래 버티세요!</b>
`;
document.body.appendChild(helpEl);

const timerEl = document.createElement('div');
timerEl.style.cssText = uiStyle + 'top:16px;right:16px;text-align:right;font-size:16px;line-height:2.1;';
document.body.appendChild(timerEl);

// 스테이지 배너
const stageEl = document.createElement('div');
stageEl.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
  font-family:'Courier New',monospace;font-size:42px;font-weight:bold;color:#fff;
  text-shadow:0 0 30px #fff;pointer-events:none;z-index:15;opacity:0;transition:opacity 0.3s;`;
document.body.appendChild(stageEl);

function showStageBanner(text) {
  stageEl.textContent = text;
  stageEl.style.opacity = '1';
  setTimeout(() => { stageEl.style.opacity = '0'; }, 1800);
}

// ─── 시작/게임오버 오버레이 (하나로 통합) ───
const overlayEl = document.createElement('div');
overlayEl.style.cssText = `display:none;position:fixed;inset:0;background:rgba(0,0,0,.82);
  flex-direction:column;align-items:center;justify-content:center;
  color:#fff;font-family:'Courier New',monospace;z-index:20;`;
overlayEl.innerHTML = `
  <div id="ov-title"  style="font-size:52px;font-weight:bold;margin-bottom:18px;"></div>
  <div id="ov-sub"    style="font-size:18px;color:#aaa;margin-bottom:6px;"></div>
  <div id="ov-time"   style="font-size:24px;margin-bottom:8px;"></div>
  <div id="ov-best"   style="font-size:18px;color:#ff0;margin-bottom:36px;"></div>
  <button id="ov-btn" style="padding:14px 44px;font-size:20px;font-family:'Courier New',monospace;
    background:#222;color:#fff;border:2px solid #fff;cursor:pointer;letter-spacing:2px;"></button>
`;
document.body.appendChild(overlayEl);

const ovTitle = document.getElementById('ov-title');
const ovSub   = document.getElementById('ov-sub');
const ovTime  = document.getElementById('ov-time');
const ovBest  = document.getElementById('ov-best');
const ovBtn   = document.getElementById('ov-btn');

// 처음 실행인지 구분
let isFirstRun = true;

function showStartScreen() {
  ovTitle.textContent       = '🚂 TRAIN DODGE';
  ovTitle.style.color       = '#fff';
  ovTitle.style.textShadow  = '0 0 24px #fff';
  ovSub.textContent         = '화면을 클릭하거나 버튼을 눌러 시작';
  ovTime.textContent        = '';
  ovBest.textContent        = '';
  ovBtn.textContent         = 'START';
  overlayEl.style.display   = 'flex';
}

function showGameOverScreen() {
  ovTitle.textContent      = 'GAME OVER';
  ovTitle.style.color      = '#f44';
  ovTitle.style.textShadow = '0 0 24px #f00';
  ovSub.textContent        = `도달 스테이지: ${currentStage}`;
  ovTime.textContent       = `생존 시간: ${fmt(elapsedTime)}`;
  ovBest.textContent       = elapsedTime >= bestTime
    ? `🏆 신기록! ${fmt(bestTime)}` : `최고기록: ${fmt(bestTime)}`;
  ovBtn.textContent        = 'RESTART';
  overlayEl.style.display  = 'flex';
}

ovBtn.addEventListener('click', handleOverlayBtn);

function handleOverlayBtn() {
  overlayEl.style.display = 'none';
  isFirstRun = false;
  resumeAudioContext().then(() => restartGame());
}

// ─────────────────────────────────────────────
//  THREE 세팅
// ─────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x111111);
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const gridHelper = new THREE.GridHelper(29, 29);
scene.add(gridHelper);
scene.add(new THREE.AmbientLight(0xffffff, 2));
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(1,2,0);
scene.add(dirLight);

camera.position.set(0, 25, 3);
camera.lookAt(0,0,0);

// ─────────────────────────────────────────────
//  Audio
// ─────────────────────────────────────────────
const listener       = new THREE.AudioListener();
camera.add(listener);
const bgm            = new THREE.Audio(listener);
const gameOverSound  = new THREE.Audio(listener);
const audioLoader    = new THREE.AudioLoader();
let bgmBuffer        = null;
let gameOverBuffer   = null;

audioLoader.load(deadlockedMusic, (buffer) => { bgmBuffer = buffer; });
audioLoader.load(gameoverMusic,   (buffer) => { gameOverBuffer = buffer; });

// AudioContext를 깨우는 핵심 함수 — 버튼 클릭 등 인터랙션 시 반드시 호출
async function resumeAudioContext() {
  const ctx = listener.context;
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

function startBgm() {
  if (!bgmBuffer) return;
  if (bgm.isPlaying) bgm.stop();
  bgm.setBuffer(bgmBuffer);
  bgm.setLoop(true);
  bgm.setVolume(0.4);
  bgm.play();
}

function stopBgm() {
  if (bgm.isPlaying) bgm.stop();
}

function playGameOver() {
  if (!gameOverBuffer) return;
  if (gameOverSound.isPlaying) gameOverSound.stop();
  gameOverSound.setBuffer(gameOverBuffer);
  gameOverSound.setLoop(false);
  gameOverSound.setVolume(0.7);
  gameOverSound.play();
}

// ─────────────────────────────────────────────
//  배경 & 그리드 색상
// ─────────────────────────────────────────────
let bgIsWhite = false;

function applyStageTheme(stageIndex) {
  bgIsWhite = (stageIndex % 2 === 1);
  const bg   = bgIsWhite ? 0xeeeeee : 0x111111;
  const grid = bgIsWhite ? 0x888888 : 0x444444;
  renderer.setClearColor(bg);
  gridHelper.material.color.setHex(grid);
  applyUIColor();
}

function applyUIColor() {
  const key = getSphereColorKey();
  let uiHex;
  if (key && COLOR_MAP[key] !== undefined) {
    uiHex = COLOR_MAP[key];
  } else {
    uiHex = bgIsWhite ? BLACK : WHITE;
  }
  const r = (uiHex >> 16) & 0xff;
  const g = (uiHex >>  8) & 0xff;
  const b =  uiHex        & 0xff;
  const cssColor = `rgb(${r},${g},${b})`;
  const shadowColor = bgIsWhite ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
  const shadow = `0 0 8px ${shadowColor}, 0 0 16px ${shadowColor}`;
  [helpEl, timerEl].forEach(el => {
    el.style.color      = cssColor;
    el.style.textShadow = shadow;
  });
}

// ─────────────────────────────────────────────
//  캐릭터 공
// ─────────────────────────────────────────────
const sphereGeo = new THREE.SphereGeometry(0.5, 32, 16);
const sphereMat = new THREE.MeshBasicMaterial({ color: WHITE });
const sphere    = new THREE.Mesh(sphereGeo, sphereMat);
sphere.position.set(0, 0.5, 0);
scene.add(sphere);

// ─────────────────────────────────────────────
//  공 색상 시스템
// ─────────────────────────────────────────────
const COLOR_MAP = {
  '1':0xff0000,'2':0x00ff00,'3':0x0000ff,
  '12':0xffff00,'13':0xff00ff,'23':0x00ffff
};

const keys = {};

function getSphereColorKey() {
  const pressed = [];
  if (keys['1']) pressed.push('1');
  if (keys['2']) pressed.push('2');
  if (keys['3']) pressed.push('3');
  if (pressed.length === 0 || pressed.length >= 3) return '';
  return pressed.sort().join('');
}

function updateSphereColor() {
  const key = getSphereColorKey();
  const defaultColor = bgIsWhite ? BLACK : WHITE;
  sphereMat.color.setHex(COLOR_MAP[key] ?? defaultColor);
  applyUIColor();
}

// ─────────────────────────────────────────────
//  기차
// ─────────────────────────────────────────────
function createTrain() {
  const trainGroup       = new THREE.Group();
  const frontWheelGroup  = new THREE.Group();
  const centerWheelGroup = new THREE.Group();
  const rearWheelGroup   = new THREE.Group();
  trainGroup.add(frontWheelGroup, centerWheelGroup, rearWheelGroup);

  const R = Math.PI/2;
  const box = new THREE.Mesh(new THREE.BoxGeometry(1,1.5,1),
    new THREE.MeshPhongMaterial({ color:0x000080, shininess:80 }));
  trainGroup.add(box);

  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3,0.4,32),
    new THREE.MeshPhongMaterial({ color:0x00ffff, shininess:80 }));
  cone.position.set(0,0.3,-1.5);
  cone.rotation.set(Math.PI,0,0);
  trainGroup.add(cone);

  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,2),
    new THREE.MeshPhongMaterial({ color:0xff0000, shininess:80 }));
  cyl.rotation.set(Math.PI/2,0,0);
  cyl.position.set(0,-0.25,-1);
  trainGroup.add(cyl);

  const wGeo = new THREE.TorusGeometry(0.15,0.08,7,11,Math.PI*11/6);
  const wBig = new THREE.TorusGeometry(0.3,0.15,7,11,Math.PI*11/6);
  const wMat = new THREE.MeshPhongMaterial({ color:0xffff00, shininess:30 });

  [[frontWheelGroup,-1.8],[centerWheelGroup,-1.3]].forEach(([g,z])=>{
    const w1=new THREE.Mesh(wGeo,wMat), w2=new THREE.Mesh(wGeo,wMat);
    w1.position.set(-0.5,0,0); w2.position.set(0.5,0,0);
    w1.rotation.y=w2.rotation.y=R;
    g.add(w1,w2); g.position.set(0,-0.5,z);
  });
  const w5=new THREE.Mesh(wBig,wMat), w6=new THREE.Mesh(wBig,wMat);
  w5.position.set(-0.5,0,0); w6.position.set(0.5,0,0);
  w5.rotation.y=w6.rotation.y=R;
  rearWheelGroup.add(w5,w6); rearWheelGroup.position.set(0,-0.5,0.1);

  return { trainGroup, frontWheelGroup, centerWheelGroup, rearWheelGroup, cone };
}

const train = createTrain();
scene.add(train.trainGroup);
train.trainGroup.visible = false;

function randomWaypoints(count=6) {
  const pts=[];
  for(let i=0;i<count;i++)
    pts.push(new THREE.Vector3((Math.random()-0.5)*29, 0.95, (Math.random()-0.5)*29));
  return pts;
}

const trainState = { train, points: randomWaypoints(), seg:0, coneDir:1, isMoving:true, speed:0.03 };

function moveTrain(state) {
  if (!state.isMoving || !state.train.trainGroup.visible) return;
  const { trainGroup, frontWheelGroup, centerWheelGroup, rearWheelGroup, cone } = state.train;

  if (trainGroup.position.distanceTo(state.points[state.seg]) < 0.3) {
    state.seg = (state.seg+1) % state.points.length;
    state.coneDir *= -1;
    if (state.seg===0) state.points = randomWaypoints();
  }

  const dir = new THREE.Vector3().subVectors(state.points[state.seg], trainGroup.position).normalize();
  trainGroup.position.addScaledVector(dir, state.speed);
  trainGroup.position.y = 0.95;

  const wheelRot = state.speed * 0.85;
  frontWheelGroup.rotation.x  -= wheelRot;
  centerWheelGroup.rotation.x -= wheelRot;
  rearWheelGroup.rotation.x   -= wheelRot * 0.6;
  cone.position.y += 0.0007 * state.coneDir;

  trainGroup.lookAt(new THREE.Vector3().addVectors(
    trainGroup.position, dir.clone().multiplyScalar(-1)
  ));
}

// ─────────────────────────────────────────────
//  스테이지 시스템
// ─────────────────────────────────────────────
let currentStage = 1;
let stageTimer   = 0;

function getStageConfig(stage) {
  const baseInterval  = Math.max(400, 2000 - stage * 200);
  const baseMaxCount  = Math.min(1 + Math.floor(stage*0.6), 5);
  const baseLiveTime  = 1800 + stage * 100;
  const baseLineSpeed = 0.02 + stage * 0.015;
  return { baseInterval, baseMaxCount, baseLiveTime, baseLineSpeed };
}

function getLineSpeed() {
  const progress = Math.min(stageTimer / STAGE_DURATION, 1);
  const cfg = getStageConfig(currentStage);
  return cfg.baseLineSpeed * (0.3 + progress * 0.7);
}

function getSpawnParams(stage, progress) {
  const cfg = getStageConfig(stage);
  return {
    interval: cfg.baseInterval * (1 - progress * 0.45),
    maxCount: Math.max(1, Math.round(cfg.baseMaxCount * (0.5 + progress * 0.5))),
    liveTime: cfg.baseLiveTime,
  };
}

function getAvailableColors(stage) {
  return STAGE_COLORS_POOL[Math.min(stage-1, STAGE_COLORS_POOL.length-1)];
}

function advanceStage() {
  currentStage++;
  stageTimer = 0;
  applyStageTheme(currentStage);
  updateSphereColor();

  showStageBanner(currentStage === 5 ? `STAGE ${currentStage} 🚂` : `STAGE ${currentStage}`);

  // 스테이지 2에서 BGM 시작
  if (currentStage === 2) {
    startBgm();
  }

  //  장애물 시스템_스테이지 7부터 기차 등장
  if (currentStage === 5) {
    train.trainGroup.visible = true;
    train.trainGroup.position.set(-5, 0.95, -5);
    trainState.points = randomWaypoints();
    trainState.seg    = 0;
    spawnItem();
  }
  if (currentStage >= 5) {
    trainState.speed = 0.08;
  }
}

// ─────────────────────────────────────────────
//  장애물 시스템
// ─────────────────────────────────────────────
const obstacles = [];
let spawnAccum  = 0;

function countActive(subtype) {
  return obstacles.filter(o => o.subtype === subtype).length;
}

function availableSubtypes() {
  const list = ['sphere'];
  if (countActive('staticX') < 2) list.push('staticX');
  if (countActive('staticZ') < 2) list.push('staticZ');
  if (countActive('movingX') < 1) list.push('movingX');
  if (countActive('movingZ') < 1) list.push('movingZ');
  return list;
}

function makeZigzagGroup(axis, baseCoord, color) {
  // axis: 'X' → 장애물이 X축 방향으로 펼쳐짐 (perpendicular: Z)
  //       'Z' → 장애물이 Z축 방향으로 펼쳐짐 (perpendicular: X)
  const group   = new THREE.Group();
  const total   = 32;
  const half    = total / 2;
  const period  = 2.0;
  const amp     = 0.5;
  const steps   = Math.ceil(total / (period / 2));

  for (let s = 0; s < steps; s++) {
    const t0 = -half + s * (period / 2);
    const t1 = t0 + period / 2;
    const p0 = baseCoord + (s % 2 === 0 ?  amp : -amp);
    const p1 = baseCoord + (s % 2 === 0 ? -amp :  amp);

    // 세계 좌표 (x0,z0) ~ (x1,z1)
    const [x0,z0] = axis === 'X' ? [t0, p0] : [p0, t0];
    const [x1,z1] = axis === 'X' ? [t1, p1] : [p1, t1];

    const dx = x1-x0, dz = z1-z0;
    const len   = Math.sqrt(dx*dx + dz*dz);
    const angle = Math.atan2(dz, dx);

    const sMat  = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0 });
    const sMesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, 0.15), sMat);
    sMesh.position.set((x0+x1)/2, 0.5, (z0+z1)/2);
    sMesh.rotation.y = -angle;
    sMesh.userData.start = new THREE.Vector2(x0, z0);
    sMesh.userData.end   = new THREE.Vector2(x1, z1);
    group.add(sMesh);
  }
  return group;
}

function spawnObstacle(liveTime) {
  const colors   = getAvailableColors(currentStage);
  const color    = colors[Math.floor(Math.random()*colors.length)];
  const subtypes = availableSubtypes();
  const subtype  = subtypes[Math.floor(Math.random()*subtypes.length)];

  const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0 });
  let mesh, warnMesh, velocity = null;

  if (subtype === 'sphere') {
    const pos = new THREE.Vector3((Math.random()-0.5)*29, 0.5, (Math.random()-0.5)*29);
    mesh = new THREE.Mesh(new THREE.SphereGeometry(1,16,12), mat);
    mesh.position.copy(pos);
    const wMat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.25, wireframe:true });
    warnMesh = new THREE.Mesh(new THREE.SphereGeometry(1.1,12,8), wMat);
    warnMesh.position.copy(pos);

  } else if (subtype === 'staticX') {
    const z = (Math.random()-0.5) * 29;
    mesh = makeZigzagGroup('X', z, color);
    scene.add(mesh);
    const wMat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.15 });
    warnMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 0.15, 2.0), wMat);
    warnMesh.position.set(0, 0.5, z);

  } else if (subtype === 'staticZ') {
    const x = (Math.random()-0.5) * 29;
    mesh = makeZigzagGroup('Z', x, color);
    scene.add(mesh);
    const wMat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.15 });
    warnMesh = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.15, 32), wMat);
    warnMesh.position.set(x, 0.5, 0);

  } else if (subtype === 'movingX') {
    const z    = (Math.random()-0.5) * 20;
    const dirZ = z >= 0 ? -1 : 1;
    const spd  = getLineSpeed();
    mesh = new THREE.Mesh(new THREE.BoxGeometry(32, 0.18, 0.18), mat);
    mesh.position.set(0, 0.5, z);
    velocity = new THREE.Vector3(0, 0, dirZ * spd);
    const wMat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.2 });
    warnMesh = new THREE.Mesh(new THREE.BoxGeometry(32, 0.18, 0.18), wMat);
    warnMesh.position.copy(mesh.position);

  } else { // movingZ
    const x    = (Math.random()-0.5) * 20;
    const dirX = x >= 0 ? -1 : 1;
    const spd  = getLineSpeed();
    mesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 32), mat);
    mesh.position.set(x, 0.5, 0);
    velocity = new THREE.Vector3(dirX * spd, 0, 0);
    const wMat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.2 });
    warnMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 32), wMat);
    warnMesh.position.copy(mesh.position);
  }

  scene.add(warnMesh);
  if (!mesh.parent) scene.add(mesh); // 이미 추가된 Group 중복 방지

  obstacles.push({ mesh, warnMesh, subtype, phase:'warn',
    warnLife:WARN_DURATION, life:liveTime, maxLife:liveTime, color, velocity });
}

function setMeshOpacity(mesh, op) {
  if (mesh.isGroup) {
    mesh.children.forEach(c => { c.material.opacity = op; });
  } else {
    mesh.material.opacity = op;
  }
}

function disposeMesh(mesh) {
  if (mesh.isGroup) {
    mesh.children.forEach(c => { c.geometry.dispose(); c.material.dispose(); });
  } else {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
}

function updateObstacles(dt) {
  const progress = Math.min(stageTimer / STAGE_DURATION, 1);
  const { interval, maxCount, liveTime } = getSpawnParams(currentStage, progress);
  spawnAccum += dt;
  if (spawnAccum >= interval) {
    spawnAccum = 0;
    const n = Math.ceil(Math.random() * maxCount);
    for (let i=0; i<n; i++) spawnObstacle(liveTime);
  }

  for (let i = obstacles.length-1; i>=0; i--) {
    const o = obstacles[i];

    if (o.phase === 'warn') {
      o.warnLife -= dt;
      const blink = 0.15 + 0.2 * Math.abs(Math.sin(o.warnLife * 0.015));
      o.warnMesh.material.opacity = blink;

      if (o.warnLife <= 0) {
        o.phase = 'active';
        setMeshOpacity(o.mesh, 0.9);
        scene.remove(o.warnMesh);
        o.warnMesh.geometry.dispose();
        o.warnMesh.material.dispose();
        o.warnMesh = null;
      }

    } else {
      if (o.velocity) {
        o.mesh.position.addScaledVector(o.velocity, 1);
        const p = o.mesh.position;
        // 화면 끝까지 완전히 나가면 제거
        if (Math.abs(p.x) > 25 || Math.abs(p.z) > 25) {
          disposeMesh(o.mesh);
          scene.remove(o.mesh);
          obstacles.splice(i, 1);
          continue;
        }
      } else {
        o.life -= dt;
        if (o.life < 400) setMeshOpacity(o.mesh, Math.max(0, o.life / 400 * 0.9));
        if (o.life <= 0) {
          disposeMesh(o.mesh);
          scene.remove(o.mesh);
          obstacles.splice(i, 1);
        }
      }
    }
  }
}


// ─────────────────────────────────────────────
//  무적 아이템 시스템
// ─────────────────────────────────────────────
const ITEM_COLORS = [0xff0000, 0xffff00, 0x00ff00, 0x00ffff, 0x0000ff, 0xff00ff];
const ITEM_SPAWN_INTERVAL = 15000; // 15초마다
const ITEM_TRAIL_DIST     = 4;   // 공 지름(1.0) × 4
const INVINCIBLE_DURATION = 5000;  // 무적 5초
const INVINCIBLE_BLINK    = 2000;  // 해제 전 깜빡임 2초
 
let itemMesh       = null;   // 현재 활성 아이템 (null = 없음)
let itemSpawnTimer = 0;
let invincibleTimer = 0;     // 무적 남은 시간 (0 = 비활성)
let invincibleBlinkTimer = 0; // 해제 직전 깜빡임 타이머
 
const RAINBOW_COLORS = [0xff0000,0xff7700,0xffff00,0x00ff00,0x00ffff,0x0000ff,0xff00ff];
let rainbowTick = 0;
 
function makeItemMesh() {
  // 노란 별 모양 — 2D 별 윤곽을 ExtrudeGeometry로 두께 부여
  const starShape = new THREE.Shape();
  const spikes = 5;
  const outerR = 0.7;
  const innerR = 0.3;
  for (let i = 0; i < spikes * 2; i++) {
    const r     = i % 2 === 0 ? outerR : innerR;
    const angle = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const x     = Math.cos(angle) * r;
    const y     = Math.sin(angle) * r;
    if (i === 0) starShape.moveTo(x, y);
    else         starShape.lineTo(x, y);
  }
  starShape.closePath();
 
  const extrudeSettings = { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 };
  const geo = new THREE.ExtrudeGeometry(starShape, extrudeSettings);
  const mat = new THREE.MeshPhongMaterial({ color: 0xffdd00, emissive: 0xffaa00, emissiveIntensity: 0.5, shininess: 120 });
  const mesh = new THREE.Mesh(geo, mat);
  // ExtrudeGeometry는 XY 평면으로 생성되므로 눕혀서 지면과 평행하게
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}
 
function spawnItem() {
  if (itemMesh) return; // 이미 있으면 스킵
  itemMesh = makeItemMesh();
  scene.add(itemMesh);
}
 
function updateItem(dt) {
  // 스폰 타이머 (기차 등장 이후에만 카운트)
  if (train.trainGroup.visible && !itemMesh) {
    itemSpawnTimer += dt;
    if (itemSpawnTimer >= ITEM_SPAWN_INTERVAL) {
      itemSpawnTimer = 0;
      spawnItem();
    }
  }
 
  if (!itemMesh) return;
 
  // 기차 뒤쪽 위치 계산
  // trainGroup.rotation.y 기준으로 기차가 바라보는 방향의 반대 = 기차 뒤
  const trainPos = train.trainGroup.position;
  const trainRot = train.trainGroup.rotation.y;
  // Three.js lookAt 결과: 기차 앞 방향 = -Z 로컬 → 뒤 = +Z 로컬 → 월드 변환
  const behindX = trainPos.x + Math.sin(trainRot) * ITEM_TRAIL_DIST;
  const behindZ = trainPos.z + Math.cos(trainRot) * ITEM_TRAIL_DIST;
  itemMesh.position.set(behindX, 0.8, behindZ);
 
  // 회전 애니메이션 — Y축 스핀 + 약간 기울어짐으로 입체감
  itemMesh.rotation.y += 0.06;
 
  // 공과 충돌 → 무적 발동
  if (itemMesh.position.distanceTo(sphere.position) < 1.8) {
    scene.remove(itemMesh);
    itemMesh = null;
    itemSpawnTimer = 0;
    activateInvincible();
  }
}
 
function activateInvincible() {
  invincibleTimer      = INVINCIBLE_DURATION;
  invincibleBlinkTimer = 0;
}
 
function updateInvincible(dt) {
  if (invincibleTimer <= 0) return;
 
  invincibleTimer -= dt;
  rainbowTick     += dt;
 
  // 해제 1초 전 = 깜빡임 구간
  const blinkPhase = invincibleTimer < INVINCIBLE_BLINK;
 
  if (invincibleTimer <= 0) {
    // 완전 해제
    invincibleTimer = 0;
    updateSphereColor(); // 원래 색으로 복구
    return;
  }
 
  if (blinkPhase) {
    // 0.1초 주기로 무지개↔기본색 토글
    const blink = Math.floor(rainbowTick / 100) % 2 === 0;
    if (blink) {
      applyRainbowColor();
    } else {
      const defaultColor = bgIsWhite ? BLACK : WHITE;
      sphereMat.color.setHex(defaultColor);
    }
  } else {
    applyRainbowColor();
  }
}
 
function applyRainbowColor() {
  const idx = Math.floor(rainbowTick / 120) % RAINBOW_COLORS.length;
  sphereMat.color.setHex(RAINBOW_COLORS[idx]);
}
 
function isInvincible() {
  return invincibleTimer > 0;
}
 
function resetItem() {
  if (itemMesh) { scene.remove(itemMesh); itemMesh = null; }
  itemSpawnTimer    = 0;
  invincibleTimer   = 0;
  invincibleBlinkTimer = 0;
  rainbowTick       = 0;
}
 
function pointSegDist(px, pz, ax, az, bx, bz) {
  const abx = bx-ax, abz = bz-az;
  const apx = px-ax, apz = pz-az;
  const t = Math.max(0, Math.min(1, (apx*abx + apz*abz) / (abx*abx + abz*abz)));
  const cx = ax+abx*t, cz = az+abz*t;
  return Math.sqrt((px-cx)**2 + (pz-cz)**2);
}
 
function checkCollisions() {
  if (isInvincible()) return; // 무적 중 모든 충돌 무시
 
  if (train.trainGroup.visible &&
      train.trainGroup.position.distanceTo(sphere.position) < 1.8) {
    triggerGameOver(); return;
  }
 
  const sp = sphere.position;
  const sphereKey = getSphereColorKey();
 
  for (const o of obstacles) {
    if (o.phase !== 'active') continue;
    const obstKey = COLOR_KEY_MAP[o.color] ?? '';
    if (sphereKey === obstKey) continue;
 
    if (o.subtype === 'sphere') {
      if (sp.distanceTo(o.mesh.position) < 1.5) { triggerGameOver(); return; }
 
    } else if (o.subtype === 'staticX' || o.subtype === 'staticZ') {
      for (const seg of o.mesh.children) {
        const s = seg.userData.start, e = seg.userData.end;
        if (pointSegDist(sp.x, sp.z, s.x, s.y, e.x, e.y) < 0.55) {
          triggerGameOver(); return;
        }
      }
    } else if (o.subtype === 'movingX') {
      if (Math.abs(sp.z - o.mesh.position.z) < 0.6) { triggerGameOver(); return; }
    } else {
      if (Math.abs(sp.x - o.mesh.position.x) < 0.6) { triggerGameOver(); return; }
    }
  }
}

// ─────────────────────────────────────────────
//  게임 상태
// ─────────────────────────────────────────────
let gameRunning = false;
let startTime   = 0;
let elapsedTime = 0;
let bestTime    = 0;

function fmt(ms) {
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}.${String(Math.floor((ms%1000)/10)).padStart(2,'0')}`;
}

function updateTimerUI() {
  timerEl.innerHTML = `
    <span style="font-size:40px;font-weight:bold;">⏱ ${fmt(elapsedTime)}</span><br>
    <span style="font-size:30px;font-weight:bold;">STAGE ${currentStage}</span><br>
    <span style="font-size:30px;font-weight:bold;">🏆 BEST ${fmt(bestTime)}</span>
  `;
}

function triggerGameOver() {
  if (!gameRunning) return;
  gameRunning = false;
  stopBgm();
  playGameOver();
  if (elapsedTime > bestTime) bestTime = elapsedTime;
  showGameOverScreen();
}

function clearObstacles() {
  for (const o of obstacles) {
    if (o.warnMesh) { scene.remove(o.warnMesh); o.warnMesh.geometry.dispose(); o.warnMesh.material.dispose(); }
    disposeMesh(o.mesh);
    scene.remove(o.mesh);
  }
  obstacles.length = 0;
  spawnAccum = 0;
}

function restartGame() {
  clearObstacles();
  resetItem();
  stopBgm();  // 매 시작마다 BGM 리셋 → 스테이지 2에서 다시 재생
  sphere.position.set(0, 0.5, 0);

  train.trainGroup.visible = false;
  train.trainGroup.position.set(-5, 0.95, -5);
  trainState.points = randomWaypoints();
  trainState.seg    = 0;
  trainState.speed  = 0.03;

  currentStage = 1;
  stageTimer   = 0;
  applyStageTheme(1);
  updateSphereColor();

  startTime   = performance.now();
  elapsedTime = 0;
  gameRunning = true;

  showStageBanner('STAGE 1');
}

// ─────────────────────────────────────────────
//  키 입력
// ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['1','2','3'].includes(e.key)) updateSphereColor();
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
});
document.addEventListener('keyup', e => {
  keys[e.key] = false;
  if (['1','2','3'].includes(e.key)) updateSphereColor();
});

function handleInput() {
  if (!gameRunning) return;
  const step = 0.12;
  if (keys['ArrowUp'])    sphere.position.z = Math.max(-MAP_HALF, sphere.position.z - step);
  if (keys['ArrowDown'])  sphere.position.z = Math.min( MAP_HALF, sphere.position.z + step);
  if (keys['ArrowLeft'])  sphere.position.x = Math.max(-MAP_HALF, sphere.position.x - step);
  if (keys['ArrowRight']) sphere.position.x = Math.min( MAP_HALF, sphere.position.x + step);
}

// ─────────────────────────────────────────────
//  애니메이션 루프
// ─────────────────────────────────────────────
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt  = Math.min(now - lastTime, 100);
  lastTime  = now;

  if (gameRunning) {
    elapsedTime = now - startTime;
    handleInput();
    stageTimer += dt;
    if (stageTimer >= STAGE_DURATION) advanceStage();
    moveTrain(trainState);
    updateItem(dt);
    updateInvincible(dt);
    updateObstacles(dt);
    checkCollisions();
    updateTimerUI();
  }

  renderer.render(scene, camera);
}

// ─── 시작 ───
animate();
showStartScreen();   // 첫 실행: START 버튼 화면