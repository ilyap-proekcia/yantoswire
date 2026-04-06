/**
 * scene.js — Three.js scene setup
 *
 * Creates and exports (as globals):
 *   renderer, scene, camera
 *
 * Also sets up lights and the ground plane.
 *
 * ─── Loading 3D models ────────────────────────────────────────
 * To swap the procedural fence for a .glb/.gltf model:
 *   1. Drop the file into assets/models/
 *   2. Add the GLTFLoader script to index.html (or import it)
 *   3. Load it here:
 *
 *      const loader = new THREE.GLTFLoader();
 *      loader.load('assets/models/your-model.glb', (gltf) => {
 *        scene.add(gltf.scene);
 *      });
 */

// ─── RENDERER ─────────────────────────────────────────────────
const canvas   = document.getElementById('main-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.outputEncoding      = THREE.sRGBEncoding;
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.82;
// Start transparent so the hero background photo shows through
renderer.setClearColor(0x000000, 0);

// ─── SCENE ────────────────────────────────────────────────────
const scene = new THREE.Scene();
// No background in hero mode — photo shows through the transparent canvas
scene.background = null;
scene.fog        = null;

// ─── CAMERA ───────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 300);

// ─── LIGHTS ───────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xf0ece4, 0.4));

const sun = new THREE.DirectionalLight(0xfffaf0, 3.0);
sun.position.set(2, 16, 22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { near: 0.5, far: 80, left: -30, right: 30, top: 20, bottom: -10 });
sun.shadow.bias = -0.0003;
scene.add(sun);

const fill2 = new THREE.DirectionalLight(0xd0dde8, 0.8);
fill2.position.set(-8, 5, -5);
scene.add(fill2);

scene.add(new THREE.HemisphereLight(0xe8f0f5, 0xd4cfc5, 0.35));

// ─── SHADOW CATCHER ───────────────────────────────────────────
// opacity    — темнота тени (0–1)
// fadeStart  — с какого расстояния (м) начинает таять
// fadeDist   — на каком расстоянии (м) полностью исчезает
const shadowMat = new THREE.ShadowMaterial({ opacity: 0.20, transparent: true });
shadowMat.onBeforeCompile = (shader) => {
  shader.uniforms._fadeStart = { value: 0.10 };
  shader.uniforms._fadeDist  = { value: 2.0 };
  // Сохраняем ссылку на uniforms для debug-панели
  shadowMat.userData._shader = shader;

  shader.vertexShader = 'varying float vWorldZ;\n' + shader.vertexShader;
  shader.vertexShader = shader.vertexShader.replace(
    'void main() {',
    'void main() {\n  vWorldZ = (modelMatrix * vec4(position, 1.0)).z;'
  );
  shader.fragmentShader =
    'varying float vWorldZ;\nuniform float _fadeStart;\nuniform float _fadeDist;\n'
    + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    /gl_FragColor\s*=\s*vec4\(\s*color,\s*opacity\s*\*\s*\(\s*1\.0\s*-\s*getShadowMask\(\)\s*\)\s*\);/,
    `float _d = max(0.0, -vWorldZ - _fadeStart) / max(_fadeDist, 0.001);
     float _fade = 1.0 - smoothstep(0.0, 1.0, _d);
     gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) * _fade );`
  );
};

const shadowCatcher = new THREE.Mesh(
  new THREE.PlaneGeometry(36, 16),
  shadowMat
);
shadowCatcher.rotation.x    = -Math.PI / 2;
shadowCatcher.position.y    = 0.002;
shadowCatcher.receiveShadow = true;
scene.add(shadowCatcher);

// ─── GROUND ───────────────────────────────────────────────────
const gnd = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 40),
  new THREE.MeshBasicMaterial({ color: 0xF5F4F0 })
);
gnd.rotation.x    = -Math.PI / 2;
gnd.receiveShadow = false; // shadows shown via shadowCatcher above
gnd.visible       = false; // hidden in hero mode; shown in configurator
scene.add(gnd);
window.gnd = gnd; // expose for dev tools

// grid removed — clean floor only

// ─── ENVIRONMENT MAP (HDR) ────────────────────────────────────
// Даёт металлу реалистичные отражения.
// Чтобы поменять файл: замени studio.hdr в assets/envmaps/
// и при необходимости обнови путь ниже.
(function loadEnvMap() {
  const pmrem  = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  new THREE.RGBELoader()
    .setDataType(THREE.UnsignedByteType)
    .load('assets/envmaps/studio.hdr', (hdrTexture) => {
      const envMap = pmrem.fromEquirectangular(hdrTexture).texture;
      scene.environment = envMap; // освещает все MeshStandardMaterial объекты
      hdrTexture.dispose();
      pmrem.dispose();
    });
})();

// ─── RENDER-ON-DEMAND ─────────────────────────────────────────
// Instead of rendering every frame unconditionally, we only render
// when something has changed. Call invalidate() whenever the scene
// needs to be redrawn (camera move, fence rebuild, UI change, etc.)
let _needsRender = true;
function invalidate() { _needsRender = true; }
function consumeRender() {
  const v = _needsRender;
  _needsRender = false;
  return v;
}

// ─── HERO ↔ CONFIGURATOR SWITCH ───────────────────────────────
// Called from main.js when the user enters the configurator.
// Restores the solid background.
function enterConfigMode() {
  scene.background = new THREE.Color(0xC3AD8B);
  scene.fog        = new THREE.FogExp2(0xC3AD8B, 0.008);
  renderer.setClearColor(0xC3AD8B, 1);
  invalidate();
}
