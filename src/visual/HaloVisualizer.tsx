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

    // экспоненциальное сглаживание независимое от fps
    const bassK = 1 - Math.pow(0.0001, delta)
    smoothedBassRef.current =
      smoothedBassRef.current + (bassRaw - smoothedBassRef.current) * bassK

    if (beat) beatPulseRef.current = 1
    const decayK = Math.pow(0.01, delta)
    beatPulseRef.current *= decayK

    tRef.current += delta * 0.3
    if (displaceRef.current) {
      displaceRef.current.offset.x = tRef.current
      displaceRef.current.offset.y = tRef.current * 0.7
      displaceRef.current.offset.z = tRef.current * 0.5

      // сила деформации растёт с басом и битом
      displaceRef.current.strength =
        DISPLACE_STRENGTH + smoothedBassRef.current * 0.5 + beatPulseRef.current * 0.4
    }

    // на бит шарик слегка раздувается и возвращается
    if (meshRef.current) {
      const scaleTarget =
        1 + beatPulseRef.current * 0.15 + smoothedBassRef.current * 0.08
      const scaleK = 1 - Math.pow(0.001, delta)
      const currentScale = meshRef.current.scale.x
      meshRef.current.scale.setScalar(
        currentScale + (scaleTarget - currentScale) * scaleK
      )

      const driftT = tRef.current * 0.4
      meshRef.current.position.x = Math.sin(driftT) * 0.5
    }
  })

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={BLOB_GEOM_ARGS} />
      {/* @ts-ignore */}
      <LayerMaterial lighting="standard" color={BLOB_BASE_COLOR}>
        {/* @ts-ignore */}
        <Displace
          ref={displaceRef}
          strength={DISPLACE_STRENGTH}
          scale={DISPLACE_SCALE}
          type="perlin"
          offset={DISPLACE_OFFSET_INIT}
        />
        {/* @ts-ignore */}
        <Fresnel
          mode="add"
          color={FRESNEL_COLOR}
          alpha={FRESNEL_ALPHA}
          power={FRESNEL_POWER}
          intensity={FRESNEL_INTENSITY}
        />
      </LayerMaterial>
    </mesh>
  )
}

export function HaloVisualizer() {
  return (
    <div style={{ width: '100%', height: '100%', background: BG_COLOR }}>
      <Canvas camera={CAMERA_CONFIG}>
        <color attach="background" args={BG_COLOR_ARGS} />
        <ambientLight intensity={1} />

        <Float
          speed={1.2}
          rotationIntensity={0}
          floatIntensity={2.5}
          floatingRange={FLOATING_RANGE}
        >
          <Blob />
        </Float>
}
)
