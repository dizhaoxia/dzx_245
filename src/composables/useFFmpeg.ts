import { ref } from 'vue'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL, fetchFile } from '@ffmpeg/util'
import type { QualityPreset } from '@/types'

const ffmpeg = new FFmpeg()
const isLoaded = ref(false)
const isLoadingFFmpeg = ref(false)
const loadProgress = ref(0)

export function useFFmpeg() {
  const load = async () => {
    if (isLoaded.value) return
    if (isLoadingFFmpeg.value) return
    isLoadingFFmpeg.value = true

    try {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      })
      isLoaded.value = true
    } catch (e) {
      console.error('FFmpeg load failed:', e)
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
    const codec = format === 'webm' ? 'libvpx-vp9' : 'libx264'
    const audioCodec = format === 'webm' ? 'libopus' : 'aac'

    const args = [
      '-i', inputPath,
      '-ss', String(start),
      '-t', String(duration),
      '-c:v', codec,
      '-b:v', preset.bitrate,
      '-s', preset.resolution,
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
    ]

    if (keepAudio) {
      args.push('-c:a', audioCodec, '-b:a', '128k')
    } else {
      args.push('-an')
    }

    if (format === 'mp4') {
      args.push('-movflags', '+faststart')
    }

    args.push(outputPath)
    await ffmpeg.exec(args)
  }

  const concatVideos = async (inputPaths: string[], outputPath: string, format: string) => {
    const concatContent = inputPaths.map(p => `file '${p}'`).join('\n')
    await ffmpeg.writeFile('concat_list.txt', concatContent)

    const args = ['-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', '-c', 'copy']

    if (format === 'mp4') {
      args.push('-movflags', '+faststart')
    }

    args.push(outputPath)
    await ffmpeg.exec(args)
  }

  const transcode = async (inputPath: string, outputPath: string, bitrate: string, resolution: string, keepAudio: boolean, format: string) => {
    const codec = format === 'webm' ? 'libvpx-vp9' : 'libx264'
    const audioCodec = format === 'webm' ? 'libopus' : 'aac'

    const args = [
      '-i', inputPath,
      '-c:v', codec,
      '-b:v', bitrate,
      '-s', resolution,
      '-r', '30',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
    ]

    if (keepAudio) {
      args.push('-c:a', audioCodec, '-b:a', '128k')
    } else {
      args.push('-an')
    }

    if (format === 'mp4') {
      args.push('-movflags', '+faststart')
    }

    args.push(outputPath)
    await ffmpeg.exec(args)
  }

  const writeFile = async (path: string, data: File | Uint8Array) => {
    if (data instanceof File) {
      await ffmpeg.writeFile(path, await fetchFile(data))
    } else {
      await ffmpeg.writeFile(path, data)
    }
  }

  const readFile = async (path: string): Promise<Uint8Array> => {
    return await ffmpeg.readFile(path) as Uint8Array
  }

  const deleteFile = async (path: string) => {
    try {
      await ffmpeg.deleteFile(path)
    } catch {}
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
    deleteFile
  }
}
