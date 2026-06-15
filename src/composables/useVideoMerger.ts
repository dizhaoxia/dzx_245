import { ref, computed } from 'vue'
import type { VideoItem, OutputConfig } from '@/types'
import { QUALITY_PRESETS } from '@/types'
import { useFFmpeg } from './useFFmpeg'

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function useVideoMerger() {
  const videos = ref<VideoItem[]>([])
  const outputConfig = ref<OutputConfig>({
    format: 'mp4',
    quality: 'medium',
    keepAudio: true
  })
  const isMerging = ref(false)
  const mergeProgress = ref(0)
  const mergeStatus = ref('')
  const outputUrl = ref<string | null>(null)
  const outputFileName = ref('merged_output.mp4')
  const ffmpegLogs = ref<string[]>([])

  const {
    isLoaded: ffmpegLoaded,
    isLoadingFFmpeg,
    load: loadFFmpeg,
    trimAndNormalizeVideo,
    concatVideos,
    writeFile,
    readFile,
    deleteFile,
    setLogCallback,
    setProgressCallback
  } = useFFmpeg()

  const hasVideos = computed(() => videos.value.length > 0)
  const canMerge = computed(() => videos.value.length >= 2 && !isMerging.value)

  const addVideos = async (files: File[]) => {
    for (const file of files) {
      const id = generateUUID()
      const objectUrl = URL.createObjectURL(file)
      const { duration, thumbnailUrl } = await getVideoMeta(objectUrl)
      videos.value.push({
        id,
        file,
        name: file.name,
        duration,
        thumbnailUrl,
        objectUrl,
        trimStart: 0,
        trimEnd: duration,
        isProcessing: false
      })
    }
  }

  const getVideoMeta = (url: string): Promise<{ duration: number; thumbnailUrl: string }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.src = url
      video.muted = true

      video.onloadedmetadata = () => {
        video.currentTime = Math.min(1, video.duration / 2)
      }

      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 90
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(video, 0, 0, 160, 90)
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve({ duration: video.duration, thumbnailUrl })
        video.src = ''
      }

      video.onerror = () => {
        resolve({ duration: 0, thumbnailUrl: '' })
      }
    })
  }

  const removeVideo = (id: string) => {
    const idx = videos.value.findIndex(v => v.id === id)
    if (idx !== -1) {
      URL.revokeObjectURL(videos.value[idx].objectUrl)
      videos.value.splice(idx, 1)
    }
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }
  }

  const updateTrim = (id: string, trimStart: number, trimEnd: number) => {
    const video = videos.value.find(v => v.id === id)
    if (video) {
      video.trimStart = Math.max(0, Math.min(trimStart, video.duration))
      video.trimEnd = Math.max(video.trimStart, Math.min(trimEnd, video.duration))
    }
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }
  }

  const moveVideo = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= videos.value.length) return
    const temp = videos.value[index]
    videos.value[index] = videos.value[newIndex]
    videos.value[newIndex] = temp
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }
  }

  const reorderVideos = (newList: VideoItem[]) => {
    videos.value = newList
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }
  }

  const merge = async () => {
    if (!canMerge.value) return

    isMerging.value = true
    mergeProgress.value = 0
    mergeStatus.value = '正在加载 FFmpeg...'
    outputFileName.value = `merged_output.${outputConfig.value.format}`
    ffmpegLogs.value = []

    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }

    let currentVideoIndex = 0
    let currentVideoDuration = 0
    const processWeight = 85

    setLogCallback((message) => {
      ffmpegLogs.value.push(message)
      if (ffmpegLogs.value.length > 100) {
        ffmpegLogs.value.shift()
      }
      console.log('[FFmpeg]', message)
    })

    let lastUpdateTime = 0
    setProgressCallback((progress) => {
      if (typeof progress !== 'number' || progress <= 0 || currentVideoDuration <= 0) return

      const now = Date.now()
      if (now - lastUpdateTime < 100) return
      lastUpdateTime = now

      let videoProgress: number
      if (progress <= 1) {
        videoProgress = Math.min(1, progress)
      } else {
        videoProgress = Math.min(1, progress / currentVideoDuration)
      }

      const baseProgress = (currentVideoIndex / videos.value.length) * processWeight
      const videoContribution = (videoProgress / videos.value.length) * processWeight
      const newProgress = Math.round(baseProgress + videoContribution)

      if (newProgress > mergeProgress.value) {
        mergeProgress.value = newProgress
      }
    })

    try {
      if (!ffmpegLoaded.value) {
        mergeStatus.value = '正在加载 FFmpeg 核心组件...'
        await loadFFmpeg()
      }

      const total = videos.value.length
      const segmentPaths: string[] = []
      const format = outputConfig.value.format
      const preset = QUALITY_PRESETS[outputConfig.value.quality]

      for (let i = 0; i < total; i++) {
        const video = videos.value[i]
        currentVideoIndex = i
        currentVideoDuration = video.trimEnd - video.trimStart

        const ext = (video.name.split('.').pop() || 'mp4').toLowerCase()
        const inputPath = `input_${i}.${ext}`
        const segmentPath = `segment_${i}.${format}`

        mergeStatus.value = `正在处理第 ${i + 1}/${total} 段视频: ${video.name}`
        mergeProgress.value = Math.round((i / total) * processWeight)
        video.isProcessing = true

        console.log(`[Merge] Processing video ${i + 1}/${total}:`, video.name, 'trim:', video.trimStart, '-', video.trimEnd)
        await writeFile(inputPath, video.file)
        console.log(`[Merge] Written input file: ${inputPath}`)

        try {
          await trimAndNormalizeVideo(
            inputPath,
            segmentPath,
            video.trimStart,
            video.trimEnd,
            preset,
            outputConfig.value.keepAudio,
            format
          )
          console.log(`[Merge] Completed processing: ${segmentPath}`)
        } catch (procError) {
          console.error(`[Merge] Failed to process video ${video.name}:`, procError)
          throw new Error(`处理视频 "${video.name}" 失败: ${procError instanceof Error ? procError.message : '未知错误'}`)
        }

        segmentPaths.push(segmentPath)
        await deleteFile(inputPath)
        video.isProcessing = false
      }

      currentVideoIndex = total
      mergeStatus.value = '正在拼接视频...'
      mergeProgress.value = 88

      console.log('[Merge] Concatenating segments:', segmentPaths)
      const finalPath = `output.${format}`
      await concatVideos(segmentPaths, finalPath, format)
      console.log('[Merge] Concatenation complete')

      for (const p of segmentPaths) {
        await deleteFile(p)
      }
      await deleteFile('concat_list.txt')

      mergeStatus.value = '正在生成下载文件...'
      mergeProgress.value = 95

      console.log('[Merge] Reading output file...')
      const data = await readFile(finalPath)
      console.log('[Merge] File size:', data.length, 'bytes')

      const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4'
      const blob = new Blob([data], { type: mimeType })
      outputUrl.value = URL.createObjectURL(blob)

      await deleteFile(finalPath)

      mergeProgress.value = 100
      mergeStatus.value = '合并完成！'
      console.log('[Merge] Complete!')
    } catch (e) {
      console.error('[Merge] Failed:', e)
      const errorMsg = e instanceof Error ? e.message : '未知错误'
      mergeStatus.value = `合并失败: ${errorMsg}`
      mergeProgress.value = 0
      videos.value.forEach(v => v.isProcessing = false)
    } finally {
      isMerging.value = false
      setLogCallback(null)
      setProgressCallback(null)
    }
  }

  const download = () => {
    if (!outputUrl.value) return
    const a = document.createElement('a')
    a.href = outputUrl.value
    a.download = outputFileName.value
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const cleanup = () => {
    videos.value.forEach(v => URL.revokeObjectURL(v.objectUrl))
    videos.value = []
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }
  }

  return {
    videos,
    outputConfig,
    isMerging,
    mergeProgress,
    mergeStatus,
    outputUrl,
    outputFileName,
    ffmpegLogs,
    hasVideos,
    canMerge,
    isLoadingFFmpeg,
    ffmpegLoaded,
    addVideos,
    removeVideo,
    updateTrim,
    moveVideo,
    reorderVideos,
    merge,
    download,
    cleanup
  }
}
