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
  fileSize: number
  thumbnails: string[]
  waveformData: number[]
}

export type AudioMode = 'mix' | 'first' | 'mute'
export type VideoCodec = 'libx264' | 'libx265' | 'libvpx-vp9'
export type AudioCodec = 'aac' | 'libopus' | 'libmp3lame'
export type Resolution = '640x360' | '854x480' | '1280x720' | '1920x1080' | '2560x1440' | '3840x2160'
export type FrameRate = '24' | '25' | '30' | '50' | '60'

export interface AdvancedOutputConfig {
  resolution: Resolution
  frameRate: FrameRate
  videoBitrate: string
  audioBitrate: string
  videoCodec: VideoCodec
  audioCodec: AudioCodec
  useAdvanced: boolean
}

export interface OutputConfig {
  format: 'mp4' | 'webm'
  quality: 'low' | 'medium' | 'high'
  keepAudio: boolean
  audioMode: AudioMode
  advanced: AdvancedOutputConfig
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

export const RESOLUTION_OPTIONS: { value: Resolution; label: string }[] = [
  { value: '640x360', label: '360p (640×360)' },
  { value: '854x480', label: '480p (854×480)' },
  { value: '1280x720', label: '720p (1280×720)' },
  { value: '1920x1080', label: '1080p (1920×1080)' },
  { value: '2560x1440', label: '2K (2560×1440)' },
  { value: '3840x2160', label: '4K (3840×2160)' }
]

export const FRAMERATE_OPTIONS: { value: FrameRate; label: string }[] = [
  { value: '24', label: '24 fps (电影级)' },
  { value: '25', label: '25 fps (PAL)' },
  { value: '30', label: '30 fps (流畅)' },
  { value: '50', label: '50 fps (流畅)' },
  { value: '60', label: '60 fps (丝滑)' }
]

export const VIDEO_CODEC_OPTIONS: { value: VideoCodec; label: string; format: ('mp4' | 'webm')[] }[] = [
  { value: 'libx264', label: 'H.264 (AVC)', format: ['mp4'] },
  { value: 'libx265', label: 'H.265 (HEVC)', format: ['mp4'] },
  { value: 'libvpx-vp9', label: 'VP9', format: ['webm'] }
]

export const AUDIO_CODEC_OPTIONS: { value: AudioCodec; label: string; format: ('mp4' | 'webm')[] }[] = [
  { value: 'aac', label: 'AAC', format: ['mp4'] },
  { value: 'libmp3lame', label: 'MP3', format: ['mp4'] },
  { value: 'libopus', label: 'Opus', format: ['webm'] }
]

export const AUDIO_MODE_OPTIONS: { value: AudioMode; label: string; desc: string }[] = [
  { value: 'mix', label: '混合所有音频', desc: '将所有视频段的音频混合在一起' },
  { value: 'first', label: '仅保留第一段', desc: '只使用第一段视频的音频' },
  { value: 'mute', label: '静音', desc: '输出视频不包含音频' }
]

export const BITRATE_PRESETS: { value: string; label: string }[] = [
  { value: '500K', label: '500 Kbps (低)' },
  { value: '1M', label: '1 Mbps (较低)' },
  { value: '2M', label: '2 Mbps (中等)' },
  { value: '2.5M', label: '2.5 Mbps (标准)' },
  { value: '4M', label: '4 Mbps (较高)' },
  { value: '5M', label: '5 Mbps (高)' },
  { value: '8M', label: '8 Mbps (很高)' },
  { value: '10M', label: '10 Mbps (极高)' }
]

export interface ProgressState {
  currentVideoIndex: number
  totalVideos: number
  currentVideoName: string
  currentVideoProgress: number
  estimatedTimeRemaining: number
  startTime: number
  bytesProcessed: number
  totalBytes: number
}

export interface ErrorInfo {
  type: 'memory' | 'codec' | 'trim' | 'file' | 'ffmpeg' | 'unknown'
  message: string
  details?: string
  timestamp: number
}

export interface SizeEstimate {
  videoBytes: number
  audioBytes: number
  totalBytes: number
  formattedTotal: string
  confidence: 'low' | 'medium' | 'high'
}

export interface ThumbnailData {
  time: number
  dataUrl: string
}
