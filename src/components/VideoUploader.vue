<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  upload: [files: File[]]
  error: [message: string]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const errorMessage = ref('')

const ACCEPTED_FORMATS = '.mp4,.webm,.mov,.avi,.mkv,.ogg'
const ACCEPTED_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/ogg']
const MAX_FILE_SIZE = 500 * 1024 * 1024

const validateFiles = (files: File[]): { valid: File[], errors: string[] } => {
  const valid: File[] = []
  const errors: string[] = []

  for (const file of files) {
    const isVideo = file.type.startsWith('video/') || ACCEPTED_MIME_TYPES.includes(file.type)
    const hasValidExt = ACCEPTED_FORMATS.split(',').some(ext => file.name.toLowerCase().endsWith(ext))

    if (!isVideo && !hasValidExt) {
      errors.push(`"${file.name}" 不是支持的视频格式`)
      continue
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push(`"${file.name}" 超过 500MB 大小限制`)
      continue
    }

    if (file.size === 0) {
      errors.push(`"${file.name}" 是空文件`)
      continue
    }

    valid.push(file)
  }

  return { valid, errors }
}

const showError = (msg: string) => {
  errorMessage.value = msg
  emit('error', msg)
  setTimeout(() => {
    errorMessage.value = ''
  }, 3000)
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  if (props.disabled) return

  const files = Array.from(e.dataTransfer?.files || [])
  if (!files.length) return

  const { valid, errors } = validateFiles(files)

  if (errors.length > 0) {
    showError(errors[0])
  }

  if (valid.length > 0) {
    emit('upload', valid)
  }
}

const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  if (!props.disabled) isDragging.value = true
}

const handleDragLeave = () => {
  isDragging.value = false
}

const handleClick = () => {
  if (props.disabled) return
  fileInput.value?.click()
}

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])

  if (files.length > 0) {
    const { valid, errors } = validateFiles(files)

    if (errors.length > 0) {
      showError(errors[0])
    }

    if (valid.length > 0) {
      emit('upload', valid)
    }
  }

  target.value = ''
}
</script>

<template>
  <div class="uploader-wrapper">
    <div
      class="uploader"
      :class="{ dragging: isDragging, disabled }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @click="handleClick"
    >
      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPTED_FORMATS"
        multiple
        class="file-input"
        @change="handleFileChange"
      />
      <div class="uploader-content">
        <div class="upload-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <p class="upload-text">拖拽视频文件到此处，或点击上传</p>
        <p class="upload-hint">支持 MP4、WebM、MOV 等格式，单文件最大 500MB</p>
      </div>
    </div>
    <transition name="fade">
      <div v-if="errorMessage" class="upload-error">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ errorMessage }}</span>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.uploader-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.uploader {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-normal);
  background: var(--bg-secondary);
  position: relative;
  overflow: hidden;
}

.uploader::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--accent-glow), transparent 70%);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.uploader:hover {
  border-color: var(--accent);
}

.uploader:hover::before {
  opacity: 0.3;
}

.uploader.dragging {
  border-color: var(--accent);
  background: rgba(255, 107, 43, 0.05);
}

.uploader.dragging::before {
  opacity: 0.5;
}

.uploader.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.file-input {
  display: none;
}

.upload-icon {
  color: var(--accent);
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
}

.upload-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  position: relative;
  z-index: 1;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-muted);
  position: relative;
  z-index: 1;
}

.upload-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 71, 87, 0.1);
  border: 1px solid rgba(255, 71, 87, 0.3);
  border-radius: var(--radius-md);
  color: var(--danger);
  font-size: 13px;
  font-weight: 500;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
