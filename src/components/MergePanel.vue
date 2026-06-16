<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  canMerge: boolean
  isMerging: boolean
  progress: number
  status: string
  hasOutput: boolean
  outputFileName: string
  currentVideoName?: string | null
  currentVideoProgress?: number
  estimatedTimeRemaining?: string | null
  error?: string
}>()

const emit = defineEmits<{
  merge: []
  download: []
}>()

const isError = computed(() => props.status.includes('失败') || props.status.includes('错误'))

const formatProgress = (val?: number): string => {
  if (val === undefined || val === null) return '0%'
  return val.toFixed(0) + '%'
}

const showDetailedProgress = computed(() => {
  return props.isMerging && props.currentVideoName && props.progress < 90
})
</script>

<template>
  <div class="merge-panel">
    <h3 class="panel-title">合并输出</h3>

    <div v-if="isMerging || status" class="progress-section">
      <div class="progress-bar-track" :class="{ error: isError }">
        <div class="progress-bar-fill" :class="{ error: isError }" :style="{ width: progress + '%' }">
          <div v-if="progress > 0 && progress < 100 && !isError" class="progress-shine"/>
        </div>
      </div>

      <div class="progress-info">
        <span class="progress-status" :class="{ error: isError }">
          <svg v-if="isError" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <svg v-else-if="isMerging && progress < 100" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon spin-icon">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <svg v-else-if="hasOutput && !isMerging" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="status-icon">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {{ status }}
        </span>
        <span class="progress-percent" :class="{ error: isError }">{{ progress }}%</span>
      </div>

      <div v-if="showDetailedProgress" class="detailed-progress">
        <div class="video-progress-row">
          <div class="video-progress-info">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23,7 16,12 23,17 23,7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
            <span class="video-name">{{ currentVideoName }}</span>
          </div>
          <span class="video-progress-percent">{{ formatProgress(currentVideoProgress) }}</span>
        </div>
        <div class="video-progress-track">
          <div
            class="video-progress-fill"
            :style="{ width: (currentVideoProgress || 0) + '%' }"
          />
        </div>
      </div>

      <div v-if="isMerging && estimatedTimeRemaining" class="time-estimate">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
        <span>预计剩余: {{ estimatedTimeRemaining }}</span>
      </div>
    </div>

    <button
      class="merge-btn"
      :class="{ merging: isMerging, success: hasOutput && !isMerging, error: isError && !isMerging }"
      :disabled="!canMerge && !isMerging && !isError"
      @click="emit('merge')"
    >
      <svg v-if="isMerging" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin-icon">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <svg v-else-if="isError" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <svg v-else-if="hasOutput" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"/>
      </svg>
      <span>{{ isMerging ? '处理中...' : isError ? '重新合并' : hasOutput ? '重新合并' : '开始合并' }}</span>
    </button>

    <button
      v-if="hasOutput"
      class="download-btn"
      @click="emit('download')"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span>下载 {{ outputFileName }}</span>
    </button>

    <p v-if="!canMerge && !isMerging && !isError && !hasOutput" class="hint-text">
      请上传至少 2 段视频以开始合并
    </p>

    <div v-if="isError" class="error-hint">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <span>请检查视频文件是否损坏，或尝试其他格式</span>
    </div>
  </div>
</template>

<style scoped>
.merge-panel {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px;
}

.panel-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 18px;
}

.progress-section {
  margin-bottom: 16px;
}

.progress-bar-track {
  width: 100%;
  height: 8px;
  background: var(--bg-primary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-track.error {
  background: rgba(255, 71, 87, 0.1);
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover));
  border-radius: 4px;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
}

.progress-bar-fill.error {
  background: linear-gradient(90deg, var(--danger), #ff6b7a);
}

.progress-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%);
  animation: shine 1.5s ease-in-out infinite;
}

@keyframes shine {
  0% { left: -100%; }
  100% { left: 150%; }
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  gap: 8px;
}

.progress-status {
  font-size: 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-status.error {
  color: var(--danger);
}

.status-icon {
  flex-shrink: 0;
}

.progress-percent {
  font-size: 12px;
  color: var(--accent);
  font-weight: 700;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.progress-percent.error {
  color: var(--danger);
}

.detailed-progress {
  margin-top: 10px;
  padding: 8px 10px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

.video-progress-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  gap: 8px;
}

.video-progress-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.video-progress-info svg {
  color: var(--accent);
  flex-shrink: 0;
}

.video-name {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-progress-percent {
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.video-progress-track {
  width: 100%;
  height: 4px;
  background: var(--bg-primary);
  border-radius: 2px;
  overflow: hidden;
}

.video-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.2s ease;
}

.time-estimate {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(255, 107, 43, 0.08);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
}

.time-estimate svg {
  flex-shrink: 0;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.merge-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 20px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  font-family: var(--font-display);
  cursor: pointer;
  transition: all var(--transition-normal);
  letter-spacing: 0.3px;
}

.merge-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  box-shadow: var(--shadow-glow);
  transform: translateY(-1px);
}

.merge-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.merge-btn.merging {
  background: var(--bg-tertiary);
  cursor: wait;
}

.merge-btn.success {
  background: var(--success);
}

.merge-btn.error {
  background: var(--danger);
}

.merge-btn.error:hover:not(:disabled) {
  background: var(--danger-hover);
  box-shadow: 0 0 20px rgba(255, 71, 87, 0.25);
}

.download-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-md);
  background: rgba(255, 107, 43, 0.08);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all var(--transition-normal);
  margin-top: 10px;
}

.download-btn:hover {
  background: rgba(255, 107, 43, 0.15);
  box-shadow: var(--shadow-glow);
}

.hint-text {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 12px;
}

.error-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding: 8px 12px;
  background: rgba(255, 71, 87, 0.08);
  border-radius: var(--radius-sm);
  color: var(--danger);
  font-size: 11px;
  line-height: 1.4;
}
</style>
