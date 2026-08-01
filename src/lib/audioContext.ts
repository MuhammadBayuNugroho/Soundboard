// ============================================================
// Web Audio API — Singleton AudioContext
// ============================================================

let _ctx: AudioContext | null = null

/** Dapatkan (atau buat) singleton AudioContext */
export function getAudioContext(): AudioContext {
  if (!_ctx) {
    _ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  if (_ctx.state === 'suspended') {
    _ctx.resume()
  }
  return _ctx
}

/** Buat GainNode yang terhubung ke destination */
export function createGain(volume: number): GainNode {
  const ctx = getAudioContext()
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.connect(ctx.destination)
  return gain
}

/** Fade gain node ke 0 dalam `duration` detik */
export function fadeGainTo(gainNode: GainNode, targetVolume: number, duration: number): void {
  const ctx = getAudioContext()
  gainNode.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + duration)
}
