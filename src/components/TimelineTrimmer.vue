<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
  duration: number
  trimStart: number
  trimEnd: number
  thumbnails?: string[]
  waveformData?: number[]
  objectUrl?: string
  disabled?: boolean
  showWaveform?: boolean
}>()

const emit = defineEmits<{
  'update-trim': [start: number, end: number]
  'seek': [time: number]
  'play': []
  'pause': []
}>()

const timelineRef = ref<HTMLElement | null>(null)
const isDragging = ref<'start' | 'end' | 'playhead' | null>(null)
const currentTime = ref(0)
const isPlaying = ref(false)
const videoRef = ref<HTMLVideoElement | null>(null)
const hoverTime = ref<number | null>(null)
const showTooltip = ref(false)

const THUMBNAIL_COUNT = 10
const MIN_TRIM_DURATION = 0.5

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
}

const trimDuration = computed(() => props.trimEnd - props.trimStart)

const startPercent = computed(() => (props.trimStart / props.duration) * 100)
const endPercent = computed(() => (props.trimEnd / props.duration) * 100)
const currentPercent = computed(() => (currentTime.value / props.duration) * 100)
const hoverPercent = computed(() => hoverTime.value !== null ? (hoverTime.value / props.duration) * 100 : 0)

const handleMouseDown = (e: MouseEvent, handle: 'start' | 'end' | 'playhead') => {
  if (props.disabled) return
  e.preventDefault()
  e.stopPropagation()
  isDragging.value = handle
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !timelineRef.value) return

  const rect = timelineRef.value.getBoundingClientRect()
  let percent = (e.clientX - rect.left) / rect.width
  percent = Math.max(0, Math.min(1, percent))
  const newTime = percent * props.duration

  if (isDragging.value === 'start') {
    const maxStart = props.trimEnd - MIN_TRIM_DURATION
    const clampedStart = Math.max(0, Math.min(newTime, maxStart))
    emit('update-trim', clampedStart, props.trimEnd)
  } else if (isDragging.value === 'end') {
    const minEnd = props.trimStart + MIN_TRIM_DURATION
    const clampedEnd = Math.max(minEnd, Math.min(newTime, props.duration))
    emit('update-trim', props.trimStart, clampedEnd)
  } else if (isDragging.value === 'playhead') {
    const clampedTime = Math.max(props.trimStart, Math.min(newTime, props.trimEnd))
    currentTime.value = clampedTime
    if (videoRef.value) {
      videoRef.value.currentTime = clampedTime
    }
    emit('seek', clampedTime)
  }
}

const handleMouseUp = () => {
  isDragging.value = null
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
}

const handleTimelineClick = (e: MouseEvent) => {
  if (props.disabled || isDragging.value) return
  if (!timelineRef.value) return

  const rect = timelineRef.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const newTime = percent * props.duration
  const clampedTime = Math.max(props.trimStart, Math.min(newTime, props.trimEnd))

  currentTime.value = clampedTime
  if (videoRef.value) {
    videoRef.value.currentTime = clampedTime
  }
  emit('seek', clampedTime)
}

const handleTimelineMouseMove = (e: MouseEvent) => {
  if (!timelineRef.value || isDragging.value) return
  const rect = timelineRef.value.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  hoverTime.value = Math.max(0, Math.min(percent * props.duration, props.duration))
  showTooltip.value = true
}

const handleTimelineMouseLeave = () => {
  hoverTime.value = null
  showTooltip.value = false
}

const togglePlay = () => {
  if (!videoRef.value || props.disabled) return
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    videoRef.value.currentTime = currentTime.value || props.trimStart
    videoRef.value.play()
  }
}

const onTimeUpdate = () => {
  if (!videoRef.value) return
  currentTime.value = videoRef.value.currentTime
  if (videoRef.value.currentTime >= props.trimEnd) {
    videoRef.value.pause()
    videoRef.value.currentTime = props.trimStart
    currentTime.value = props.trimStart
  }
}

const onPlay = () => {
  isPlaying.value = true
  emit('play')
}

const onPause = () => {
  isPlaying.value = false
  emit('pause')
}

const nudgeTrim = (type: 'start' | 'end', direction: number) => {
  if (props.disabled) return
  const amount = direction * 0.1
  if (type === 'start') {
    const newStart = Math.max(0, Math.min(props.trimStart + amount, props.trimEnd - MIN_TRIM_DURATION))
    emit('update-trim', newStart, props.trimEnd)
  } else {
    const newEnd = Math.max(props.trimStart + MIN_TRIM_DURATION, Math.min(props.trimEnd + amount, props.duration))
    emit('update-trim', props.trimStart, newEnd)
  }
}

const waveformBars = computed(() => {
  if (!props.waveformData || props.waveformData.length === 0) return []
  const bars = 100
  const step = Math.floor(props.waveformData.length / bars)
  const result: number[] = []
  for (let i = 0; i < bars; i++) {
    const start = i * step
    const end = Math.min(start + step, props.waveformData.length)
    let sum = 0
    for (let j = start; j < end; j++) {
      sum += Math.abs(props.waveformData[j])
    }
    result.push(sum / (end - start))
  }
  const max = Math.max(...result, 0.01)
  return result.map(v => v / max)
})

onMounted(() => {
  if (props.objectUrl) {
    const video = document.createElement('video')
    video.src = props.objectUrl
    video.muted = true
    video.playsInline = true
    videoRef.value = video
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
  }
})

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.removeEventListener('timeupdate', onTimeUpdate)
    videoRef.value.removeEventListener('play', onPlay)
    videoRef.value.removeEventListener('pause', onPause)
    videoRef.value.pause()
    videoRef.value.src = ''
  }
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

watch(() => props.trimStart, (newVal) => {
  if (currentTime.value < newVal) {
    currentTime.value = newVal
    if (videoRef.value) {
      videoRef.value.currentTime = newVal
    }
  }
})

watch(() => props.trimEnd, (newVal) => {
  if (currentTime.value > newVal) {
    currentTime.value = newVal
    if (videoRef.value) {
      videoRef.value.currentTime = newVal
    }
  }
})

defineExpose({
  togglePlay,
  pause: () => videoRef.value?.pause(),
  getCurrentTime: () => currentTime.value,
  videoElement: videoRef.value
})
</script>

<template>
  <div class="timeline-trimmer" :class="{ disabled, dragging: isDragging }">
    <div class="timeline-header">
      <div class="timeline-controls">
        <button class="play-btn" @click="togglePlay" :disabled="disabled">
          <svg v-if="!isPlaying" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <div class="time-display">
          <span class="current-time">{{ formatTime(currentTime) }}</span>
          <span class="time-sep">/</span>
          <span class="total-time">{{ formatTime(trimDuration) }}</span>
        </div>
      </div>
      <div class="trim-info">
        <div class="trim-range">
          <span class="trim-label">裁剪范围:</span>
          <span class="trim-value">{{ formatTime(trimStart) }} → {{ formatTime(trimEnd) }}</span>
        </div>
        <div class="trim-duration-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          <span>{{ formatTime(trimDuration) }}</span>
        </div>
      </div>
    </div>

    <div
      ref="timelineRef"
      class="timeline-track-container"
      @click="handleTimelineClick"
      @mousemove="handleTimelineMouseMove"
      @mouseleave="handleTimelineMouseLeave"
    >
      <div v-if="thumbnails && thumbnails.length > 0" class="thumbnails-strip">
        <img
          v-for="(thumb, idx) in thumbnails.slice(0, THUMBNAIL_COUNT)"
          :key="idx"
          :src="thumb"
          class="thumbnail-frame"
          :style="{ left: (idx * (100 / THUMBNAIL_COUNT)) + '%', width: (100 / THUMBNAIL_COUNT) + '%' }"
        />
      </div>

      <div v-if="showWaveform && waveformBars.length > 0" class="waveform-container">
        <div
          v-for="(height, idx) in waveformBars"
          :key="idx"
          class="waveform-bar"
          :style="{
            left: (idx / waveformBars.length * 100) + '%',
            width: (100 / waveformBars.length - 0.5) + '%',
            height: (height * 100) + '%'
          }"
        />
      </div>

      <div class="timeline-ruler">
        <div
          v-for="i in 11"
          :key="i"
          class="ruler-mark"
          :style="{ left: ((i - 1) * 10) + '%' }"
        >
          <div class="ruler-line"/>
          <span class="ruler-label">{{ formatTime(((i - 1) / 10) * duration) }}</span>
        </div>
      </div>

      <div class="timeline-trim-region" :style="{ left: startPercent + '%', width: (endPercent - startPercent) + '%' }">
        <div class="trim-region-inner"/>
      </div>

      <div
        v-if="showTooltip && hoverTime !== null"
        class="hover-tooltip"
        :style="{ left: hoverPercent + '%' }"
      >
        {{ formatTime(hoverTime) }}
      </div>

      <div
        class="trim-handle start-handle"
        :style="{ left: startPercent + '%' }"
        @mousedown="handleMouseDown($event, 'start')"
        :title="`拖动设置起始点 ${formatTime(trimStart)}`"
      >
        <div class="handle-line"/>
        <div class="handle-knob">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </div>
        <div class="nudge-controls">
          <button class="nudge-btn" @click.stop="nudgeTrim('start', -1)" title="提前0.1秒">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <button class="nudge-btn" @click.stop="nudgeTrim('start', 1)" title="延后0.1秒">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        </div>
      </div>

      <div
        class="trim-handle end-handle"
        :style="{ left: endPercent + '%' }"
        @mousedown="handleMouseDown($event, 'end')"
        :title="`拖动设置结束点 ${formatTime(trimEnd)}`"
      >
        <div class="handle-line"/>
        <div class="handle-knob">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
        <div class="nudge-controls">
          <button class="nudge-btn" @click.stop="nudgeTrim('end', -1)" title="提前0.1秒">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <button class="nudge-btn" @click.stop="nudgeTrim('end', 1)" title="延后0.1秒">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          </button>
        </div>
      </div>

      <div
        class="playhead"
        :style="{ left: currentPercent + '%' }"
        @mousedown="handleMouseDown($event, 'playhead')"
      >
        <div class="playhead-line"/>
        <div class="playhead-triangle"/>
      </div>
    </div>

    <div class="timeline-footer">
      <div class="fine-trim-controls">
        <div class="trim-control-group">
          <label>起始点</label>
          <div class="trim-input-wrapper">
            <button class="input-btn" @click="nudgeTrim('start', -1)" :disabled="disabled">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <input
              type="number"
              :value="trimStart.toFixed(1)"
              :min="0"
              :max="trimEnd - 0.1"
              :step="0.1"
              :disabled="disabled"
              class="trim-number-input"
              @input="(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value)
                if (!isNaN(val)) emit('update-trim', Math.max(0, Math.min(val, trimEnd - 0.1)), trimEnd)
              }"
            />
            <button class="input-btn" @click="nudgeTrim('start', 1)" :disabled="disabled">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="trim-control-group">
          <label>结束点</label>
          <div class="trim-input-wrapper">
            <button class="input-btn" @click="nudgeTrim('end', -1)" :disabled="disabled">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <input
              type="number"
              :value="trimEnd.toFixed(1)"
              :min="trimStart + 0.1"
              :max="duration"
              :step="0.1"
              :disabled="disabled"
              class="trim-number-input"
              @input="(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value)
                if (!isNaN(val)) emit('update-trim', trimStart, Math.max(trimStart + 0.1, Math.min(val, duration)))
              }"
            />
            <button class="input-btn" @click="nudgeTrim('end', 1)" :disabled="disabled">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="quick-trim-actions">
          <button class="quick-btn" @click="emit('update-trim', 0, duration)" :disabled="disabled">
            重置裁剪
          </button>
          <button class="quick-btn" @click="emit('update-trim', Math.max(0, trimStart + 1), Math.min(duration, trimEnd - 1))" :disabled="disabled">
            各裁1秒
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-trimmer {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  user-select: none;
  transition: border-color var(--transition-fast);
}

.timeline-trimmer.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.timeline-trimmer.dragging {
  border-color: var(--accent);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.timeline-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.play-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.play-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: scale(1.05);
}

.play-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.time-display {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.current-time {
  font-size: 14px;
  font-weight: 700;
  color: var(--accent);
}

.time-sep {
  font-size: 12px;
  color: var(--text-muted);
}

.total-time {
  font-size: 12px;
  color: var(--text-muted);
}

.trim-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.trim-range {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.trim-label {
  color: var(--text-muted);
  font-weight: 500;
}

.trim-value {
  color: var(--text-primary);
  font-weight: 600;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.trim-duration-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(255, 107, 43, 0.1);
  border-radius: 12px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.timeline-track-container {
  position: relative;
  width: 100%;
  height: 80px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  overflow: hidden;
  cursor: pointer;
}

.thumbnails-strip {
  position: absolute;
  inset: 0;
  display: flex;
  opacity: 0.4;
}

.thumbnail-frame {
  position: absolute;
  top: 0;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.waveform-container {
  position: absolute;
  inset: 10px 0;
  display: flex;
  align-items: center;
  pointer-events: none;
}

.waveform-bar {
  position: absolute;
  bottom: 50%;
  background: linear-gradient(to top, var(--accent), var(--accent-hover));
  opacity: 0.5;
  border-radius: 1px;
  transform: translateY(50%);
}

.timeline-ruler {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 20px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.ruler-mark {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translateX(-50%);
}

.ruler-line {
  width: 1px;
  height: 6px;
  background: var(--border-color);
}

.ruler-label {
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
  margin-top: 1px;
}

.timeline-trim-region {
  position: absolute;
  top: 0;
  height: calc(100% - 20px);
  pointer-events: none;
}

.trim-region-inner {
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg,
    rgba(255, 107, 43, 0.15) 0%,
    rgba(255, 107, 43, 0.25) 100%);
  border-top: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
}

.hover-tooltip {
  position: absolute;
  top: 4px;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  z-index: 20;
}

.trim-handle {
  position: absolute;
  top: 0;
  height: calc(100% - 20px);
  transform: translateX(-50%);
  cursor: ew-resize;
  z-index: 10;
}

.start-handle {
  cursor: ew-resize;
}

.end-handle {
  cursor: ew-resize;
}

.handle-line {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
}

.handle-knob {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  background: #fff;
  border: 2px solid var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: transform var(--transition-fast);
}

.trim-handle:hover .handle-knob {
  transform: translate(-50%, -50%) scale(1.15);
}

.nudge-controls {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.trim-handle:hover .nudge-controls {
  opacity: 1;
}

.nudge-btn {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nudge-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.playhead {
  position: absolute;
  top: 0;
  height: calc(100% - 20px);
  transform: translateX(-50%);
  z-index: 15;
  cursor: grab;
}

.playhead:active {
  cursor: grabbing;
}

.playhead-line {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 2px;
  height: 100%;
  background: #fff;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
}

.playhead-triangle {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid #fff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.timeline-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-color);
}

.fine-trim-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.trim-control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trim-control-group label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.trim-input-wrapper {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.input-btn {
  width: 24px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.input-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.input-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.trim-number-input {
  width: 60px;
  height: 26px;
  background: var(--bg-primary);
  border: none;
  border-left: 1px solid var(--border-color);
  border-right: 1px solid var(--border-color);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
  text-align: center;
  padding: 0 6px;
  -moz-appearance: textfield;
}

.trim-number-input::-webkit-outer-spin-button,
.trim-number-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.trim-number-input:focus {
  outline: none;
  border-color: var(--accent);
}

.trim-number-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-trim-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.quick-btn {
  padding: 5px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-btn:hover:not(:disabled) {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 700px) {
  .timeline-track-container {
    height: 60px;
  }

  .timeline-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .trim-info {
    width: 100%;
    justify-content: space-between;
  }

  .fine-trim-controls {
    gap: 10px;
  }

  .quick-trim-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
  }

  .handle-knob {
    width: 20px;
    height: 20px;
  }
}
</style>
