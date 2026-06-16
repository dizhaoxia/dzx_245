<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import type { ErrorInfo } from '@/types'

const props = defineProps<{
  error: ErrorInfo | null
  autoClose?: boolean
  duration?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const isVisible = ref(false)
const isLeaving = ref(false)

const errorIcon = computed(() => {
  const type = props.error?.type
  switch (type) {
    case 'memory':
      return {
        icon: 'memory',
        color: 'var(--warning)'
      }
    case 'codec':
      return {
        icon: 'codec',
        color: 'var(--accent)'
      }
    case 'trim':
      return {
        icon: 'trim',
        color: 'var(--accent)'
      }
    case 'file':
      return {
        icon: 'file',
        color: 'var(--danger)'
      }
    case 'ffmpeg':
      return {
        icon: 'ffmpeg',
        color: 'var(--accent)'
      }
    default:
      return {
        icon: 'unknown',
        color: 'var(--danger)'
      }
  }
})

const errorTitle = computed(() => {
  const type = props.error?.type
  switch (type) {
    case 'memory':
      return '内存不足'
    case 'codec':
      return '编码不支持'
    case 'trim':
      return '裁剪参数无效'
    case 'file':
      return '文件错误'
    case 'ffmpeg':
      return '处理失败'
    default:
      return '发生错误'
  }
})

const suggestions = computed(() => {
  const type = props.error?.type
  switch (type) {
    case 'memory':
      return [
        '关闭其他不必要的浏览器标签页',
        '减少待处理的视频数量',
        '降低输出分辨率或码率',
        '尝试使用 WebM 格式（占用资源更少）'
      ]
    case 'codec':
      return [
        '尝试更换输出编码格式（H.264 兼容性更好）',
        '检查输入视频文件是否损坏',
        '尝试转换输入视频格式后再处理'
      ]
    case 'trim':
      return [
        '确保起始时间小于结束时间',
        '裁剪时长不能少于 0.5 秒',
        '结束时间不能超过视频总时长'
      ]
    case 'file':
      return [
        '确保文件是有效的视频文件',
        '尝试重新上传文件',
        '检查文件是否已损坏',
        '尝试转换为 MP4 或 WebM 格式'
      ]
    case 'ffmpeg':
      return [
        '检查网络连接（首次加载需要下载 FFmpeg）',
        '尝试刷新页面后重新操作',
        '关闭其他占用资源的程序'
      ]
    default:
      return [
        '刷新页面后重试',
        '检查网络连接',
        '减少视频数量或降低质量'
      ]
  }
})

watch(() => props.error, (newError, oldError) => {
  if (newError && !oldError) {
    isVisible.value = true
    isLeaving.value = false

    if (props.autoClose !== false && props.duration !== 0) {
      setTimeout(() => {
        handleClose()
      }, props.duration || 8000)
    }
  } else if (!newError && oldError) {
    handleClose()
  }
}, { immediate: true })

const handleClose = () => {
  isLeaving.value = true
  setTimeout(() => {
    isVisible.value = false
    emit('close')
  }, 300)
}
</script>

<template>
  <Transition name="toast">
    <div v-if="isVisible && error" class="error-toast" :class="{ leaving: isLeaving }">
      <div class="toast-header">
        <div class="toast-icon" :style="{ color: errorIcon.color }">
          <svg v-if="errorIcon.icon === 'memory'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="14" width="20" height="7" rx="1"/>
            <path d="M16,14 V9 a4,4,0,0,0-8,0 v5"/>
            <line x1="6" y1="18" x2="6" y2="18.01"/>
            <line x1="10" y1="18" x2="10" y2="18.01"/>
            <line x1="14" y1="18" x2="14" y2="18.01"/>
            <line x1="18" y1="18" x2="18" y2="18.01"/>
          </svg>
          <svg v-else-if="errorIcon.icon === 'codec'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16,18 22,12 16,6"/>
            <polyline points="8,6 2,12 8,18"/>
          </svg>
          <svg v-else-if="errorIcon.icon === 'trim'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="6" cy="6" r="3"/>
            <circle cx="18" cy="6" r="3"/>
            <line x1="6" y1="9" x2="6" y2="21"/>
            <line x1="18" y1="9" x2="18" y2="21"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <svg v-else-if="errorIcon.icon === 'file'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14,2 H6 a2,2,0,0,0-2,2 v16 a2,2,0,0,0,2,2 h12 a2,2,0,0,0,2-2 V8 z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <svg v-else-if="errorIcon.icon === 'ffmpeg'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <polygon points="10,9 15,12 10,15 10,9"/>
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div class="toast-title-section">
          <h4 class="toast-title">{{ errorTitle }}</h4>
          <p class="toast-message">{{ error.message }}</p>
        </div>
        <button class="close-btn" @click="handleClose" title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div v-if="error.details" class="toast-details">
        <span class="details-label">详情:</span>
        <span class="details-text">{{ error.details }}</span>
      </div>

      <div class="toast-suggestions">
        <span class="suggestions-title">建议解决方案:</span>
        <ul class="suggestions-list">
          <li v-for="(suggestion, idx) in suggestions" :key="idx">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
            {{ suggestion }}
          </li>
        </ul>
      </div>

      <div class="toast-footer">
        <span class="error-timestamp">
          {{ new Date(error.timestamp).toLocaleTimeString() }}
        </span>
        <button class="report-btn" @click="handleClose">
          知道了
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.error-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 360px;
  max-width: calc(100vw - 48px);
  background: var(--bg-secondary);
  border: 1px solid var(--danger);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  padding: 16px;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.error-toast.leaving {
  animation: slideOut 0.3s ease forwards;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.toast-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 71, 87, 0.1);
  border-radius: 50%;
}

.toast-title-section {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--danger);
  margin: 0 0 4px 0;
  font-family: var(--font-display);
}

.toast-message {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.toast-details {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  font-size: 12px;
}

.details-label {
  color: var(--text-muted);
  font-weight: 500;
  flex-shrink: 0;
}

.details-text {
  color: var(--text-secondary);
  font-family: var(--font-mono, monospace);
  word-break: break-all;
}

.toast-suggestions {
  margin-bottom: 12px;
}

.suggestions-title {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.suggestions-list li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 0;
  line-height: 1.4;
}

.suggestions-list svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--success);
}

.toast-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.error-timestamp {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.report-btn {
  padding: 6px 14px;
  background: var(--accent);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.report-btn:hover {
  background: var(--accent-hover);
}

@media (max-width: 480px) {
  .error-toast {
    right: 12px;
    left: 12px;
    width: auto;
    bottom: 12px;
  }
}
</style>
