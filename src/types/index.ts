export interface VideoItem {
  id: string
  file: File
  name: string
  duration: number
  thumbnailUrl: string
  objectUrl: string
  trimStart: number
  trimEnd: number
  isProcessing: boolean
}

export interface OutputConfig {
  format: 'mp4' | 'webm'
  quality: 'low' | 'medium' | 'high'
  keepAudio: boolean
}

export interface QualityPreset {
  bitrate: string
  resolution: string
}

export type QualityPresets = Record<OutputConfig['quality'], QualityPreset>

export const QUALITY_PRESETS: QualityPresets = {
  low: { bitrate: '1M', resolution: '640x360' },
  medium: { bitrate: '2.5M', resolution: '1280x720' },
  high: { bitrate: '5M', resolution: '1920x1080' }
}
