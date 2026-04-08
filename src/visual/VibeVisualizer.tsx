import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useAudioStore } from '../store/audioStore'
import { useVisualizerParams } from '../presets/useVisualizerParams'

interface VibeParams {
  exposure: number
  bloomStrength: number
  glow: number
  chromaShift: number
  shakeIntensity: number
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
}
