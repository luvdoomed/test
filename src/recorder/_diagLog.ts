import { invoke } from '@tauri-apps/api/core'

export function diagLog(msg: string): void {
  const line = `[${Date.now()}] ${msg}`
  console.log(line)
  invoke('diag_log_append', { line }).catch((e) => {
    console.error('diagLog invoke failed', e)
  })
}
