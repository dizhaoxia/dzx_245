import { ref, computed, watch } from 'vue'
import type { VideoItem, OutputConfig, SizeEstimate, ProgressState, ErrorInfo } from '@/types'
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

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const parseBitrate = (bitrate: string): number => {
  const match = bitrate.match(/^(\d+(?:\.\d+)?)([KMG])?$/i)
  if (!match) return 1000000

  const value = parseFloat(match[1])
  const unit = match[2]?.toUpperCase()

  if (unit === 'K') return value * 1000
  if (unit === 'M') return value * 1000000
  if (unit === 'G') return value * 1000000000
  return value
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '计算中...'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins > 0) {
    return `${mins}分${secs}秒`
  }
  return `${secs}秒`
}

export function useVideoMerger() {
  const videos = ref<VideoItem[]>([])
  const outputConfig = ref<OutputConfig>({
    format: 'mp4',
    quality: 'medium',
    keepAudio: true,
    audioMode: 'mix',
    advanced: {
      resolution: '1280x720',
      frameRate: '30',
      videoBitrate: '2.5M',
      audioBitrate: '128k',
      videoCodec: 'libx264',
      audioCodec: 'aac',
      useAdvanced: false
    }
  })
  const isMerging = ref(false)
  const mergeProgress = ref(0)
  const mergeStatus = ref('')
  const outputUrl = ref<string | null>(null)
  const outputFileName = ref('merged_output.mp4')
  const ffmpegLogs = ref<string[]>([])
  const currentError = ref<ErrorInfo | null>(null)
  const progressState = ref<ProgressState | null>(null)

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
    setProgressCallback,
    checkMemoryUsage
  } = useFFmpeg()

  const hasVideos = computed(() => videos.value.length > 0)
  const canMerge = computed(() => videos.value.length >= 2 && !isMerging.value)

  const totalDuration = computed(() => {
    return videos.value.reduce((sum, v) => sum + (v.trimEnd - v.trimStart), 0)
  })

  const totalSize = computed(() => {
    return videos.value.reduce((sum, v) => sum + v.fileSize, 0)
  })

  const estimatedSize = computed<SizeEstimate | null>(() => {
    if (videos.value.length === 0) return null

    const config = outputConfig.value
    const useAdvanced = config.advanced.useAdvanced

    const videoBitrate = useAdvanced
      ? parseBitrate(config.advanced.videoBitrate)
      : parseBitrate(QUALITY_PRESETS[config.quality].bitrate)

    const audioBitrate = useAdvanced
      ? parseBitrate(config.advanced.audioBitrate)
      : 128000

    const duration = totalDuration.value
    const hasAudio = config.keepAudio && config.audioMode !== 'mute'

    const videoBytes = (videoBitrate * duration) / 8
    const audioBytes = hasAudio ? (audioBitrate * duration) / 8 : 0

    const containerOverhead = 0.1
    const totalBytes = Math.round((videoBytes + audioBytes) * (1 + containerOverhead))

    let confidence: 'low' | 'medium' | 'high' = 'medium'
    if (videos.value.length < 2) confidence = 'low'
    if (duration > 0 && useAdvanced) confidence = 'high'

    return {
      videoBytes: Math.round(videoBytes),
      audioBytes: Math.round(audioBytes),
      totalBytes,
      formattedTotal: formatFileSize(totalBytes),
      confidence
    }
  })

  const estimatedTimeRemaining = computed(() => {
    if (!progressState.value || !isMerging.value) return null
    return formatTime(progressState.value.estimatedTimeRemaining)
  })

  const currentProcessingVideo = computed(() => {
    if (!progressState.value) return null
    return progressState.value.currentVideoName
  })

  const showError = (type: ErrorInfo['type'], message: string, details?: string) => {
    currentError.value = {
      type,
      message,
      details,
      timestamp: Date.now()
    }
  }

  const clearError = () => {
    currentError.value = null
  }

  const validateTrimParams = (video: VideoItem): boolean => {
    if (video.trimStart < 0) {
      showError('trim', `视频 "${video.name}" 的起始时间不能为负数`)
      return false
    }
    if (video.trimEnd > video.duration) {
      showError('trim', `视频 "${video.name}" 的结束时间不能超过视频时长`)
      return false
    }
    if (video.trimEnd - video.trimStart < 0.5) {
      showError('trim', `视频 "${video.name}" 的裁剪时长不能少于 0.5 秒`)
      return false
    }
    if (video.trimStart >= video.trimEnd) {
      showError('trim', `视频 "${video.name}" 的起始时间必须小于结束时间`)
      return false
    }
    return true
  }

  const validateMemoryUsage = (): boolean => {
    const memory = checkMemoryUsage()
    if (memory.percentage > 85) {
      showError(
        'memory',
        `内存使用率过高 (${memory.percentage.toFixed(1)}%)`,
        '建议关闭其他标签页或减少视频数量后重试'
      )
      return false
    }
    return true
  }

  const generateThumbnails = async (videoUrl: string, duration: number, count: number = 10): Promise<string[]> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.src = videoUrl
      video.muted = true
      video.playsInline = true

      const thumbnails: string[] = []
      const times: number[] = []
      const step = duration / count

      for (let i = 0; i < count; i++) {
        times.push(i * step + step / 2)
      }

      let currentIndex = 0

      const captureNext = () => {
        if (currentIndex >= times.length) {
          video.src = ''
          resolve(thumbnails)
          return
        }

        video.currentTime = times[currentIndex]
      }

      video.onloadedmetadata = () => {
        video.currentTime = times[0]
      }

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = 160
          canvas.height = 90
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(video, 0, 0, 160, 90)
          thumbnails.push(canvas.toDataURL('image/jpeg', 0.5))
        } catch (e) {
          thumbnails.push('')
        }

        currentIndex++
        setTimeout(captureNext, 50)
      }

      video.onerror = () => {
        resolve(thumbnails)
      }
    })
  }

  const generateWaveformData = async (file: File, _duration: number): Promise<number[]> => {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          const channelData = audioBuffer.getChannelData(0)
          const samples = 200
          const blockSize = Math.floor(channelData.length / samples)
          const waveformData: number[] = []

          for (let i = 0; i < samples; i++) {
            let sum = 0
            const start = i * blockSize
            const end = Math.min(start + blockSize, channelData.length)
            for (let j = start; j < end; j++) {
              sum += Math.abs(channelData[j])
            }
            waveformData.push(sum / (end - start))
          }

          const max = Math.max(...waveformData, 0.01)
          const normalized = waveformData.map(v => v / max)

          audioContext.close()
          resolve(normalized)
        } catch (e) {
          audioContext.close()
          resolve([])
        }
      }

      reader.onerror = () => resolve([])
      reader.readAsArrayBuffer(file)
    })
  }

  const addVideos = async (files: File[]) => {
    for (const file of files) {
      const id = generateUUID()
      const objectUrl = URL.createObjectURL(file)

      try {
        const { duration, thumbnailUrl } = await getVideoMeta(objectUrl)

        if (duration === 0) {
          showError('file', `无法读取视频 "${file.name}" 的时长`, '请确保文件是有效的视频文件')
          URL.revokeObjectURL(objectUrl)
          continue
        }

        const thumbnails = await generateThumbnails(objectUrl, duration, 10)
        let waveformData: number[] = []
        try {
          waveformData = await generateWaveformData(file, duration)
        } catch (e) {
          console.warn('Failed to generate waveform:', e)
        }

        videos.value.push({
          id,
          file,
          name: file.name,
          duration,
          thumbnailUrl,
          objectUrl,
          trimStart: 0,
          trimEnd: duration,
          isProcessing: false,
          fileSize: file.size,
          thumbnails,
          waveformData
        })
      } catch (e) {
        showError('file', `加载视频 "${file.name}" 失败`, '请尝试其他文件格式')
        URL.revokeObjectURL(objectUrl)
      }
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
    clearError()
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

  const updateOutputConfig = (config: Partial<OutputConfig>) => {
    outputConfig.value = { ...outputConfig.value, ...config }
    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }
  }

  const merge = async () => {
    if (!canMerge.value) return

    clearError()

    for (const video of videos.value) {
      if (!validateTrimParams(video)) {
        return
      }
    }

    if (!validateMemoryUsage()) {
      return
    }

    isMerging.value = true
    mergeProgress.value = 0
    mergeStatus.value = '正在加载 FFmpeg...'
    outputFileName.value = `merged_output.${outputConfig.value.format}`
    ffmpegLogs.value = []
    progressState.value = null

    if (outputUrl.value) {
      URL.revokeObjectURL(outputUrl.value)
      outputUrl.value = null
    }

    let currentVideoIndex = 0
    let currentVideoDuration = 0
    const processWeight = 85
    const startTime = Date.now()

    progressState.value = {
      currentVideoIndex: 0,
      totalVideos: videos.value.length,
      currentVideoName: '',
      currentVideoProgress: 0,
      estimatedTimeRemaining: 0,
      startTime,
      bytesProcessed: 0,
      totalBytes: totalSize.value
    }

    setLogCallback((message) => {
      ffmpegLogs.value.push(message)
      if (ffmpegLogs.value.length > 100) {
        ffmpegLogs.value.shift()
      }
      console.log('[FFmpeg]', message)

      if (message.includes('Invalid data found')) {
        showError('ffmpeg', '视频文件格式不支持', '请尝试转换视频格式后重试')
      } else if (message.includes('Out of memory')) {
        showError('memory', '内存不足', '请减少视频数量或降低输出质量后重试')
      } else if (message.includes('Unsupported codec')) {
        showError('codec', '不支持的视频编码', '请尝试更换输出编码格式')
      }
    })

    let lastUpdateTime = 0
    setProgressCallback((progress) => {
      if (typeof progress !== 'number' || progress <= 0 || currentVideoDuration <= 0 || !progressState.value) return

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

      progressState.value.currentVideoProgress = videoProgress * 100

      const elapsed = (now - startTime) / 1000
      const overallProgress = mergeProgress.value / 100
      if (overallProgress > 0.05) {
        const estimatedTotal = elapsed / overallProgress
        progressState.value.estimatedTimeRemaining = Math.max(0, estimatedTotal - elapsed)
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
      const advanced = outputConfig.value.advanced
      const audioMode = outputConfig.value.audioMode

      for (let i = 0; i < total; i++) {
        const video = videos.value[i]
        currentVideoIndex = i
        currentVideoDuration = video.trimEnd - video.trimStart

        if (progressState.value) {
          progressState.value.currentVideoIndex = i
          progressState.value.currentVideoName = video.name
          progressState.value.bytesProcessed += video.fileSize
        }

        const ext = (video.name.split('.').pop() || 'mp4').toLowerCase()
        const inputPath = `input_${i}.${ext}`
        const segmentPath = `segment_${i}.${format}`

        mergeStatus.value = `正在处理第 ${i + 1}/${total} 段视频: ${video.name}`
        mergeProgress.value = Math.round((i / total) * processWeight)
        video.isProcessing = true

        console.log(`[Merge] Processing video ${i + 1}/${total}:`, video.name, 'trim:', video.trimStart, '-', video.trimEnd)

        try {
          await writeFile(inputPath, video.file)
          console.log(`[Merge] Written input file: ${inputPath}`)
        } catch (e) {
          showError('memory', '内存不足，无法写入视频文件', '请减少视频数量后重试')
          throw e
        }

        try {
          await trimAndNormalizeVideo(
            inputPath,
            segmentPath,
            video.trimStart,
            video.trimEnd,
            preset,
            outputConfig.value.keepAudio,
            format,
            advanced,
            audioMode,
            i,
            total
          )
          console.log(`[Merge] Completed processing: ${segmentPath}`)
        } catch (procError) {
          console.error(`[Merge] Failed to process video ${video.name}:`, procError)
          const errorMsg = procError instanceof Error ? procError.message : '未知错误'

          if (errorMsg.includes('memory') || errorMsg.includes('OOM')) {
            showError('memory', '内存不足', '请减少视频数量或降低输出质量后重试')
          } else if (errorMsg.includes('codec') || errorMsg.includes('Unsupported')) {
            showError('codec', `视频 "${video.name}" 编码不支持`, '请尝试更换输出编码格式')
          } else {
            showError('ffmpeg', `处理视频 "${video.name}" 失败`, errorMsg)
          }
          throw new Error(`处理视频 "${video.name}" 失败: ${errorMsg}`)
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
      await concatVideos(segmentPaths, finalPath, format, audioMode)
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

      if (progressState.value) {
        progressState.value.estimatedTimeRemaining = 0
      }
    } catch (e) {
      console.error('[Merge] Failed:', e)
      const errorMsg = e instanceof Error ? e.message : '未知错误'

      if (!currentError.value) {
        if (errorMsg.includes('memory') || errorMsg.includes('OOM')) {
          showError('memory', '内存不足', '请减少视频数量或降低输出质量后重试')
        } else {
          showError('unknown', `合并失败: ${errorMsg}`)
        }
      }

      mergeStatus.value = `合并失败: ${currentError.value?.message || errorMsg}`
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
    clearError()
  }

  watch(() => outputConfig.value.format, (newFormat) => {
    if (newFormat === 'webm') {
      if (outputConfig.value.advanced.videoCodec === 'libx264' || outputConfig.value.advanced.videoCodec === 'libx265') {
        outputConfig.value.advanced.videoCodec = 'libvpx-vp9'
      }
      if (outputConfig.value.advanced.audioCodec === 'aac' || outputConfig.value.advanced.audioCodec === 'libmp3lame') {
        outputConfig.value.advanced.audioCodec = 'libopus'
      }
    } else {
      if (outputConfig.value.advanced.videoCodec === 'libvpx-vp9') {
        outputConfig.value.advanced.videoCodec = 'libx264'
      }
      if (outputConfig.value.advanced.audioCodec === 'libopus') {
        outputConfig.value.advanced.audioCodec = 'aac'
      }
    }
  })

  return {
    videos,
    outputConfig,
    isMerging,
    mergeProgress,
    mergeStatus,
    outputUrl,
    outputFileName,
    ffmpegLogs,
    currentError,
    progressState,
    hasVideos,
    canMerge,
    isLoadingFFmpeg,
    ffmpegLoaded,
    totalDuration,
    totalSize,
    estimatedSize,
    estimatedTimeRemaining,
    currentProcessingVideo,
    addVideos,
    removeVideo,
    updateTrim,
    moveVideo,
    reorderVideos,
    updateOutputConfig,
    merge,
    download,
    cleanup,
    clearError,
    formatFileSize,
    formatTime
  }
}
