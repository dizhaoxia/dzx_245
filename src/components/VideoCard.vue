<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VideoItem } from '@/types'

const props = defineProps<{
  video: VideoItem
  index: number
  total: number
  isMerging: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
  'update-trim': [id: string, start: number, end: number]
  move: [index: number, direction: 'up' | 'down']
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const isPlaying = ref(false)
const currentTime = ref(0)
const showPreview = ref(false)

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
}

const trimDuration = computed(() => props.video.trimEnd - props.video.trimStart)

const startPercent = computed(() => (props.video.trimStart / props.video.duration) * 100)
const endPercent = computed(() => (props.video.trimEnd / props.video.duration) * 100)
const currentPercent = computed(() => (currentTime.value / props.video.duration) * 100)

const handleTrimStart = (event: Event) => {
  const val = parseFloat((event.target as HTMLInputElement).value)
  if (!isNaN(val)) {
    emit('update-trim', props.video.id, val, props.video.trimEnd)
  }
}

const handleTrimEnd = (event: Event) => {
  const val = parseFloat((event.target as HTMLInputElement).value)
  if (!isNaN(val)) {
    emit('update-trim', props.video.id, props.video.trimStart, val)
  }
}

const handleTimelineClick = (e: MouseEvent) => {
  if (!videoRef.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const newTime = percent * props.video.duration
  videoRef.value.currentTime = Math.max(props.video.trimStart, Math.min(props.video.trimEnd, newTime))
}

const togglePlay = () => {
  if (!videoRef.value) return
  if (isPlaying.value) {
    videoRef.value.pause()
  } else {
    videoRef.value.currentTime = props.video.trimStart
    videoRef.value.play()
  }
}

const onTimeUpdate = () => {
  if (!videoRef.value) return
  currentTime.value = videoRef.value.currentTime
  if (videoRef.value.currentTime >= props.video.trimEnd) {
    videoRef.value.pause()
    videoRef.value.currentTime = props.video.trimStart
  }
}

const onPlay = () => {
  isPlaying.value = true
}

const onPause = () => {
  isPlaying.value = false
}

const togglePreview = () => {
  showPreview.value = !showPreview.value
  if (!showPreview.value && videoRef.value) {
    videoRef.value.pause()
  }
}
</script>

<template>
  <div class="video-card" :class="{ processing: video.isProcessing, expanded: showPreview }">
    <div class="card-index">{{ index + 1 }}</div>

    <div class="card-thumb" @click="togglePreview">
      <img v-if="video.thumbnailUrl && !showPreview" :src="video.thumbnailUrl" alt="thumbnail" />
      <div v-else-if="!showPreview" class="thumb-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
      <video
        v-if="showPreview"
        ref="videoRef"
        :src="video.objectUrl"
        class="preview-video"
        @timeupdate="onTimeUpdate"
        @play="onPlay"
        @pause="onPause"
        muted
        playsinline
      />
      <span class="duration-badge">{{ formatTime(video.duration) }}</span>
      <div class="play-overlay" v-if="!showPreview">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
    </div>

    <div class="card-body">
      <div class="card-header">
        <div class="card-name" :title="video.name">{{ video.name }}</div>
        <button class="preview-toggle" @click="togglePreview" :disabled="isMerging">
          <svg v-if="!showPreview" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          <span>{{ showPreview ? '收起' : '预览' }}</span>
        </button>
      </div>

      <div v-if="showPreview" class="preview-controls">
        <button class="play-btn" @click="togglePlay" :disabled="isMerging">
          <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"/>
            <rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(trimDuration) }}</span>
      </div>

      <div class="timeline" @click="handleTimelineClick">
        <div class="timeline-track">
          <div class="timeline-trim" :style="{ left: startPercent + '%', width: (endPercent - startPercent) + '%' }"/>
          <div v-if="showPreview" class="timeline-playhead" :style="{ left: currentPercent + '%' }"/>
        </div>
        <div class="timeline-markers">
          <span class="marker-start">{{ formatTime(video.trimStart) }}</span>
          <span class="marker-end">{{ formatTime(video.trimEnd) }}</span>
        </div>
      </div>

      <div class="trim-controls">
        <div class="trim-field">
          <label>开始</label>
          <input
            type="number"
            :value="video.trimStart"
            :min="0"
            :max="video.trimEnd"
            :step="0.1"
            :disabled="isMerging"
            class="trim-input"
            @input="handleTrimStart($event)"
          />
        </div>
        <div class="trim-separator">→</div>
        <div class="trim-field">
          <label>结束</label>
          <input
            type="number"
            :value="video.trimEnd"
            :min="video.trimStart"
            :max="video.duration"
            :step="0.1"
            :disabled="isMerging"
            class="trim-input"
            @input="handleTrimEnd($event)"
          />
        </div>
        <div class="trim-duration">
          {{ formatTime(trimDuration) }}
        </div>
      </div>
    </div>

    <div class="card-actions">
      <button
        class="action-btn move-btn"
        :disabled="index === 0 || isMerging"
        @click="emit('move', index, 'up')"
        title="上移"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
      <button
        class="action-btn move-btn"
        :disabled="index === total - 1 || isMerging"
        @click="emit('move', index, 'down')"
        title="下移"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <button
        class="action-btn delete-btn"
        :disabled="isMerging"
        @click="emit('remove', video.id)"
        title="删除"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.video-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  transition: all var(--transition-fast);
  cursor: default;
}

.video-card:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-card);
}

.video-card.processing {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}

.video-card.expanded {
  align-items: stretch;
}

.card-index {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
  flex-shrink: 0;
  margin-top: 2px;
}

.card-thumb {
  width: 120px;
  height: 68px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.video-card.expanded .card-thumb {
  width: 180px;
  height: 101px;
}

.card-thumb:hover {
  transform: scale(1.02);
}

.card-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.duration-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-body);
  z-index: 2;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.card-thumb:hover .play-overlay {
  opacity: 1;
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.preview-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.preview-toggle:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.preview-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.preview-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

.play-btn {
  width: 28px;
  height: 28px;
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
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.timeline {
  cursor: pointer;
  padding: 4px 0;
}

.timeline-track {
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  position: relative;
  overflow: visible;
}

.timeline-trim {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  opacity: 0.6;
}

.timeline-playhead {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 2px solid var(--accent);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.timeline-markers {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}

.marker-start,
.marker-end {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.trim-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.trim-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.trim-field label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.trim-input {
  width: 64px;
  height: 28px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-body);
  padding: 0 6px;
  text-align: center;
  transition: border-color var(--transition-fast);
}

.trim-input:focus {
  outline: none;
  border-color: var(--accent);
}

.trim-input:disabled {
  opacity: 0.5;
}

.trim-separator {
  color: var(--text-muted);
  font-size: 12px;
}

.trim-duration {
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
  margin-left: 4px;
  padding: 2px 8px;
  background: rgba(255, 107, 43, 0.1);
  border-radius: 10px;
}

.card-actions {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: transparent;
  color: var(--text-muted);
}

.action-btn:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.move-btn:hover:not(:disabled) {
  color: var(--accent);
}

.delete-btn:hover:not(:disabled) {
  color: var(--danger);
  background: rgba(255, 71, 87, 0.1);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

@media (max-width: 700px) {
  .video-card {
    flex-wrap: wrap;
    gap: 10px;
  }
  .card-thumb {
    width: 100px;
    height: 56px;
  }
  .video-card.expanded .card-thumb {
    width: 140px;
    height: 79px;
  }
  .trim-controls {
    flex-wrap: wrap;
  }
}
</style>
