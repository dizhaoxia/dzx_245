import { ref } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'
import type { QualityPreset } from '@/types'

export type LogCallback = (message: string) => void
export type ProgressCallback = (progress: number) => void

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
    format: string
  ) => {
    const duration = end - start
    const isWebm = format === 'webm'
    const codec = isWebm ? 'libvpx-vp9' : 'libx264'
    const audioCodec = isWebm ? 'libopus' : 'aac'

    const args = [
      '-i', inputPath,
      '-ss', String(start),
      '-t', String(duration),
      '-c:v', codec,
      '-b:v', preset.bitrate,
      '-s', preset.resolution,
      '-r', '30',
      '-pix_fmt', 'yuv420p',
    ]

    if (!isWebm) {
      args.push('-preset', 'veryfast')
      args.push('-crf', '23')
    } else {
      args.push('-deadline', 'realtime')
      args.push('-cpu-used', '4')
      args.push('-crf', '30')
    }

    if (keepAudio) {
      args.push('-c:a', audioCodec, '-b:a', '128k')
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

  const concatVideos = async (inputPaths: string[], outputPath: string, format: string) => {
    const concatContent = inputPaths.map(p => `file '${p}'`).join('\n')
    console.log('[FFmpeg] Concat list:', concatContent)
    await ffmpeg.writeFile('concat_list.txt', concatContent)

    const args = ['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy']

    if (format === 'mp4') {
      args.push('-movflags', '+faststart')
    }

    args.push('-y')
    args.push(outputPath)

    console.log('[FFmpeg] Concat exec:', args.join(' '))
    await ffmpeg.exec(args)
  }

  const transcode = async (inputPath: string, outputPath: string, bitrate: string, resolution: string, keepAudio: boolean, format: string) => {
    const isWebm = format === 'webm'
    const codec = isWebm ? 'libvpx-vp9' : 'libx264'
    const audioCodec = isWebm ? 'libopus' : 'aac'

    const args = [
      '-i', inputPath,
      '-c:v', codec,
      '-b:v', bitrate,
      '-s', resolution,
      '-r', '30',
      '-pix_fmt', 'yuv420p',
    ]

    if (!isWebm) {
      args.push('-preset', 'veryfast')
    } else {
      args.push('-deadline', 'realtime')
      args.push('-cpu-used', '4')
    }

    if (keepAudio) {
      args.push('-c:a', audioCodec, '-b:a', '128k')
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

  return {
    ffmpeg,
    isLoaded,
    isLoadingFFmpeg,
    loadProgress,
    load,
    trimAndNormalizeVideo,
    concatVideos,
    transcode,
    writeFile,
    readFile,
    deleteFile,
    setLogCallback,
    setProgressCallback
  }
}
