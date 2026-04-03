import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Noise,
  Vignette,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { LayerMaterial, Fresnel, Displace } from 'lamina'
import { useRef } from 'react'
import * as THREE from 'three'
import { useAudioStore } from '../store/audioStore'

const CAMERA_CONFIG = { position: [0, 0, 5] as [number, number, number], fov: 45 }
const BG_COLOR = '#000000'
const BG_COLOR_ARGS: [string] = [BG_COLOR]

const BLOB_BASE_COLOR = '#000000'
const FRESNEL_COLOR = '#ffe5d0'
const FRESNEL_POWER = 2.5
const FRESNEL_INTENSITY = 2.2
const FRESNEL_ALPHA = 1

const BLOB_GEOM_ARGS: [number, number] = [1, 16]

const DISPLACE_STRENGTH = 0.25
const DISPLACE_SCALE = 1.2
const DISPLACE_OFFSET_INIT: [number, number, number] = [0, 0, 0]

const FLOATING_RANGE: [number, number] = [-0.4, 0.4]

const CHROMATIC_OFFSET: [number, number] = [0.002, 0.002]

function Blob() {
  const displaceRef = useRef<any>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const tRef = useRef(0)
  const smoothedBassRef = useRef(0)
  const beatPulseRef = useRef(0)

  useFrame((_, delta) => {
    const state = useAudioStore.getState()
    const audioData = state.audioData
    const beat = state.beat

    let bassRaw = 0
    if (audioData && audioData.length > 0) {
      for (let i = 0; i < 20; i++) bassRaw += audioData[i] ?? 0
      bassRaw /= 20
    }
}}
)
