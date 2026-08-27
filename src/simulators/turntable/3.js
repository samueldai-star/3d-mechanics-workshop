// 接點 D 模擬器：turntable:3 — 力矩方向 3D 右手定則
// 依教學規格書（2026-08-27，掛載目標實為 mechanics-workshop.dc.html，力學3D工坊.dc.html 舊名已作廢）重寫。
//
// 座標與正負號慣例（規格書未明訂 3D 情境下如何取正負號，此處採物理課本最常見的作法，
// 於面板與交接時特別標註，供設計端與老師確認）：
//   r 預設落在水平面（= 圓盤面，y = 0）。τ 的量值恆為 r F sinθ（θ 為 r、F 的真實 3D 夾角，恆 0–180°）。
//   τ 的正負號則另外依「由 +Y 往下俯視圓盤」的慣例判定：τ 的 y 分量 ≥ 0 為逆時針（+），< 0 為順時針（−）。
//   即使自由拖曳模式下 F 被拖出水平面、τ 不再純鉛直，正負號仍以 τ 的 y 分量判斷（代表該力矩「有效」讓圓盤
//   順轉或逆轉的分量）。預設情境模式維持 F 與 r 共平面（水平），此時 τ 必為鉛直，正負號判斷不會有歧義。

// 場景端（mechanics-workshop.dc.html）掛載模擬器前已備妥全域 window.THREE，正常情況下這裡會直接命中。
// 獨立預覽（dev/ 下的 harness）沒有場景端可依賴，改用 repo 內 vendor/ 的本機 three.js（離線可用，
// 教室網路不穩時也能跑），CDN 僅作最後備援。
let threeLoadPromise = null;
function ensureThree() {
  if (window.THREE) return Promise.resolve(window.THREE);
  if (threeLoadPromise) return threeLoadPromise;
  threeLoadPromise = import('../../../vendor/three.module.js')
    .then(mod => { window.THREE = mod; return mod; })
    .catch(() => import('https://unpkg.com/three@0.161.0/build/three.module.js').then(mod => { window.THREE = mod; return mod; }));
  return threeLoadPromise;
}

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PRESET_KEY = 'workshop.turntable3.customPresets';

const BUILTIN_PRESETS = [
  { id: 'b1', label: '垂直施力 90°', r: 1.5, f: 2.0, theta: 90, ccw: true },
  { id: 'b2', label: '斜向施力 60°', r: 1.5, f: 1.8, theta: 60, ccw: true },
  { id: 'b3', label: '接近平行（小力矩）', r: 1.8, f: 1.5, theta: 15, ccw: true },
  { id: 'b4', label: '反向施力（順時針）', r: 1.5, f: 1.8, theta: 60, ccw: false }
];

function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY)) || []; } catch (e) { return []; }
}
function saveCustomPresets(list) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch (e) {}
}
function ensureStyle() {
  if (document.getElementById('tt3-style')) return;
  const style = document.createElement('style');
  style.id = 'tt3-style';
  style.textContent = `
    .tt3-panel { position:absolute; right:12px; bottom:12px; width:236px; max-width:46%; z-index:5;
      background:rgba(14,21,29,.86); border:1px solid rgba(120,200,255,.45); border-radius:12px;
      padding:12px 13px; font-family:'IBM Plex Mono',monospace; color:#dff1ff;
      box-shadow:0 0 0 1px rgba(120,200,255,.12), 0 14px 30px rgba(0,0,0,.45); pointer-events:auto; }
    .tt3-kicker { display:flex; align-items:center; justify-content:space-between; font-size:10px; letter-spacing:.18em; color:#7fc4ff; margin-bottom:8px; }
    .tt3-dot { display:inline-block; width:6px; height:6px; border-radius:50%; background:#4fc3ff; margin-right:6px; animation: tt3Pulse 2.2s ease-in-out infinite; }
    .tt3-reset { border:1px solid rgba(120,200,255,.35); background:rgba(255,255,255,.04); color:#bfe3ff; border-radius:6px; font-size:11px; padding:2px 7px; cursor:pointer; }
    .tt3-modes { display:flex; gap:5px; margin-bottom:8px; }
    .tt3-modes button { flex:1; padding:6px 4px; border-radius:7px; border:1px solid rgba(120,200,255,.35); background:rgba(255,255,255,.04); color:#bfe3ff; font-size:11px; cursor:pointer; }
    .tt3-modes button.active { background:#3fa4e8; color:#04121c; border-color:#3fa4e8; font-weight:700; }
    .tt3-row { display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px dashed rgba(120,200,255,.18); font-size:12.5px; }
    .tt3-row b { font-weight:600; color:#a8d8ff; }
    .tt3-row span { font-size:14px; font-weight:600; color:#f2fbff; }
    .tt3-row input[type=number] { width:60px; background:rgba(255,255,255,.08); border:1px solid rgba(120,200,255,.35); border-radius:5px; color:#f2fbff; font-family:'IBM Plex Mono',monospace; font-size:13px; padding:2px 5px; }
    .tt3-hint { font-size:10.5px; color:#9fc7e8; line-height:1.6; }
    .tt3-presets { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
    .tt3-presets select { width:100%; font-size:11.5px; background:rgba(255,255,255,.06); color:#dff1ff; border:1px solid rgba(120,200,255,.3); border-radius:6px; padding:4px; }
    .tt3-prow { display:flex; gap:5px; }
    .tt3-presets button.tt3-add { font-size:10.5px; padding:5px 7px; border-radius:6px; border:1px solid rgba(120,200,255,.3); background:rgba(255,255,255,.04); color:#bfe3ff; cursor:pointer; width:100%; }
    .tt3-list { max-height:64px; overflow:auto; display:flex; flex-direction:column; gap:3px; }
    .tt3-litem { display:flex; justify-content:space-between; align-items:center; font-size:10.5px; color:#9fc7e8; }
    .tt3-litem button { padding:1px 6px; border-radius:4px; border:1px solid rgba(255,120,150,.4); background:transparent; color:#ff97ac; cursor:pointer; }
    @keyframes tt3Pulse { 0%,100%{box-shadow:0 0 0 0 rgba(120,200,255,.35);} 50%{box-shadow:0 0 0 5px rgba(120,200,255,0);} }
    @keyframes tt3Bounce { 0%{transform:scale(1);} 35%{transform:scale(1.3);} 60%{transform:scale(.92);} 100%{transform:scale(1);} }
    .tt3-bounce { display:inline-block; animation: tt3Bounce .42s cubic-bezier(.34,1.56,.64,1) both; }
  `;
  document.head.appendChild(style);
}

export function createTurntable3Sim() {
  let el, THREE, renderer, scene, camera, raf, ro;
  let rArrow, fArrow, rHandle, fHandle, angleArc, angleLabel, hand, platform;
  let readoutsCb = null;
  let disposed = false;

  // camera orbit
  let az = 0.8, elev = 0.5, dist = 5.4, orbitDragging = false, lastX = 0, lastY = 0;
  // handle drag
  let ray, mouseNDC, dragTarget = null, dragPlane;
  // vector state
  let dispR, dispF, r0, f0;
  let anim = null;      // r/F transition (mode switch, preset load, input commit)
  let handCurl = null;  // right-hand model curl-in animation
  let panel, panelEls = {};

  const state = {
    mode: 'drag',
    presetR: 1.6, presetF: 1.3, presetTheta: 70, presetCCW: true,
    activePresetId: null
  };
  const customPresets0 = () => loadCustomPresets();

  function planarVec(baseUnit, thetaDeg, ccw, mag, Y) {
    const ang = (ccw ? 1 : -1) * thetaDeg * DEG;
    return baseUnit.clone().applyAxisAngle(Y, ang).multiplyScalar(mag);
  }

  function derive(r, f) {
    const tau = new THREE.Vector3().crossVectors(r, f);
    const theta = r.angleTo(f);
    const tauMag = tau.length();
    const sign = tau.y < 0 ? -1 : 1;
    return { r, f, tau, theta, tauMag, sign };
  }

  function fmtTau(der) {
    const ch = der.sign >= 0 ? '+' : '−';
    return ch + der.tauMag.toFixed(2) + ' N·m';
  }

  function setTarget(newR, newF, animate) {
    if (animate) {
      anim = { fromR: dispR.clone(), fromF: dispF.clone(), toR: newR.clone(), toF: newF.clone(), start: performance.now(), dur: animate === true ? 420 : animate };
    } else {
      dispR.copy(newR); dispF.copy(newF); anim = null;
      settle();
    }
  }

  function tickAnim(now) {
    if (!anim) return;
    const t = clamp((now - anim.start) / anim.dur, 0, 1);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    dispR.copy(anim.fromR).lerp(anim.toR, e);
    dispF.copy(anim.fromF).lerp(anim.toF, e);
    if (t >= 1) { anim = null; settle(); }
  }

  function settle() {
    handCurl = { t0: performance.now(), dur: 520 };
    if (panelEls.tauVal) {
      panelEls.tauVal.classList.remove('tt3-bounce');
      void panelEls.tauVal.offsetWidth;
      panelEls.tauVal.classList.add('tt3-bounce');
    }
  }

  // ---------- geometry ----------
  function makeArrow(color, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    const shaftGeo = new THREE.CylinderGeometry(opts.thick || 0.032, opts.thick || 0.032, 1, 12);
    shaftGeo.translate(0, 0.5, 0);
    const headGeo = new THREE.ConeGeometry((opts.thick || 0.032) * 3, 0.22, 16);
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.4, metalness: 0.12,
      transparent: !!opts.transparent, opacity: opts.opacity != null ? opts.opacity : 1,
      emissive: opts.emissive != null ? opts.emissive : 0x000000, emissiveIntensity: opts.emissiveIntensity || 0
    });
    const shaft = new THREE.Mesh(shaftGeo, mat);
    const head = new THREE.Mesh(headGeo, mat);
    group.add(shaft, head);
    group.userData = { shaft, head, mat };
    return group;
  }

  function pointArrow(arrow, from, dir, len) {
    arrow.visible = len > 1e-4;
    if (!arrow.visible) return;
    const headLen = Math.min(0.22, len * 0.3);
    const shaftLen = Math.max(0.001, len - headLen);
    arrow.userData.shaft.scale.set(1, shaftLen, 1);
    arrow.userData.head.position.set(0, shaftLen + headLen / 2, 0);
    arrow.position.copy(from);
    arrow.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
  }

  function makeHandle(color) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(0.115, 20, 16),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.3 })
    );
  }

  function makeLabelSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 168; canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.62, 0.24, 1);
    sprite.userData = { canvas, ctx: canvas.getContext('2d'), tex, lastText: null };
    return sprite;
  }
  function updateLabelTexture(sprite, text) {
    if (sprite.userData.lastText === text) return;
    sprite.userData.lastText = text;
    const { ctx, canvas, tex } = sprite.userData;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '600 32px "IBM Plex Mono", monospace';
    const w = ctx.measureText(text).width + 26;
    ctx.fillStyle = 'rgba(18,28,38,.75)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((canvas.width - w) / 2, 12, w, 40, 10); ctx.fill(); }
    else ctx.fillRect((canvas.width - w) / 2, 12, w, 40);
    ctx.fillStyle = '#dff1ff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, 32);
    tex.needsUpdate = true;
  }

  function updateAngleArc(r, f, theta) {
    const axis = new THREE.Vector3().crossVectors(r, f);
    if (theta < 1e-3 || axis.lengthSq() < 1e-8) { angleArc.visible = false; angleLabel.visible = false; return; }
    angleArc.visible = true; angleLabel.visible = true;
    axis.normalize();
    const rDir = r.clone().normalize();
    const radius = 0.5, N = 24, pts = [];
    for (let i = 0; i <= N; i++) {
      const q = new THREE.Quaternion().setFromAxisAngle(axis, (i / N) * theta);
      pts.push(rDir.clone().applyQuaternion(q).multiplyScalar(radius));
    }
    angleArc.geometry.setFromPoints(pts);
    angleArc.computeLineDistances();
    angleLabel.position.copy(pts[Math.floor(pts.length / 2)].clone().multiplyScalar(1.35));
    updateLabelTexture(angleLabel, (theta / DEG).toFixed(1) + '°');
  }

  function buildHand() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8fd8ff, transparent: true, opacity: 0.5,
      emissive: 0x2a80c9, emissiveIntensity: 0.5, roughness: 0.35, depthWrite: false
    });
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.15, 4, 8), mat);
    group.add(palm);
    const thumb = makeArrow(0xbfe8ff, { thick: 0.03, transparent: true, opacity: 0.55, emissive: 0x2a80c9, emissiveIntensity: 0.5 });
    group.add(thumb);
    const fingers = [];
    for (let i = 0; i < 4; i++) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0, 0)]);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.026, 6, false), mat);
      group.add(mesh);
      fingers.push(mesh);
    }
    group.userData = { palm, thumb, fingers, mat };
    group.visible = false;
    return group;
  }

  function updateHand(r, f, tau, theta, curlT) {
    if (tau.length() < 1e-4 || curlT <= 0) { hand.visible = false; return; }
    hand.visible = true;
    const localY = tau.clone().normalize();
    const rDirRaw = r.clone().normalize();
    const localZ = new THREE.Vector3().crossVectors(localY, rDirRaw).normalize();
    const trueX = new THREE.Vector3().crossVectors(localZ, localY).normalize();

    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), localY);
    const th = hand.userData.thumb;
    th.setRotationFromQuaternion(q);
    th.userData.shaft.scale.set(1, 0.32, 1);
    th.userData.head.position.set(0, 0.32 + 0.09, 0);

    hand.userData.palm.position.copy(localY.clone().multiplyScalar(-0.05));
    hand.userData.palm.setRotationFromQuaternion(q);

    const maxAngle = Math.max(theta, 12 * DEG);
    const offsets = [-0.17, -0.06, 0.06, 0.17];
    hand.userData.fingers.forEach((mesh, i) => {
      const base = localZ.clone().multiplyScalar(offsets[i]).add(localY.clone().multiplyScalar(-0.08));
      const pts = [base.clone()];
      let p = base.clone();
      const steps = 6;
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const ang = maxAngle * curlT * frac * frac;
        const dir = trueX.clone().applyAxisAngle(localY, ang);
        p = p.clone().add(dir.multiplyScalar(0.05));
        pts.push(p.clone());
      }
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.026, 6, false);
    });

    const towardCam = localY.dot(camera.position.clone().normalize()) > 0.15;
    const fadeIn = Math.min(1, curlT * 2.2);
    hand.scale.setScalar((towardCam ? 1.16 : 0.86) * (0.7 + 0.3 * fadeIn));
    hand.userData.mat.opacity = (towardCam ? 0.66 : 0.32) * fadeIn;
    hand.userData.mat.emissiveIntensity = (towardCam ? 0.85 : 0.3) * fadeIn;
  }

  function applyCam() {
    camera.position.set(
      dist * Math.cos(elev) * Math.sin(az),
      dist * Math.sin(elev) + 0.35,
      dist * Math.cos(elev) * Math.cos(az)
    );
    camera.lookAt(0, 0.25, 0);
  }

  // ---------- panel ----------
  function buildPanel(hostEl) {
    ensureStyle();
    panel = document.createElement('div');
    panel.className = 'tt3-panel';
    panel.innerHTML = `
      <div class="tt3-kicker"><span><span class="tt3-dot"></span>TORQUE · 力矩 3D</span><button class="tt3-reset" data-reset>↺ 重設</button></div>
      <div class="tt3-modes">
        <button data-mode="drag">自由拖曳</button>
        <button data-mode="preset">預設情境</button>
      </div>
      <div class="tt3-row"><b>r</b><span data-f="r"></span></div>
      <div class="tt3-row"><b>F</b><span data-f="F"></span></div>
      <div class="tt3-row"><b>θ</b><span data-f="theta"></span></div>
      <div class="tt3-row"><b>τ</b><span data-f="tau"></span></div>
      <div class="tt3-presets" data-presets></div>
    `;
    hostEl.appendChild(panel);
    panelEls.rVal = panel.querySelector('[data-f="r"]');
    panelEls.fVal = panel.querySelector('[data-f="F"]');
    panelEls.thetaVal = panel.querySelector('[data-f="theta"]');
    panelEls.tauVal = panel.querySelector('[data-f="tau"]');
    panelEls.presets = panel.querySelector('[data-presets]');
    panel.querySelector('[data-reset]').addEventListener('click', () => doReset());
    panel.querySelectorAll('.tt3-modes > button').forEach(b => b.addEventListener('click', () => switchMode(b.dataset.mode)));
    renderPresetSection();
  }

  function updateModeButtons() {
    panel.querySelectorAll('.tt3-modes > button[data-mode]').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  }

  function planarTargets() {
    const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
    const r = X.clone().multiplyScalar(state.presetR);
    const f = planarVec(X, state.presetTheta, state.presetCCW, state.presetF, Y);
    return { r, f };
  }

  function switchMode(m) {
    if (m === state.mode) return;
    state.mode = m;
    updateModeButtons();
    if (m === 'preset') {
      const der = derive(dispR, dispF);
      state.presetR = Math.round(clamp(dispR.length(), 0.4, 2.8) * 10) / 10;
      state.presetF = Math.round(clamp(dispF.length(), 0.3, 2.6) * 10) / 10;
      state.presetTheta = Math.round(clamp(der.theta / DEG, 1, 179));
      state.presetCCW = der.sign >= 0;
      state.activePresetId = null;
      const t = planarTargets();
      setTarget(t.r, t.f, true);
    }
    renderPresetSection();
  }

  function commitPresetInputs() {
    const t = planarTargets();
    setTarget(t.r, t.f, 220);
  }

  function applyPreset(p) {
    state.presetR = p.r; state.presetF = p.f; state.presetTheta = p.theta; state.presetCCW = p.ccw;
    state.activePresetId = p.id;
    const t = planarTargets();
    setTarget(t.r, t.f, true);
    renderPresetSection();
  }

  function renderPresetSection() {
    if (!panelEls.presets) return;
    if (state.mode === 'drag') {
      panelEls.presets.innerHTML = `<div class="tt3-hint">拖曳圖中金色（r）、青色（F）球體控制點，放開後自動顯示右手判斷。</div>`;
      return;
    }
    const custom = loadCustomPresets();
    const all = BUILTIN_PRESETS.concat(custom);
    panelEls.presets.innerHTML = `
      <select data-presetSelect>
        <option value="">— 自訂數值 —</option>
        ${all.map(p => `<option value="${p.id}" ${p.id === state.activePresetId ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select>
      <div class="tt3-row"><b>r</b><input type="number" step="0.1" min="0.4" max="2.8" data-in="presetR" value="${state.presetR}"></div>
      <div class="tt3-row"><b>F</b><input type="number" step="0.1" min="0.3" max="2.6" data-in="presetF" value="${state.presetF}"></div>
      <div class="tt3-row"><b>θ</b><input type="number" step="1" min="1" max="179" data-in="presetTheta" value="${state.presetTheta}"></div>
      <div class="tt3-modes">
        <button data-ccw="1" class="${state.presetCCW ? 'active' : ''}">逆時針 +</button>
        <button data-ccw="0" class="${!state.presetCCW ? 'active' : ''}">順時針 −</button>
      </div>
      <div class="tt3-prow"><button class="tt3-add" data-addPreset>＋ 存成情境</button></div>
      <div class="tt3-list">${custom.map(p => `<div class="tt3-litem"><span>${p.label}</span><button data-delPreset="${p.id}">×</button></div>`).join('')}</div>
    `;
    const sel = panelEls.presets.querySelector('[data-presetSelect]');
    sel.addEventListener('change', () => {
      if (!sel.value) { state.activePresetId = null; return; }
      const p = all.find(x => x.id === sel.value);
      if (p) applyPreset(p);
    });
    panelEls.presets.querySelectorAll('input[data-in]').forEach(input => {
      input.addEventListener('change', () => {
        const key = input.dataset.in;
        state[key] = key === 'presetTheta' ? clamp(parseFloat(input.value) || 0, 1, 179) : clamp(parseFloat(input.value) || 0, key === 'presetF' ? 0.3 : 0.4, key === 'presetF' ? 2.6 : 2.8);
        state.activePresetId = null;
        commitPresetInputs();
      });
    });
    panelEls.presets.querySelectorAll('[data-ccw]').forEach(b => b.addEventListener('click', () => {
      state.presetCCW = b.dataset.ccw === '1';
      state.activePresetId = null;
      commitPresetInputs();
      renderPresetSection();
    }));
    const addBtn = panelEls.presets.querySelector('[data-addPreset]');
    if (addBtn) addBtn.addEventListener('click', () => {
      const label = window.prompt('情境名稱：', `r=${state.presetR} F=${state.presetF} θ=${state.presetTheta}°`);
      if (label == null) return;
      const list = loadCustomPresets();
      const p = { id: 'custom-' + Date.now(), label: label || '未命名情境', r: state.presetR, f: state.presetF, theta: state.presetTheta, ccw: state.presetCCW };
      list.push(p);
      saveCustomPresets(list);
      state.activePresetId = p.id;
      renderPresetSection();
    });
    panelEls.presets.querySelectorAll('[data-delPreset]').forEach(b => b.addEventListener('click', () => {
      const list = loadCustomPresets().filter(p => p.id !== b.dataset.delPreset);
      saveCustomPresets(list);
      if (state.activePresetId === b.dataset.delPreset) state.activePresetId = null;
      renderPresetSection();
    }));
  }

  // ---------- interaction ----------
  function ndcFromEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }
  function raycastPlane(e, plane) {
    ndcFromEvent(e);
    ray.setFromCamera(mouseNDC, camera);
    const pt = new THREE.Vector3();
    return ray.ray.intersectPlane(plane, pt) ? pt : null;
  }
  function hitHandle(e) {
    ndcFromEvent(e);
    ray.setFromCamera(mouseNDC, camera);
    const hits = ray.intersectObjects([rHandle, fHandle], false);
    return hits[0] ? (hits[0].object === rHandle ? 'r' : 'f') : null;
  }
  function planeFromPoint(point) {
    const normal = new THREE.Vector3().subVectors(camera.position, point).normalize();
    return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
  }

  function onPointerDown(e) {
    if (state.mode === 'drag') {
      const hit = hitHandle(e);
      if (hit) {
        dragTarget = hit;
        dragPlane = hit === 'r' ? new THREE.Plane(new THREE.Vector3(0, 1, 0), 0) : planeFromPoint(dispR.clone().add(dispF));
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
    }
    orbitDragging = true; lastX = e.clientX; lastY = e.clientY;
  }
  function onPointerMove(e) {
    if (dragTarget) {
      const p = raycastPlane(e, dragPlane);
      if (!p) return;
      if (dragTarget === 'r') {
        const len = clamp(p.length(), 0.4, 2.8);
        dispR.copy(p.lengthSq() < 1e-6 ? new THREE.Vector3(1, 0, 0) : p.clone().setLength(len));
      } else {
        const v = p.clone().sub(dispR);
        const len = clamp(v.length(), 0.3, 2.6);
        dispF.copy(v.lengthSq() < 1e-6 ? new THREE.Vector3(0, 1, 0) : v.clone().setLength(len));
      }
      state.activePresetId = null;
      return;
    }
    if (orbitDragging) {
      az -= (e.clientX - lastX) * 0.008;
      elev = clamp(elev + (e.clientY - lastY) * 0.008, 0.05, 1.3);
      lastX = e.clientX; lastY = e.clientY;
      applyCam();
    }
  }
  function onPointerUp() {
    if (dragTarget) { dragTarget = null; settle(); }
    orbitDragging = false;
  }
  function onWheel(e) {
    e.preventDefault();
    dist = clamp(dist + e.deltaY * 0.003, 2.8, 9);
    applyCam();
  }

  function doReset() {
    state.mode = 'drag';
    state.activePresetId = null;
    state.presetR = 1.6; state.presetF = 1.3; state.presetTheta = 70; state.presetCCW = true;
    if (panel) { updateModeButtons(); renderPresetSection(); }
    setTarget(r0, f0, true);
  }

  // ---------- frame ----------
  function draw(now) {
    tickAnim(now);
    const der = derive(dispR, dispF);
    pointArrow(rArrow, new THREE.Vector3(), dispR.clone().normalize(), dispR.length());
    pointArrow(fArrow, dispR, dispF.clone().normalize(), dispF.length());
    rHandle.position.copy(dispR);
    fHandle.position.copy(dispR.clone().add(dispF));
    updateAngleArc(dispR, dispF, der.theta);

    const curlT = handCurl ? clamp((now - handCurl.t0) / handCurl.dur, 0, 1) : 0;
    updateHand(dispR, dispF, der.tau, der.theta, curlT);

    renderer.render(scene, camera);

    if (panelEls.rVal) {
      panelEls.rVal.textContent = dispR.length().toFixed(2) + ' m';
      panelEls.fVal.textContent = dispF.length().toFixed(2) + ' N';
      panelEls.thetaVal.textContent = (der.theta / DEG).toFixed(1) + '°';
      panelEls.tauVal.textContent = fmtTau(der);
    }
    if (readoutsCb) {
      readoutsCb([
        { k: 'r', v: dispR.length().toFixed(2) + ' m' },
        { k: 'F', v: dispF.length().toFixed(2) + ' N' },
        { k: 'θ', v: (der.theta / DEG).toFixed(1) + '°' },
        { k: 'τ', v: fmtTau(der) }
      ]);
    }
  }

  return {
    async mount(hostEl) {
      el = hostEl;
      THREE = await ensureThree();
      if (disposed) return;

      ray = new THREE.Raycaster();
      mouseNDC = new THREE.Vector2();
      dragPlane = new THREE.Plane();

      r0 = new THREE.Vector3(1.6, 0, 0);
      f0 = planarVec(new THREE.Vector3(1, 0, 0), 70, true, 1.3, new THREE.Vector3(0, 1, 0));
      dispR = r0.clone(); dispF = f0.clone();

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(45, 1, 0.1, 50);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.cssText = 'position:absolute; inset:0; touch-action:none; cursor:grab;';
      el.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xfff2df, 0.75));
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
      keyLight.position.set(3, 4, 2);
      scene.add(keyLight);

      platform = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.4, 0.05, 48),
        new THREE.MeshStandardMaterial({ color: 0x4fc3ff, transparent: true, opacity: 0.1, roughness: 0.6 })
      );
      platform.position.y = -0.03;
      scene.add(platform);
      scene.add(new THREE.AxesHelper(0.85));

      rArrow = makeArrow(0xd9a441); scene.add(rArrow);
      fArrow = makeArrow(0x4fc3ff); scene.add(fArrow);
      rHandle = makeHandle(0xd9a441); scene.add(rHandle);
      fHandle = makeHandle(0x4fc3ff); scene.add(fHandle);

      angleArc = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: 0xbfe3ff, dashSize: 0.05, gapSize: 0.04, transparent: true, opacity: 0.85 }));
      scene.add(angleArc);
      angleLabel = makeLabelSprite();
      scene.add(angleLabel);

      hand = buildHand();
      scene.add(hand);

      buildPanel(el);

      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

      const resize = () => {
        const w = el.clientWidth || 1, h = el.clientHeight || 1;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      if (window.ResizeObserver) { ro = new ResizeObserver(resize); ro.observe(el); }
      window.addEventListener('resize', resize);

      applyCam();
      resize();
      settle();

      const loop = (t) => { raf = requestAnimationFrame(loop); draw(t); };
      raf = requestAnimationFrame(loop);
    },

    unmount() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (renderer) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('wheel', onWheel);
        renderer.dispose();
      }
      if (el) el.innerHTML = '';
    },

    onReadouts(cb) { readoutsCb = cb; },

    reset() { doReset(); }
  };
}
