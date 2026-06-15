<script setup lang="ts">
import { ref, watch } from 'vue'
import type { VideoItem } from '@/types'
import VideoCard from './VideoCard.vue'

const props = defineProps<{
  videos: VideoItem[]
  isMerging: boolean
}>()

const emit = defineEmits<{
  remove: [id: string]
  'update-trim': [id: string, start: number, end: number]
  move: [index: number, direction: 'up' | 'down']
  reorder: [list: VideoItem[]]
}>()

const localVideos = ref<VideoItem[]>([...props.videos])
const dragIndex = ref(-1)
const dragOverIndex = ref(-1)

watch(() => props.videos, (newVal) => {
  localVideos.value = [...newVal]
}, { deep: true })

const onDragStart = (e: DragEvent, index: number) => {
  dragIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (dragIndex.value === -1) return
  dragOverIndex.value = index
}

const onDrop = (e: DragEvent, index: number) => {
  e.preventDefault()
  if (dragIndex.value === -1 || dragIndex.value === index) {
    dragOverIndex.value = -1
    return
  }

  const list = [...localVideos.value]
  const [removed] = list.splice(dragIndex.value, 1)
  list.splice(index, 0, removed)
  localVideos.value = list
  emit('reorder', localVideos.value)

  dragIndex.value = -1
  dragOverIndex.value = -1
}

const onDragEnd = () => {
  dragIndex.value = -1
  dragOverIndex.value = -1
}

const onDragLeave = () => {
  dragOverIndex.value = -1
}
</script>

<template>
  <div class="video-list" v-if="videos.length > 0">
    <div class="list-header">
      <h2 class="list-title">视频列表</h2>
      <div class="list-header-right">
        <span class="list-count">{{ videos.length }} 段视频</span>
        <span class="drag-hint">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"/>
            <line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
            <line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/>
            <line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          拖拽排序
        </span>
      </div>
    </div>
    <div class="list-body">
      <div
        v-for="(video, index) in localVideos"
        :key="video.id"
        class="list-item"
        :class="{
          dragging: dragIndex === index,
          'drag-over': dragOverIndex === index && dragIndex !== index
        }"
        draggable="true"
        @dragstart="onDragStart($event, index)"
        @dragover="onDragOver($event, index)"
        @drop="onDrop($event, index)"
        @dragend="onDragEnd"
        @dragleave="onDragLeave"
      >
        <div class="drag-handle" v-if="!isMerging">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="6" r="1"/>
            <circle cx="9" cy="12" r="1"/>
            <circle cx="9" cy="18" r="1"/>
            <circle cx="15" cy="6" r="1"/>
            <circle cx="15" cy="12" r="1"/>
            <circle cx="15" cy="18" r="1"/>
          </svg>
        </div>
        <VideoCard
          :video="video"
          :index="index"
          :total="videos.length"
          :is-merging="isMerging"
          @remove="emit('remove', $event)"
          @update-trim="(id, s, e) => emit('update-trim', id, s, e)"
          @move="(i, d) => emit('move', i, d)"
        />
      </div>
    </div>
  </div>
  <div v-else class="empty-state">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <line x1="2" y1="8" x2="22" y2="8"/>
      <line x1="8" y1="2" x2="8" y2="8"/>
    </svg>
    <p>请上传视频文件以开始编辑</p>
  </div>
</template>

<style scoped>
.video-list {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-tertiary);
}

.list-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.list-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.list-count {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  background: var(--bg-primary);
  padding: 2px 10px;
  border-radius: 20px;
}

.drag-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
}

.list-body {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.list-item {
  display: flex;
  align-items: stretch;
  gap: 8px;
  transition: all var(--transition-fast);
  opacity: 1;
  transform: scale(1);
}

.list-item.dragging {
  opacity: 0.4;
  transform: scale(0.98);
}

.list-item.drag-over {
  transform: translateY(2px);
}

.list-item.drag-over :deep(.video-card) {
  border-color: var(--accent);
  box-shadow: var(--shadow-glow);
}

.list-item[draggable="true"] {
  cursor: grab;
}

.list-item[draggable="true"]:active {
  cursor: grabbing;
}

.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  color: var(--text-muted);
  cursor: grab;
  opacity: 0.6;
  transition: opacity var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.drag-handle:hover {
  opacity: 1;
  color: var(--accent);
}

.drag-handle:active {
  cursor: grabbing;
}

.list-item:hover .drag-handle {
  opacity: 0.8;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  gap: 12px;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
