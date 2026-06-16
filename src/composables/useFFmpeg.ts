import { ref } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'
import type { QualityPreset, AudioMode, AdvancedOutputConfig } from '@/types'

export type LogCallback = (message: string) => void
export type ProgressCallback = (progress: number) => void

export interface EncodingOptions {
  resolution: string
  frameRate: string
  videoBitrate: string
  audioBitrate: string
  videoCodec: string
  audioCodec: string
  audioMode: AudioMode
  format: string
  segmentIndex?: number
  totalSegments?: number
}

const ffmpeg = new FFmpeg()
const isLoaded = ref(false)
const isLoadingFFmpeg = ref(false)
const loadProgress = ref(0)
let logCallback: LogCallback | null = null
let progressCallback: ProgressCallback | null = null

const parseProgress = (message: string): number | null => {
  let timeMatch = message.match(/time=(\d+):(\d+):(\d+\.\d+)/)
  if (timeMatch) {
    const hours = parseInt(timeMatch[1])
    const minutes = parseInt(timeMatch[2])
    const seconds = parseFloat(timeMatch[3])
    return hours * 3600 + minutes * 60 + seconds
  }

  timeMatch = message.match(/time=(\d+):(\d+\.\d+)/)
  if (timeMatch) {
    const minutes = parseInt(timeMatch[1])
    const seconds = parseFloat(timeMatch[2])
    return minutes * 60 + seconds
  }

  timeMatch = message.match(/time=(\d+\.\d+)/)
  if (timeMatch) {
    return parseFloat(timeMatch[1])
  }

  return null
}

let lastProgressFromEvent = -1
let lastProgressFromLog = -1

ffmpeg.on('log', ({ message }) => {
  if (logCallback) {
    logCallback(message)
  }
  const currentTime = parseProgress(message)
  if (currentTime !== null && currentTime !== lastProgressFromLog) {
    lastProgressFromLog = currentTime
    if (progressCallback && lastProgressFromEvent < 0) {
      progressCallback(currentTime)
    }
  }
})

ffmpeg.on('progress', ({ progress }) => {
  if (progressCallback && progress > 0) {
    lastProgressFromEvent = progress
    progressCallback(progress)
  }
})

const getCodecOptions = (codec: string, isVideo: boolean, _format: string) => {
  const args: string[] = []

  if (isVideo) {
    if (codec === 'libx264') {
      args.push('-preset', 'veryfast')
      args.push('-crf', '23')
      args.push('-pix_fmt', 'yuv420p')
    } else if (codec === 'libx265') {
      args.push('-preset', 'fast')
      args.push('-crf', '28')
      args.push('-pix_fmt', 'yuv420p')
      args.push('-tag:v', 'hvc1')
    } else if (codec === 'libvpx-vp9') {
      args.push('-deadline', 'realtime')
      args.push('-cpu-used', '4')
      args.push('-crf', '30')
    }
  } else {
    if (codec === 'aac') {
      args.push('-profile:a', 'aac_low')
    } else if (codec === 'libmp3lame') {
      args.push('-q:a', '2')
    } else if (codec === 'libopus') {
      args.push('-vbr', 'on')
      args.push('-compression_level', '10')
    }
  }

  return args
}

export function useFFmpeg() {
  const setLogCallback = (cb: LogCallback | null) => {
    logCallback = cb
  }

  const setProgressCallback = (cb: ProgressCallback | null) => {
    progressCallback = cb
    lastProgressFromEvent = -1
    lastProgressFromLog = -1
  }

  const load = async () => {
    if (isLoaded.value) return
    if (isLoadingFFmpeg.value) return
    isLoadingFFmpeg.value = true

    try {
      const cdnList = [
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
        'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
      ]

      let lastError: Error | null = null

      for (const baseURL of cdnList) {
        try {
          console.log(`[FFmpeg] Loading from ${baseURL}...`)
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
          })
          isLoaded.value = true
          console.log('[FFmpeg] Loaded successfully')
          return
        } catch (e) {
          lastError = e as Error
          console.warn(`[FFmpeg] Failed to load from ${baseURL}:`, e)
        }
      }

      throw lastError || new Error('所有 CDN 都无法加载 FFmpeg')
    } catch (e) {
      console.error('[FFmpeg] Load failed:', e)
      throw e
    } finally {
      isLoadingFFmpeg.value = false
    }
  }

  const trimAndNormalizeVideo = async (
    inputPath: string,
    outputPath: string,
    start: number,
    end: number,
    preset: QualityPreset,
    keepAudio: boolean,
    format: string,
    advanced?: AdvancedOutputConfig,
    audioMode?: AudioMode,
    segmentIndex?: number,
    _totalSegments?: number
  ) => {
    const duration = end - start
    const isWebm = format === 'webm'

    const useAdvanced = advanced?.useAdvanced
    const resolution = useAdvanced ? advanced!.resolution : preset.resolution
    const frameRate = useAdvanced ? advanced!.frameRate : '30'
    const videoBitrate = useAdvanced ? advanced!.videoBitrate : preset.bitrate
    const audioBitrate = useAdvanced ? advanced!.audioBitrate : '128k'
    const videoCodec = useAdvanced ? advanced!.videoCodec : (isWebm ? 'libvpx-vp9' : 'libx264')
    const audioCodec = useAdvanced ? advanced!.audioCodec : (isWebm ? 'libopus' : 'aac')

    const resolvedAudioMode = audioMode || 'mix'
    const shouldKeepAudio = keepAudio && resolvedAudioMode !== 'mute'
    const useSilentAudio = resolvedAudioMode === 'first' && segmentIndex !== undefined && segmentIndex > 0

    const args: string[] = []

    args.push('-ss', String(start), '-t', String(duration))
    args.push('-i', inputPath)

    if (useSilentAudio) {
      args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo')
    }

    args.push(
      '-c:v', videoCodec,
      '-b:v', videoBitrate,
      '-s', resolution,
      '-r', frameRate,
      '-pix_fmt', 'yuv420p'
    )

    args.push(...getCodecOptions(videoCodec, true, format))

    if (useSilentAudio) {
      args.push('-c:a', audioCodec, '-b:a', audioBitrate, '-ar', '44100', '-ac', '2')
      args.push(...getCodecOptions(audioCodec, false, format))
      args.push('-shortest')
      args.push('-map', '0:v', '-map', '1:a')
    } else if (shouldKeepAudio) {
      args.push('-c:a', audioCodec, '-b:a', audioBitrate, '-ar', '44100', '-ac', '2')
      args.push(...getCodecOptions(audioCodec, false, format))
    } else {
      args.push('-an')
    }

    if (!isWebm) {
      args.push('-movflags', '+faststart')
    }

    args.push('-y')
    args.push(outputPath)

    console.log('[FFmpeg] Exec:', args.join(' '))
    await ffmpeg.exec(args)
  }

  const concatVideos = async (
    inputPaths: string[],
    outputPath: string,
    format: string,
    audioMode: AudioMode = 'mix'
  ) => {
    const hasAudio = audioMode !== 'mute'

    const concatContent = inputPaths.map(p => `file '${p}'`).join('\n')
    console.log('[FFmpeg] Concat list:', concatContent)
    await ffmpeg.writeFile('concat_list.txt', concatContent)

    const args = ['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt']

    args.push('-c', 'copy')

    if (!hasAudio) {
      args.push('-an')
    }

    if (format === 'mp4') {
      args.push('-movflags', '+faststart')
    }

    args.push('-y')
    args.push(outputPath)

    console.log('[FFmpeg] Concat exec:', args.join(' '))
    await ffmpeg.exec(args)

    await ffmpeg.deleteFile('concat_list.txt')
  }

  const transcode = async (
    inputPath: string,
    outputPath: string,
    bitrate: string,
    resolution: string,
    keepAudio: boolean,
    format: string,
    advanced?: AdvancedOutputConfig
  ) => {
    const isWebm = format === 'webm'
    const useAdvanced = advanced?.useAdvanced
    const videoCodec = useAdvanced ? advanced!.videoCodec : (isWebm ? 'libvpx-vp9' : 'libx264')
    const audioCodec = useAdvanced ? advanced!.audioCodec : (isWebm ? 'libopus' : 'aac')
    const frameRate = useAdvanced ? advanced!.frameRate : '30'
    const finalBitrate = useAdvanced ? advanced!.videoBitrate : bitrate
    const audioBitrate = useAdvanced ? advanced!.audioBitrate : '128k'

    const args = [
      '-i', inputPath,
      '-c:v', videoCodec,
      '-b:v', finalBitrate,
      '-s', resolution,
      '-r', frameRate,
    ]

    args.push(...getCodecOptions(videoCodec, true, format))

    if (keepAudio) {
      args.push('-c:a', audioCodec, '-b:a', audioBitrate)
      args.push(...getCodecOptions(audioCodec, false, format))
    } else {
      args.push('-an')
    }

    if (!isWebm) {
      args.push('-movflags', '+faststart')
    }

    args.push('-y')
    args.push(outputPath)

    console.log('[FFmpeg] Transcode exec:', args.join(' '))
    await ffmpeg.exec(args)
  }

  const extractAudio = async (
    inputPath: string,
    outputPath: string,
    audioCodec: string,
    bitrate: string
  ) => {
    const args = [
      '-i', inputPath,
      '-vn',
      '-c:a', audioCodec,
      '-b:a', bitrate,
      '-y',
      outputPath
    ]

    console.log('[FFmpeg] Extract audio exec:', args.join(' '))
    await ffmpeg.exec(args)
  }

  const probeVideo = async (inputPath: string): Promise<{
    width: number
    height: number
    duration: number
    videoCodec: string
    audioCodec: string | null
    hasAudio: boolean
  }> => {
    return new Promise((resolve, reject) => {
      let output = ''
      const originalCallback = logCallback

      logCallback = (msg) => {
        output += msg + '\n'
        if (originalCallback) originalCallback(msg)
      }

      const args = ['-v', 'info', '-i', inputPath, '-f', 'null', '-']

      ffmpeg.exec(args).then(() => {
        logCallback = originalCallback

        const widthMatch = output.match(/Stream.*Video:.* (\d{2,5})x(\d{2,5})/)
        const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/)
        const videoCodecMatch = output.match(/Stream.*Video: (\w+)/)
        const audioMatch = output.match(/Stream.*Audio: (\w+)/)

        resolve({
          width: widthMatch ? parseInt(widthMatch[1]) : 0,
          height: widthMatch ? parseInt(widthMatch[2]) : 0,
          duration: durationMatch
            ? parseInt(durationMatch[1]) * 3600 + parseInt(durationMatch[2]) * 60 + parseFloat(durationMatch[3])
            : 0,
          videoCodec: videoCodecMatch ? videoCodecMatch[1] : 'unknown',
          audioCodec: audioMatch ? audioMatch[1] : null,
          hasAudio: !!audioMatch
        })
      }).catch((e) => {
        logCallback = originalCallback
        reject(e)
      })
    })
  }

  const writeFile = async (path: string, data: File | Uint8Array) => {
    console.log('[FFmpeg] Writing file:', path)
    if (data instanceof File) {
      await ffmpeg.writeFile(path, await fetchFile(data))
    } else {
      await ffmpeg.writeFile(path, data)
    }
  }

  const readFile = async (path: string): Promise<Uint8Array> => {
    console.log('[FFmpeg] Reading file:', path)
    return await ffmpeg.readFile(path) as Uint8Array
  }

  const deleteFile = async (path: string) => {
    try {
      await ffmpeg.deleteFile(path)
    } catch (e) {
      console.warn('[FFmpeg] Delete failed:', path, e)
    }
  }

  const checkMemoryUsage = (): { used: number; available: number; percentage: number } => {
    const perfMemory = (performance as any).memory
    const used = perfMemory?.usedJSHeapSize || 0
    const available = perfMemory?.jsHeapSizeLimit || 0
    const percentage = available > 0 ? (used / available) * 100 : 0
    return { used, available, percentage }
  }

  return {
    ffmpeg,
    isLoaded,
    isLoadingFFmpeg,
    loadProgress,
    load,
    trimAndNormalizeVideo,
    concatVideos,
    transcode,
    extractAudio,
    probeVideo,
    writeFile,
    readFile,
    deleteFile,
    setLogCallback,
    setProgressCallback,
    checkMemoryUsage
  }
}
