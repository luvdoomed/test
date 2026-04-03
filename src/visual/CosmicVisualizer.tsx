import { Canvas, extend, useFrame, useThree } from '@react-three/fiber'
import { shaderMaterial } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useRef } from 'react'
import * as THREE from 'three'
import { useAudioStore } from '../store/audioStore'

const CAMERA = { position: [0, 0, 5] as [number, number, number], fov: 45 }
const BG_COLOR = '#000000'
const CHROMATIC_OFFSET: [number, number] = [0.0015, 0.0015]
const PLANE_SIZE = 2

const PALETTE_COUNT = 6

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  varying vec2 vUv;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float iAudioBass;
  uniform float iAudioBeatPulse;
  uniform float iAudioTreble;
  uniform float iAudioRMS;
  uniform float iRotationStep;
  uniform float iPaletteIndex;

  vec3 getPalette(float idx) {
    if (idx < 0.5) return vec3(6.0, 1.0, 2.0);
    if (idx < 1.5) return vec3(1.0, 0.5, 0.0);
    if (idx < 2.5) return vec3(3.0, 2.0, 1.0);
    if (idx < 3.5) return vec3(0.5, 1.5, 3.0);
    if (idx < 4.5) return vec3(2.0, 4.0, 5.0);
    return vec3(4.0, 0.5, 2.5);
}
