import { ref, computed } from 'vue'
import type { VideoItem, OutputConfig } from '@/types'
import { QUALITY_PRESETS } from '@/types'
import { useFFmpeg } from './useFFmpeg'

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

  const {
    isLoaded: ffmpegLoaded,
    isLoadingFFmpeg,
    load: loadFFmpeg,
    trimAndNormalizeVideo,
    concatVideos,
    writeFile,
    readFile,
    deleteFile
  } = useFFmpeg()

  const hasVideos = computed(() => videos.value.length > 0)
  const canMerge = computed(() => videos.value.length >= 2 && !isMerging.value)

  const addVideos = async (files: File[]) => {
    for (const file of files) {
      const id = crypto.randomUUID()
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

    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }

    try {
      if (!ffmpegLoaded.value) {
        await loadFFmpeg()
      }

      const total = videos.value.length
      const segmentPaths: string[] = []
      const format = outputConfig.value.format
      const preset = QUALITY_PRESETS[outputConfig.value.quality]

      for (let i = 0; i < total; i++) {
        const video = videos.value[i]
        const ext = video.name.split('.').pop() || 'mp4'
        const inputPath = `input_${i}.${ext}`
        const segmentPath = `segment_${i}.${format}`

        mergeStatus.value = `正在处理第 ${i + 1}/${total} 段视频...`
        mergeProgress.value = Math.round(((i) / total) * 85)
        video.isProcessing = true

        await writeFile(inputPath, video.file)

        await trimAndNormalizeVideo(
          inputPath,
          segmentPath,
          video.trimStart,
          video.trimEnd,
          preset,
          outputConfig.value.keepAudio,
          format
        )

        segmentPaths.push(segmentPath)
        await deleteFile(inputPath)
        video.isProcessing = false
      }

      mergeStatus.value = '正在拼接视频...'
      mergeProgress.value = 88

      const finalPath = `output.${format}`
      await concatVideos(segmentPaths, finalPath, format)

      for (const p of segmentPaths) {
        await deleteFile(p)
      }
      await deleteFile('concat_list.txt')

      mergeStatus.value = '正在生成下载文件...'
      mergeProgress.value = 95

      const data = await readFile(finalPath)
      const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4'
      const blob = new Blob([data], { type: mimeType })
      outputUrl.value = URL.createObjectURL(blob)

      await deleteFile(finalPath)

      mergeProgress.value = 100
      mergeStatus.value = '合并完成！'
    } catch (e) {
      console.error('Merge failed:', e)
      mergeStatus.value = `合并失败: ${e instanceof Error ? e.message : '未知错误'}`
      mergeProgress.value = 0
    } finally {
      isMerging.value = false
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
