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
