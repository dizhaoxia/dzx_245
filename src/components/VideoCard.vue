<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VideoItem } from '@/types'
import TimelineTrimmer from './TimelineTrimmer.vue'

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

const showTrimmer = ref(false)

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
}

const trimDuration = computed(() => props.video.trimEnd - props.video.trimStart)
const originalSize = computed(() => formatFileSize(props.video.fileSize))
const trimmedRatio = computed(() => ((trimDuration.value / props.video.duration) * 100).toFixed(1))

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

const handleUpdateTrim = (start: number, end: number) => {
  emit('update-trim', props.video.id, start, end)
}

const toggleTrimmer = () => {
  showTrimmer.value = !showTrimmer.value
}

const handleSeek = (time: number) => {
  console.log('[VideoCard] Seek to:', time)
}
</script>

<template>
  <div class="video-card" :class="{ processing: video.isProcessing, expanded: showTrimmer }">
    <div class="card-index">{{ index + 1 }}</div>

    <div class="card-thumb" @click="toggleTrimmer">
      <img v-if="video.thumbnailUrl && !showTrimmer" :src="video.thumbnailUrl" alt="thumbnail" />
      <div v-else-if="!showTrimmer" class="thumb-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
      <span class="duration-badge">{{ formatTime(video.duration) }}</span>
      <div class="play-overlay" v-if="!showTrimmer">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </div>
    </div>

    <div class="card-body">
      <div class="card-header">
        <div class="card-name" :title="video.name">{{ video.name }}</div>
        <button class="trimmer-toggle" @click.stop="toggleTrimmer" :disabled="isMerging">
          <svg v-if="!showTrimmer" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12,8 L12,16"/>
            <path d="M8,12 L16,12"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
          <span>{{ showTrimmer ? '收起裁剪' : '裁剪' }}</span>
        </button>
      </div>

      <div class="card-meta">
        <div class="meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22,11.08 V11.08 A10,10,0,1,1,12.92,2 h0 A9,9,0,0,0,22,11.08 Z"/>
            <polyline points="12,6 12,12 16,14"/>
          </svg>
          <span>{{ formatTime(trimDuration) }}</span>
        </div>
        <div class="meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>{{ originalSize }}</span>
        </div>
        <div class="meta-item" :class="{ 'trim-active': trimDuration < video.duration }">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2 L6,6 l0,12 l8,4 l0,-16 Z"/>
            <path d="M6,6 l12,12"/>
          </svg>
          <span>{{ trimmedRatio }}%</span>
        </div>
      </div>

      <div v-if="!showTrimmer" class="timeline-preview">
        <div class="timeline-track">
          <div
            class="timeline-trim"
            :style="{
              left: (video.trimStart / video.duration * 100) + '%',
              width: ((video.trimEnd - video.trimStart) / video.duration * 100) + '%'
            }"
          />
        </div>
        <div class="timeline-labels">
          <span>{{ formatTime(video.trimStart) }}</span>
          <span>{{ formatTime(video.trimEnd) }}</span>
        </div>
      </div>

      <Transition name="trimmer">
        <div v-if="showTrimmer" class="trimmer-container">
          <TimelineTrimmer
            :duration="video.duration"
            :trim-start="video.trimStart"
            :trim-end="video.trimEnd"
            :thumbnails="video.thumbnails"
            :waveform-data="video.waveformData"
            :object-url="video.objectUrl"
            :disabled="isMerging"
            :show-waveform="true"
            @update-trim="handleUpdateTrim"
            @seek="handleSeek"
          />
        </div>
      </Transition>
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
  width: 160px;
  height: 90px;
}

.card-thumb:hover {
  transform: scale(1.02);
}

.card-thumb img {
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

.trimmer-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
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

.trimmer-toggle:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(255, 107, 43, 0.1);
}

.trimmer-toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.meta-item.trim-active {
  color: var(--accent);
  font-weight: 600;
}

.timeline-preview {
  width: 100%;
}

.timeline-track {
  width: 100%;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
}

.timeline-trim {
  position: absolute;
  top: 0;
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  opacity: 0.7;
}

.timeline-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 2px;
  font-size: 9px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.trimmer-container {
  width: 100%;
  margin-top: 4px;
}

.trimmer-enter-active,
.trimmer-leave-active {
  transition: all 0.3s ease;
}

.trimmer-enter-from,
.trimmer-leave-to {
  opacity: 0;
  transform: translateY(-10px);
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
  .card-meta {
    gap: 8px;
  }
}
</style>
