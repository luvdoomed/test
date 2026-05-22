export type TemplateKind = 'canvas2d' | 'r3f' | 'webgl'

export const TEMPLATE_CANVAS2D = `import { useEffect, useRef } from 'react'

interface LrcLine {
  time: number
  text: string
}

interface VizProps {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
  lrcLines: LrcLine[]
  activeLineIndex: number
  activeLineText: string
  isPlaying: boolean
}

export default function MyCanvasViz({
  audioData,
  beat,
  energy,
  currentTime,
  lrcLines,
  activeLineIndex,
  activeLineText,
  isPlaying,
}: VizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const audioRef = useRef({
    audioData,
    beat,
    energy,
    currentTime,
    lrcLines,
    activeLineIndex,
    activeLineText,
    isPlaying,
  })
  useEffect(() => {
    audioRef.current = {
      audioData,
      beat,
      energy,
      currentTime,
      lrcLines,
      activeLineIndex,
      activeLineText,
      isPlaying,
    }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let beatPulse = 0

    const draw = () => {
      const { beat, energy } = audioRef.current
      const w = canvas.width
      const h = canvas.height

      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'
      ctx.fillRect(0, 0, w, h)

      if (beat) beatPulse = 1
      beatPulse *= 0.92

      const cx = w / 2
      const cy = h / 2
      const baseR = Math.min(w, h) * 0.15
      const r = baseR + energy * 2400 + beatPulse * 80

      const hue = (Date.now() * 0.05) % 360
      ctx.fillStyle = \`hsl(\${hue}, 80%, \${55 + energy * 200}%)\`
      ctx.shadowColor = \`hsla(\${hue}, 80%, 70%, 0.7)\`
      ctx.shadowBlur = 40
      ctx.beginPath()
      ctx.arc(cx, cy, Math.max(10, r), 0, Math.PI * 2)
      ctx.fill()

      const { activeLineText: line } = audioRef.current
      if (line) {
        ctx.shadowBlur = 0
        ctx.fillStyle = 'rgba(255,255,255,0.92)'
        ctx.font = '600 42px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillText(line, cx, h - 48, w - 96)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    />
  )
}
`

export const TEMPLATE_R3F = `import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface LrcLine {
  time: number
  text: string
}

interface VizProps {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
  lrcLines: LrcLine[]
  activeLineIndex: number
  activeLineText: string
  isPlaying: boolean
}

interface AudioSnapshot {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
  lrcLines: LrcLine[]
  activeLineIndex: number
  activeLineText: string
  isPlaying: boolean
}

function Cube({ audioRef }: { audioRef: { current: AudioSnapshot } }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const traumaRef = useRef(0)

  useFrame((_, dt) => {
    if (!meshRef.current) return
    const { beat, energy } = audioRef.current
    if (beat) traumaRef.current = 1
    traumaRef.current *= 0.9
    const s = 1 + energy * 6 + traumaRef.current * 0.4
    meshRef.current.scale.set(s, s, s)
    meshRef.current.rotation.x += dt * 0.6
    meshRef.current.rotation.y += dt * 0.9
    if (matRef.current) {
      const hue = (Date.now() * 0.0002 + energy * 4) % 1
      matRef.current.color.setHSL(hue, 0.7, 0.55)
      matRef.current.emissiveIntensity = 0.3 + traumaRef.current * 1.2
    }
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial ref={matRef} color="#7cf" emissive="#04a" emissiveIntensity={0.4} />
    </mesh>
  )
}

export default function MyR3FViz({
  audioData,
  beat,
  energy,
  currentTime,
  lrcLines,
  activeLineIndex,
  activeLineText,
  isPlaying,
}: VizProps) {
  const audioRef = useRef<AudioSnapshot>({
    audioData,
    beat,
    energy,
    currentTime,
    lrcLines,
    activeLineIndex,
    activeLineText,
    isPlaying,
  })
  useEffect(() => {
    audioRef.current = {
      audioData,
      beat,
      energy,
      currentTime,
      lrcLines,
      activeLineIndex,
      activeLineText,
      isPlaying,
    }
  })

  return (
    <Canvas
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
      camera={{ position: [0, 0, 4], fov: 45 }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 3, 4]} intensity={1} />
      <Cube audioRef={audioRef} />
    </Canvas>
  )
}
`

export const TEMPLATE_WEBGL = `import { useEffect, useRef } from 'react'

interface LrcLine {
  time: number
  text: string
}

interface VizProps {
  audioData: Float32Array
  beat: boolean
  energy: number
  currentTime: number
  lrcLines: LrcLine[]
  activeLineIndex: number
  activeLineText: string
  isPlaying: boolean
}

const VERT = \`
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
\`

const FRAG = \`
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_energy;
uniform float u_beat;

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float r = length(uv);
  float a = atan(uv.y, uv.x);
  float wave = sin(8.0 * r - u_time * 2.0 + a * 3.0);
  float ring = smoothstep(0.55, 0.0, abs(wave - 0.4));
  vec3 col = mix(vec3(0.04, 0.08, 0.2), vec3(0.4, 0.8, 1.0), ring);
  col += u_energy * 8.0 * vec3(0.6, 0.4, 1.0) * exp(-r * 1.6);
  col += u_beat * 0.3 * exp(-r * 1.2);
  gl_FragColor = vec4(col, 1.0);
}
\`

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  return s
}

export default function MyShaderViz({
  audioData,
  beat,
  energy,
  currentTime,
  lrcLines,
  activeLineIndex,
  activeLineText,
  isPlaying,
}: VizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const audioRef = useRef({
    audioData,
    beat,
    energy,
    currentTime,
    lrcLines,
    activeLineIndex,
    activeLineText,
    isPlaying,
  })
  useEffect(() => {
    audioRef.current = {
      audioData,
      beat,
      energy,
      currentTime,
      lrcLines,
      activeLineIndex,
      activeLineText,
      isPlaying,
    }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl')
    if (!gl) return

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    const prog = gl.createProgram()!
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(prog, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(prog, 'u_res')
    const uTime = gl.getUniformLocation(prog, 'u_time')
    const uEnergy = gl.getUniformLocation(prog, 'u_energy')
    const uBeat = gl.getUniformLocation(prog, 'u_beat')

    let raf = 0
    const startedAt = performance.now()
    const draw = () => {
      const { energy, beat, currentTime } = audioRef.current
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const tw = Math.floor(w * dpr)
      const th = Math.floor(h * dpr)
      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw
        canvas.height = th
      }
      const t = currentTime > 0 ? currentTime : (performance.now() - startedAt) / 1000
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, t)
      gl.uniform1f(uEnergy, energy)
      gl.uniform1f(uBeat, beat ? 1.0 : 0.0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      gl.deleteProgram(prog)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', background: '#000' }} />
}
`

const TEMPLATES: Record<TemplateKind, { name: string; src: string }> = {
  canvas2d: { name: 'loomi-canvas2d-template.tsx', src: TEMPLATE_CANVAS2D },
  r3f: { name: 'loomi-r3f-template.tsx', src: TEMPLATE_R3F },
  webgl: { name: 'loomi-webgl-template.tsx', src: TEMPLATE_WEBGL },
}

async function saveViaTauri(name: string, src: string): Promise<boolean> {
  try {
    const { isTauri } = await import('../utils/platform')
    if (!isTauri()) return false
    const [{ save }, { writeTextFile, BaseDirectory }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ])
    const target = await save({
      defaultPath: name,
      filters: [{ name: 'TSX', extensions: ['tsx'] }],
    })
    if (!target) return true
    try {
      await writeTextFile(target, src)
    } catch (err) {
      console.warn('[userViz] writeTextFile (absolute) упал, пробую через AppData:', err)
      const fallbackRel = `Loomi/${name}`
      await writeTextFile(fallbackRel, src, { baseDir: BaseDirectory.AppData })
      alert(`Не удалось сохранить в выбранную папку. Файл записан в AppData/${fallbackRel}.`)
    }
    return true
  } catch (err) {
    console.warn('[userViz] Tauri save упал, фолбэк на blob:', err)
    return false
  }
}

function saveViaBlob(name: string, src: string): void {
  const blob = new Blob([src], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadTemplate(kind: TemplateKind): Promise<void> {
  const t = TEMPLATES[kind]
  const saved = await saveViaTauri(t.name, t.src)
  if (!saved) saveViaBlob(t.name, t.src)
}

export function getTemplateName(kind: TemplateKind): string {
  return TEMPLATES[kind].name
}
