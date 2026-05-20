import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface VibeParams {
  exposure: number
  bloomStrength: number
  glow: number
  shakeIntensity: number
  resolutionScale: number
}

const BANDS = 96
const BASS_END = 14
const MID_END = 232
const TREBLE_END = 929
const BLOOM_SCALE = 0.25
const MAX_DPR = 1.5

const MASK_HEIGHT_RATIO = 0.30
const MASK_FACTOR = MASK_HEIGHT_RATIO / 0.35
const HEAD_SCALE = 6.8 / MASK_FACTOR
const EAR_SCALE = 11.5 / MASK_FACTOR
const EAR_OFFSET_X = 0.08 * MASK_FACTOR
const EAR_OFFSET_Y = 0.085 * MASK_FACTOR
const HEAD_OFFSET_Y = 0.018 * MASK_FACTOR
const MASK_ROUND = 0.010 * MASK_FACTOR
const EDGE_DECAY = 28 / MASK_FACTOR
const HALO_A_DECAY = 28 / MASK_FACTOR
const HALO_B_DECAY = 14 / MASK_FACTOR
const HALO_C_DECAY = 6 / MASK_FACTOR
const SDF_OUTER = 0.002 * MASK_FACTOR
const SDF_INNER = -0.010 * MASK_FACTOR
const RING_GAP_UV = 0.008
const RING_BASE = MASK_HEIGHT_RATIO / 2 + RING_GAP_UV
const RING_CORE_W = 0.002
const RING_INNER_W = 0.008
const RING_MID_W = 0.016
const RING_OUTER_W = 0.028

const GOLD = 'vec3(1.000, 0.843, 0.000)'
const RED = 'vec3(1.000, 0.000, 0.000)'

const VS_QUAD = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FS_SCENE = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uAspect;
uniform vec2 uShake;
uniform float uZoom;
uniform float uShakeRot;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform float uBeatKick;
uniform float uPalette;
uniform float uGlow;
uniform float uTitleScale;
uniform float uTitleOpacity;
uniform float uTrailPhase;
uniform float uTrailEnergy;
uniform float uBands[${BANDS}];
uniform sampler2D uTitle;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int k = 0; k < 3; k++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}
float sdTri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) * 0.5;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdMask(vec2 p) {
  vec2 hp = vec2(p.x, -(p.y + ${HEAD_OFFSET_Y})) * ${HEAD_SCALE};
  float head = sdTri(hp, 0.9) / ${HEAD_SCALE};
  vec2 elp = (p - vec2(-${EAR_OFFSET_X}, ${EAR_OFFSET_Y})) * ${EAR_SCALE};
  vec2 erp = (p - vec2( ${EAR_OFFSET_X}, ${EAR_OFFSET_Y})) * ${EAR_SCALE};
  float earL = sdTri(elp, 0.85) / ${EAR_SCALE};
  float earR = sdTri(erp, 0.85) / ${EAR_SCALE};
  float d = min(head, min(earL, earR));
  return d - ${MASK_ROUND};
}

void main() {
  vec2 c = vUv - 0.5;
  float sr = sin(uShakeRot);
  float cr = cos(uShakeRot);
  c = vec2(c.x * cr - c.y * sr, c.x * sr + c.y * cr);
  vec2 uv = c * uZoom + 0.5 + uShake;
  vec2 p = uv - 0.5;
  p.x *= uAspect;
  float r = length(p);
  float ang = atan(p.y, p.x);

  vec3 accent = mix(${GOLD}, ${RED}, clamp(uPalette, 0.0, 1.0));

  vec2 bgUv = uv * vec2(uAspect, 1.0);
  float nA = fbm(bgUv * 1.8 + uTime * 0.02);
  float nB = fbm(bgUv * 3.2 - 2.1);
  vec2 bgC = vUv - 0.5;
  bgC.x *= uAspect;
  float radial = 1.0 - smoothstep(0.0, 0.9, length(bgC));
  float vGrad = 1.0 - vUv.y * 0.25;
  vec3 col = vec3(0.020, 0.028, 0.055) * vGrad;
  col += vec3(0.045, 0.075, 0.155) * radial * 0.55;
  col += vec3(0.040, 0.065, 0.135) * nA * 0.40;
  col += vec3(0.055, 0.085, 0.150) * nB * 0.25;
  col *= 1.0 + uBass * 0.12;

  float rays = pow(abs(cos(ang * 5.0 + uTime * 0.22)), 8.0);
  rays *= smoothstep(0.45, 0.05, r);
  rays *= 0.30 + uMid * 1.0 + uBeatKick * 0.35;
  col += accent * rays * 0.6;

  float absX = abs(p.x);
  float trailY = abs(p.y);
  if (trailY < 0.08 && absX > 0.15 && absX < 0.5) {
    float seg = (absX - 0.15) / 0.35 * 8.0;
    float segI = floor(seg);
    float segF = fract(seg);
    float phase = uTrailPhase - segI * 0.12;
    float pulse = clamp(sin(phase * 6.28) * 0.5 + 0.5, 0.0, 1.0);
    pulse = pow(pulse, 3.0);
    float wobble = sin(segI * 7.3 + uTime * 0.5) * 0.008;
    float yDist = abs(p.y - wobble);
    float line = 1.0 - smoothstep(0.0, 0.004, yDist);
    float lineGlow = 1.0 - smoothstep(0.0, 0.018, yDist);
    float lineHalo = 1.0 - smoothstep(0.0, 0.045, yDist);
    float segMask = 1.0 - smoothstep(0.7, 1.0, segF);
    float intensity = pulse * segMask * (0.3 + uTrailEnergy);
    col += vec3(1.0, 1.0, 1.0) * line * intensity * 1.8;
    col += vec3(1.0, 1.0, 1.0) * lineGlow * intensity * 0.6;
    col += vec3(1.0, 0.95, 0.88) * lineHalo * intensity * 0.25;
  }

  float normAng = (ang + 3.14159265) / 6.28318530;
  float fi = normAng * float(${BANDS});
  float fiF = floor(fi);
  float ft = fract(fi);
  int bi0 = int(mod(fiF, float(${BANDS})));
  int bi1 = int(mod(fiF + 1.0, float(${BANDS})));
  float b0 = 0.0;
  float b1 = 0.0;
  for (int i = 0; i < ${BANDS}; i++) {
    if (i == bi0) b0 = uBands[i];
    if (i == bi1) b1 = uBands[i];
  }
  float ts = smoothstep(0.0, 1.0, ft);
  float bandSm = mix(b0, b1, ts);
  float waveR = ${RING_BASE} + uBass * 0.006 + uMid * 0.005 + min(bandSm, 0.8) * 0.025;
  float waveD = abs(r - waveR);
  float wCore = 1.0 - smoothstep(0.0, ${RING_CORE_W}, waveD);
  float wInner = 1.0 - smoothstep(0.0, ${RING_INNER_W}, waveD);
  float wMid = 1.0 - smoothstep(0.0, ${RING_MID_W}, waveD);
  float wOuter = 1.0 - smoothstep(0.0, ${RING_OUTER_W}, waveD);
  vec3 coreCol = mix(vec3(1.000, 1.000, 1.000), vec3(1.000, 0.000, 0.000), clamp(uBeatKick * 0.8, 0.0, 1.0));
  col += coreCol * wCore * 1.4;
  col += vec3(1.000, 0.980, 0.941) * wInner * 0.9;
  col += vec3(1.000, 0.843, 0.000) * wMid * 0.5;
  col += vec3(1.000, 0.533, 0.000) * wOuter * 0.25;

  float d = sdMask(p);
  float fill = smoothstep(${SDF_OUTER}, ${SDF_INNER}, d);
  float edge = exp(-abs(d) * ${EDGE_DECAY}) * 0.90;
  float haloA = exp(-max(d, 0.0) * ${HALO_A_DECAY}) * 0.55;
  float haloB = exp(-max(d, 0.0) * ${HALO_B_DECAY}) * 0.25;
  float haloC = exp(-max(d, 0.0) * ${HALO_C_DECAY})  * 0.10;
  col += ${GOLD} * 0.80 * uGlow * fill;
  col += accent * (edge + haloA + haloB + haloC) * uGlow;

  float flare = exp(-abs(p.y) * 55.0) * smoothstep(0.50, 0.0, abs(p.x));
  flare *= 0.25 + uTreble * 0.9 + uBeatKick * 0.3;
  col += ${GOLD} * flare * 0.55;

  vec2 tuv = (uv - vec2(0.5, 0.52)) / uTitleScale + vec2(0.5, 0.5);
  if (tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) {
    vec4 tx = texture2D(uTitle, tuv);
    float tm = tx.a * uTitleOpacity * fill;
    col = mix(col, vec3(0.020, 0.016, 0.014), tm * (0.90 + uBeatKick * 0.08));
  }

  gl_FragColor = vec4(col, 1.0);
}
`

const FS_BLUR = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
uniform float uThreshold;

void main() {
  float w[9];
  w[0] = 0.05; w[1] = 0.09; w[2] = 0.12; w[3] = 0.15; w[4] = 0.18;
  w[5] = 0.15; w[6] = 0.12; w[7] = 0.09; w[8] = 0.05;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 9; i++) {
    vec2 o = uDir * (float(i) - 4.0);
    vec3 s = texture2D(uTex, vUv + o).rgb;
    if (uThreshold > 0.0) {
      float m = max(s.r, max(s.g, s.b));
      s *= max(0.0, m - uThreshold);
    }
    c += s * w[i];
  }
  gl_FragColor = vec4(c, 1.0);
}
`

const FS_FINAL = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2 uResolution;
uniform float uTime;
uniform float uRadial;
uniform float uSamples;
uniform float uCA;
uniform float uBloomStr;
uniform float uExposure;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 dir = vUv - 0.5;

  vec3 scene = vec3(0.0);
  if (uRadial > 0.001) {
    float w[4];
    w[0] = 0.4; w[1] = 0.3; w[2] = 0.2; w[3] = 0.1;
    int mx = int(uSamples);
    float denom = max(float(mx) - 1.0, 1.0);
    float wsum = 0.0;
    for (int i = 0; i < 4; i++) {
      if (i < mx) {
        float tt = float(i) / denom;
        vec2 su = vUv - dir * tt * uRadial;
        scene += texture2D(uScene, su).rgb * w[i];
        wsum += w[i];
      }
    }
    scene /= max(wsum, 0.001);
  } else {
    scene = texture2D(uScene, vUv).rgb;
  }

  vec2 caOff = dir * uCA;
  float rCh = texture2D(uScene, vUv + caOff).r;
  float bCh = texture2D(uScene, vUv - caOff).b;
  scene.r = mix(scene.r, rCh, 0.45);
  scene.b = mix(scene.b, bCh, 0.45);

  vec3 bloom = texture2D(uBloom, vUv).rgb;
  vec3 col = scene + bloom * uBloomStr;
  col *= uExposure;

  col += (hash(vUv * uResolution + uTime) - 0.5) * 0.035;

  float vig = 1.0 - smoothstep(0.50, 1.15, length(dir) * 1.25);
  col *= 0.45 + vig * 0.55;

  gl_FragColor = vec4(col, 1.0);
}
`

function bakeTitle(canvas: HTMLCanvasElement, text: string, w: number, h: number) {
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  let t = (text || 'MUSIC').toUpperCase().trim()
  const font = (px: number) => `900 ${px}px "Arial Black", "Helvetica Neue", system-ui, sans-serif`
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if ('letterSpacing' in ctx) (ctx as unknown as { letterSpacing: string }).letterSpacing = '-1px'
  const maxW = w * 0.10
  let fs = Math.max(10, h * MASK_HEIGHT_RATIO * 0.09)
  ctx.font = font(fs)
  while (ctx.measureText(t).width > maxW && fs > 10) {
    fs = Math.max(10, fs - 2)
    ctx.font = font(fs)
  }
  if (ctx.measureText(t).width > maxW && t.includes(' ')) {
    const words = t.split(' ')
    const splitIdx = Math.floor(words.length / 2)
    const bestLine1 = words.slice(0, splitIdx).join(' ')
    const bestLine2 = words.slice(splitIdx).join(' ')
    const line1W = ctx.measureText(bestLine1).width
    const line2W = ctx.measureText(bestLine2).width
    if (line1W <= maxW && line2W <= maxW) {
      const lineH = fs * 1.1
      ctx.fillText(bestLine1, w / 2, h / 2 - lineH * 0.5)
      ctx.fillText(bestLine2, w / 2, h / 2 + lineH * 0.5)
      return
    }
  }
  if (ctx.measureText(t).width > maxW) {
    while (ctx.measureText(t + '\u2026').width > maxW && t.length > 1) {
      t = t.slice(0, -1).trimEnd()
    }
    t = t + '\u2026'
  }
  ctx.fillText(t, w / 2, h / 2)
}

export function VibeVisualizer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef(0)

  const params = useVisualizerParams<VibeParams>('vibe')
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let W = window.innerWidth
    let H = window.innerHeight
    const deviceCap = window.devicePixelRatio || 1
    const resolveDpr = (scale: number) =>
      Math.min(Math.max(0.5, scale), 2, deviceCap, MAX_DPR)
    let dpr = resolveDpr(paramsRef.current.resolutionScale)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(dpr)
    container.appendChild(renderer.domElement)

    const quadGeom = new THREE.PlaneGeometry(2, 2)
    const cam = new THREE.Camera()
    const qScene = new THREE.Scene()

    function makeRT(w: number, h: number) {
      return new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      })
    }
    let sceneRT = makeRT(Math.round(W * dpr), Math.round(H * dpr))
    const bW = () => Math.max(2, Math.round(W * dpr * BLOOM_SCALE))
    const bH = () => Math.max(2, Math.round(H * dpr * BLOOM_SCALE))
    const bloomA = makeRT(bW(), bH())
    const bloomB = makeRT(bW(), bH())

    const titleCanvas = document.createElement('canvas')
    const titleTex = new THREE.CanvasTexture(titleCanvas)
    titleTex.minFilter = THREE.LinearFilter
    titleTex.magFilter = THREE.LinearFilter
    titleTex.wrapS = THREE.ClampToEdgeWrapping
    titleTex.wrapT = THREE.ClampToEdgeWrapping
    let lastTitle = ''
    let titleOpacity = 0
    function retitle(text: string) {
      bakeTitle(titleCanvas, text, Math.round(W * dpr), Math.round(H * dpr))
      titleTex.needsUpdate = true
      lastTitle = text
      titleOpacity = 0
    }
    retitle('')

    const bands = new Float32Array(BANDS)
    const bandsSm = new Float32Array(BANDS)

    const sceneMat = new THREE.ShaderMaterial({
      vertexShader: VS_QUAD,
      fragmentShader: FS_SCENE,
      uniforms: {
        uTime: { value: 0 },
        uAspect: { value: W / H },
        uShake: { value: new THREE.Vector2() },
        uZoom: { value: 1 },
        uShakeRot: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uBeatKick: { value: 0 },
        uPalette: { value: 0 },
        uGlow: { value: 1 },
        uTitleScale: { value: 1 },
        uTitleOpacity: { value: 0 },
        uTrailPhase: { value: 0 },
        uTrailEnergy: { value: 0 },
        uBands: { value: bands },
        uTitle: { value: titleTex },
      },
    })

    const blurMat = new THREE.ShaderMaterial({
      vertexShader: VS_QUAD,
      fragmentShader: FS_BLUR,
      uniforms: {
        uTex: { value: null },
        uDir: { value: new THREE.Vector2() },
        uThreshold: { value: 0 },
      },
    })

    const finalMat = new THREE.ShaderMaterial({
      vertexShader: VS_QUAD,
      fragmentShader: FS_FINAL,
      uniforms: {
        uScene: { value: null },
        uBloom: { value: null },
        uResolution: { value: new THREE.Vector2(W * dpr, H * dpr) },
        uTime: { value: 0 },
        uRadial: { value: 0 },
        uSamples: { value: 4 },
        uCA: { value: 0 },
        uBloomStr: { value: 1 },
        uExposure: { value: 1.0 },
      },
    })

    const quad = new THREE.Mesh(quadGeom, sceneMat)
    qScene.add(quad)

    let t = 0
    let bassSm = 0, midSm = 0, trebleSm = 0
    let kick = 0
    let palette = 0, glowSm = 1
    let zoomSm = 1
    let caSm = 0, bloomSm = 1
    let exposureSm = 0.5
    let titleScaleSm = 1
    const shake = { x: 0, y: 0 }
    let trebleCam = 0
    let zoomKick = 0
    let trauma = 0
    const traumaPos = { x: 0, y: 0, r: 0 }
    const traumaVel = { x: 0, y: 0, r: 0 }
    let pauseGate = 1
    let lastFrameT = 0
    let lowFpsFrames = 0
    let motionSamples = 4
    let trailPhase = 0
    let sceneTime = 0

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      renderer.setSize(W, H)
      sceneRT.setSize(Math.round(W * dpr), Math.round(H * dpr))
      bloomA.setSize(bW(), bH())
      bloomB.setSize(bW(), bH())
      sceneMat.uniforms.uAspect.value = W / H
      finalMat.uniforms.uResolution.value.set(W * dpr, H * dpr)
      retitle(lastTitle)
    }
    window.addEventListener('resize', resize)

    function tick() {
      const { audioData, energy, beat, trackInfo, isPlaying } = useAudioStore.getState()
      const pp = paramsRef.current
      t++

      const wantDpr = resolveDpr(pp.resolutionScale)
      if (wantDpr !== dpr) {
        dpr = wantDpr
        renderer.setPixelRatio(dpr)
        resize()
      }

      const nowT = performance.now()
      if (lastFrameT > 0) {
        const fps = 1000 / (nowT - lastFrameT)
        if (fps < 50) lowFpsFrames++
        else lowFpsFrames = 0
        if (motionSamples === 4 && lowFpsFrames > 100) {
          motionSamples = 2
        }
      }
      lastFrameT = nowT

      if (trackInfo.title !== lastTitle) retitle(trackInfo.title)

      if (audioData.length >= TREBLE_END) {
        let bs = 0, ms = 0, tr = 0
        for (let i = 0; i < BASS_END; i++) bs += audioData[i]
        for (let i = BASS_END; i < MID_END; i++) ms += audioData[i]
        for (let i = MID_END; i < TREBLE_END; i++) tr += audioData[i]
        const bass = bs / BASS_END
        const mid = (ms / (MID_END - BASS_END)) * 1.2
        const treble = (tr / (TREBLE_END - MID_END)) * 1.6

        const BAND_LO = BASS_END
        const logLo = Math.log(BAND_LO)
        const logHi = Math.log(TREBLE_END)
        const raw = new Array<number>(BANDS)
        for (let i = 0; i < BANDS; i++) {
          const binStart = Math.floor(Math.exp(logLo + ((logHi - logLo) * i) / BANDS))
          let binEnd = Math.floor(Math.exp(logLo + ((logHi - logLo) * (i + 1)) / BANDS))
          if (binEnd <= binStart) binEnd = binStart + 1
          let s = 0
          for (let j = binStart; j < binEnd; j++) s += audioData[j] || 0
          const avg = s / (binEnd - binStart)
          const tilt = 0.6 + 0.4 * (i / BANDS)
          raw[i] = Math.min(0.9, avg * tilt * 1.3)
        }
        const sp = new Array<number>(BANDS)
        for (let i = 0; i < BANDS; i++) {
          const pv = raw[(i - 1 + BANDS) % BANDS]
          const nx = raw[(i + 1) % BANDS]
          sp[i] = (pv + raw[i] + nx) / 3
        }
        for (let i = 0; i < BANDS; i++) {
          const pv = sp[(i - 1 + BANDS) % BANDS]
          const nx = sp[(i + 1) % BANDS]
          const avgN = Math.max(0.05, (pv + nx) * 0.5)
          const clamped = Math.min(sp[i], avgN * 1.5)
          if (isPlaying) bandsSm[i] = bandsSm[i] * 0.80 + clamped * 0.20
          else bandsSm[i] *= 0.92
          bands[i] = bandsSm[i]
        }

        const gate = isPlaying ? 1 : 0.05
        bassSm = bassSm * 0.85 + bass * 0.15 * gate
        midSm = midSm * 0.75 + mid * 0.25 * gate
        trebleSm = trebleSm * 0.7 + treble * 0.3 * gate
      }

      const energyN = Math.min(1, Math.max(0, energy / 0.12))

      if (beat && isPlaying) {
        kick = 1
        zoomKick = 1
        trauma = Math.min(1, trauma + 1.0)
      }
      kick *= 0.9
      zoomKick *= 0.82
      trauma *= 0.88

      pauseGate = isPlaying ? pauseGate * 0.85 + 0.15 : pauseGate * 0.95
      sceneTime += 0.016 * pauseGate

      const dolly = 1 - bassSm * 0.06 * pauseGate - Math.sin(t * 0.06) * 0.015 * pauseGate
      zoomSm = zoomSm * 0.88 + dolly * 0.12

      const driftX = (Math.sin(t * 0.011) * 20 + Math.cos(t * 0.027) * 10) * pauseGate
      const driftY = (Math.cos(t * 0.011) * 15 + Math.sin(t * 0.027) * 8) * pauseGate

      const tSec = t * 0.016
      trebleCam += (trebleSm - trebleCam) * 0.15
      const targetTX = Math.sin(tSec * 11.3) * trebleCam * 18 * pauseGate
      const targetTY = Math.cos(tSec * 9.7) * trebleCam * 14 * pauseGate
      shake.x += (targetTX - shake.x) * 0.18
      shake.y += (targetTY - shake.y) * 0.18
      const trebleRot = Math.sin(tSec * 7.1) * trebleCam * 0.015

      const pt = performance.now() * 0.015
      const t2 = trauma * trauma
      const targetCX = (Math.sin(pt * 2.1) + Math.sin(pt * 3.7)) * 0.5 * t2 * 40
      const targetCY = (Math.sin(pt * 1.9) + Math.sin(pt * 3.3)) * 0.5 * t2 * 32
      const targetCR = Math.sin(pt * 2.5) * t2 * 0.04
      traumaVel.x = (traumaVel.x + (targetCX - traumaPos.x) * 0.25) * 0.6
      traumaVel.y = (traumaVel.y + (targetCY - traumaPos.y) * 0.25) * 0.6
      traumaVel.r = (traumaVel.r + (targetCR - traumaPos.r) * 0.25) * 0.6
      traumaPos.x += traumaVel.x
      traumaPos.y += traumaVel.y
      traumaPos.r += traumaVel.r

      let finalX = (driftX + (shake.x + traumaPos.x) * pp.shakeIntensity) * pauseGate
      let finalY = (driftY + (shake.y + traumaPos.y) * pp.shakeIntensity) * pauseGate
      let finalRot = (trebleRot + traumaPos.r * pp.shakeIntensity) * pauseGate
      finalX = Math.max(-45, Math.min(45, finalX))
      finalY = Math.max(-45, Math.min(45, finalY))
      finalRot = Math.max(-0.06, Math.min(0.06, finalRot))

      palette = palette * 0.78 + Math.min(1, bassSm + kick) * 0.22
      glowSm = glowSm * 0.8 + (0.8 + bassSm * 1.4 + kick * 1.2) * 0.2
      titleScaleSm = titleScaleSm * 0.85 + (1 + bassSm * 0.45 + kick * 0.15) * 0.15
      titleOpacity = Math.min(1, titleOpacity + 0.02)

      const motion = trauma < 0.05 && zoomKick < 0.05
          ? 0
          : Math.min(0.08, (trauma + zoomKick) * 0.02)
      caSm = caSm * 0.7 + Math.min(1.0, trebleSm * 1.2 + kick * 0.6) * 0.3
      bloomSm = bloomSm * 0.8 + (0.8 + energyN * 0.6) * 0.2

      const exposureTarget = isPlaying
        ? 0.35 + energyN * 0.55 + trebleSm * 0.05 + Math.min(bassSm, 0.7) * 0.65 + kick * 0.45
        : 0.25
      exposureSm += (exposureTarget - exposureSm) * 0.05

      const su = sceneMat.uniforms
      su.uTime.value = sceneTime
      su.uShake.value.set(finalX / W, finalY / H)
      su.uZoom.value = zoomSm - zoomKick * 0.08 * pauseGate
      su.uShakeRot.value = finalRot
      su.uBass.value = bassSm
      su.uMid.value = midSm
      su.uTreble.value = trebleSm
      su.uBeatKick.value = kick
      su.uPalette.value = Math.min(1, palette)
      su.uGlow.value = glowSm * pp.glow
      su.uTitleScale.value = titleScaleSm
      su.uTitleOpacity.value = titleOpacity
      trailPhase += (0.015 + bassSm * 0.05) * pauseGate
      su.uTrailPhase.value = trailPhase
      su.uTrailEnergy.value = Math.min(1, midSm + bassSm * 0.5) * pauseGate

      const fu = finalMat.uniforms
      fu.uTime.value = sceneTime
      fu.uRadial.value = motion
      fu.uSamples.value = motionSamples
      fu.uCA.value = caSm * 0.003
      fu.uBloomStr.value = bloomSm * pp.bloomStrength
      fu.uExposure.value = exposureSm * pp.exposure

      quad.material = sceneMat
      renderer.setRenderTarget(sceneRT)
      renderer.render(qScene, cam)

      quad.material = blurMat
      blurMat.uniforms.uTex.value = sceneRT.texture
      blurMat.uniforms.uDir.value.set(1 / bW(), 0)
      blurMat.uniforms.uThreshold.value = 0.75
      renderer.setRenderTarget(bloomA)
      renderer.render(qScene, cam)

      blurMat.uniforms.uTex.value = bloomA.texture
      blurMat.uniforms.uDir.value.set(0, 1 / bH())
      blurMat.uniforms.uThreshold.value = 0
      renderer.setRenderTarget(bloomB)
      renderer.render(qScene, cam)

      quad.material = finalMat
      finalMat.uniforms.uScene.value = sceneRT.texture
      finalMat.uniforms.uBloom.value = bloomB.texture
      renderer.setRenderTarget(null)
      renderer.render(qScene, cam)

      rafRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      sceneMat.dispose()
      blurMat.dispose()
      finalMat.dispose()
      quadGeom.dispose()
      sceneRT.dispose()
      bloomA.dispose()
      bloomB.dispose()
      titleTex.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}