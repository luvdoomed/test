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
