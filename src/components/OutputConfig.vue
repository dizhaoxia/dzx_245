<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { OutputConfig, SizeEstimate } from '@/types'
import {
  RESOLUTION_OPTIONS,
  FRAMERATE_OPTIONS,
  VIDEO_CODEC_OPTIONS,
  AUDIO_CODEC_OPTIONS,
  AUDIO_MODE_OPTIONS,
  BITRATE_PRESETS,
  QUALITY_PRESETS
} from '@/types'

const props = defineProps<{
  config: OutputConfig
  disabled?: boolean
  estimatedSize?: SizeEstimate | null
  totalDuration?: number
}>()

const emit = defineEmits<{
  'update:config': [config: OutputConfig]
}>()

const showAdvanced = ref(false)

const availableVideoCodecs = computed(() => {
  return VIDEO_CODEC_OPTIONS.filter(c => c.format.includes(props.config.format))
})

const availableAudioCodecs = computed(() => {
  return AUDIO_CODEC_OPTIONS.filter(c => c.format.includes(props.config.format))
})

const useAdvanced = computed({
  get: () => props.config.advanced.useAdvanced,
  set: (val) => {
    emit('update:config', {
      ...props.config,
      advanced: { ...props.config.advanced, useAdvanced: val }
    })
  }
})

const effectiveResolution = computed(() => {
  if (props.config.advanced.useAdvanced) {
    return props.config.advanced.resolution
  }
  return QUALITY_PRESETS[props.config.quality].resolution
})

const effectiveVideoBitrate = computed(() => {
  if (props.config.advanced.useAdvanced) {
    return props.config.advanced.videoBitrate
  }
  return QUALITY_PRESETS[props.config.quality].bitrate
})

const confidenceLabel = computed(() => {
  if (!props.estimatedSize) return ''
  const map = { low: '预估', medium: '较准确', high: '准确' }
  return map[props.estimatedSize.confidence]
})

const confidenceColor = computed(() => {
  if (!props.estimatedSize) return 'var(--text-muted)'
  const map = { low: 'var(--text-muted)', medium: 'var(--accent)', high: 'var(--success)' }
  return map[props.estimatedSize.confidence]
})

const formatDuration = (seconds?: number): string => {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const updateConfig = <K extends keyof OutputConfig>(key: K, value: OutputConfig[K]) => {
  emit('update:config', { ...props.config, [key]: value })
}

const updateAdvanced = <K extends keyof OutputConfig['advanced']>(
  key: K,
  value: OutputConfig['advanced'][K]
) => {
  emit('update:config', {
    ...props.config,
    advanced: { ...props.config.advanced, [key]: value }
  })
}

const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value
}

watch(() => props.config.format, (_newFormat) => {
  const videoCodec = availableVideoCodecs.value[0]?.value || 'libx264'
  const audioCodec = availableAudioCodecs.value[0]?.value || 'aac'
  updateAdvanced('videoCodec', videoCodec as any)
  updateAdvanced('audioCodec', audioCodec as any)
}, { immediate: true })
</script>

<template>
  <div class="config-panel">
    <h3 class="panel-title">输出配置</h3>

    <div class="config-group">
      <label class="config-label">输出格式</label>
      <div class="format-toggle">
        <button
          class="toggle-btn"
          :class="{ active: config.format === 'mp4' }"
          :disabled="disabled"
          @click="updateConfig('format', 'mp4')"
        >
          MP4
        </button>
        <button
          class="toggle-btn"
          :class="{ active: config.format === 'webm' }"
          :disabled="disabled"
          @click="updateConfig('format', 'webm')"
        >
          WebM
        </button>
      </div>
    </div>

    <div class="config-group" v-if="!config.advanced.useAdvanced">
      <label class="config-label">画质预设</label>
      <div class="quality-options">
        <button
          v-for="q in (['low', 'medium', 'high'] as const)"
          :key="q"
          class="quality-btn"
          :class="{ active: config.quality === q }"
          :disabled="disabled"
          @click="updateConfig('quality', q)"
        >
          <span class="q-name">{{ q === 'low' ? '低' : q === 'medium' ? '中' : '高' }}</span>
          <span class="q-detail">{{ q === 'low' ? '360p / 1M' : q === 'medium' ? '720p / 2.5M' : '1080p / 5M' }}</span>
        </button>
      </div>
    </div>

    <div class="config-group">
      <label class="config-label">音频处理</label>
      <div class="audio-mode-options">
        <button
          v-for="mode in AUDIO_MODE_OPTIONS"
          :key="mode.value"
          class="audio-mode-btn"
          :class="{ active: config.audioMode === mode.value, disabled: disabled }"
          :disabled="disabled"
          :title="mode.desc"
          @click="updateConfig('audioMode', mode.value)"
        >
          <svg v-if="mode.value === 'mix'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/>
            <path d="M15.54,8.46 A5,5,0,0,1,15.54,15.54"/>
            <path d="M18.36,5.64 A9,9,0,0,1,18.36,18.36"/>
          </svg>
          <svg v-else-if="mode.value === 'first'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/>
            <circle cx="17" cy="12" r="2"/>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11,5 6,9 2,9 2,15 6,15 11,19 11,5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
          <span>{{ mode.label }}</span>
        </button>
      </div>
    </div>

    <div class="config-group">
      <div class="advanced-toggle-header" @click="toggleAdvanced">
        <label class="config-label" style="margin-bottom: 0; cursor: pointer;">
          <span>高级设置</span>
          <span class="advanced-status" :class="{ on: useAdvanced }">
            {{ useAdvanced ? '已启用' : '已关闭' }}
          </span>
        </label>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          :style="{ transform: showAdvanced ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }"
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      <Transition name="advanced">
        <div v-if="showAdvanced" class="advanced-settings">
          <div class="advanced-toggle-row">
            <span class="toggle-label">启用高级参数</span>
            <div class="switch-wrapper" @click="!disabled && (useAdvanced = !useAdvanced)">
              <div class="switch-track" :class="{ on: useAdvanced, disabled }">
                <div class="switch-thumb"/>
              </div>
            </div>
          </div>

          <div v-if="useAdvanced" class="advanced-fields">
            <div class="field-row">
              <label>分辨率</label>
              <select
                class="field-select"
                :value="config.advanced.resolution"
                :disabled="disabled"
                @change="updateAdvanced('resolution', ($event.target as HTMLSelectElement).value as any)"
              >
                <option v-for="opt in RESOLUTION_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="field-row">
              <label>帧率</label>
              <select
                class="field-select"
                :value="config.advanced.frameRate"
                :disabled="disabled"
                @change="updateAdvanced('frameRate', ($event.target as HTMLSelectElement).value as any)"
              >
                <option v-for="opt in FRAMERATE_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="field-row">
              <label>视频码率</label>
              <select
                class="field-select"
                :value="config.advanced.videoBitrate"
                :disabled="disabled"
                @change="updateAdvanced('videoBitrate', ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="opt in BITRATE_PRESETS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="field-row">
              <label>音频码率</label>
              <select
                class="field-select"
                :value="config.advanced.audioBitrate"
                :disabled="disabled"
                @change="updateAdvanced('audioBitrate', ($event.target as HTMLSelectElement).value)"
              >
                <option value="64k">64 Kbps (低)</option>
                <option value="96k">96 Kbps (较低)</option>
                <option value="128k">128 Kbps (标准)</option>
                <option value="192k">192 Kbps (较高)</option>
                <option value="256k">256 Kbps (高)</option>
                <option value="320k">320 Kbps (极高)</option>
              </select>
            </div>

            <div class="field-row">
              <label>视频编码</label>
              <select
                class="field-select"
                :value="config.advanced.videoCodec"
                :disabled="disabled"
                @change="updateAdvanced('videoCodec', ($event.target as HTMLSelectElement).value as any)"
              >
                <option v-for="opt in availableVideoCodecs" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="field-row">
              <label>音频编码</label>
              <select
                class="field-select"
                :value="config.advanced.audioCodec"
                :disabled="disabled"
                @change="updateAdvanced('audioCodec', ($event.target as HTMLSelectElement).value as any)"
              >
                <option v-for="opt in availableAudioCodecs" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="estimatedSize" class="size-estimate">
      <div class="estimate-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21,15v4a2,2,0,0,1-2,2H5a2,2,0,0,1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>文件大小预估</span>
      </div>
      <div class="estimate-content">
        <div class="estimate-main">
          <span class="estimate-value">{{ estimatedSize.formattedTotal }}</span>
          <span class="estimate-confidence" :style="{ color: confidenceColor }">
            ({{ confidenceLabel }})
          </span>
        </div>
        <div class="estimate-details">
          <div class="detail-row">
            <span>视频:</span>
            <span>{{ formatFileSize(estimatedSize.videoBytes) }}</span>
          </div>
          <div class="detail-row" v-if="estimatedSize.audioBytes > 0">
            <span>音频:</span>
            <span>{{ formatFileSize(estimatedSize.audioBytes) }}</span>
          </div>
          <div class="detail-row" v-if="totalDuration">
            <span>时长:</span>
            <span>{{ formatDuration(totalDuration) }}</span>
          </div>
        </div>
        <div class="estimate-params">
          <span>{{ effectiveResolution }}</span>
          <span class="param-sep">•</span>
          <span>{{ effectiveVideoBitrate }}视频</span>
          <span class="param-sep" v-if="config.audioMode !== 'mute'">•</span>
          <span v-if="config.audioMode !== 'mute'">{{ config.advanced.audioBitrate }}音频</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
</script>

<style scoped>
.config-panel {
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

.config-group {
  margin-bottom: 18px;
}

.config-group:last-child {
  margin-bottom: 0;
}

.config-label {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.format-toggle {
  display: flex;
  gap: 6px;
  background: var(--bg-primary);
  padding: 3px;
  border-radius: var(--radius-sm);
}

.toggle-btn {
  flex: 1;
  padding: 7px 12px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-body);
}

.toggle-btn:hover:not(:disabled) {
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 2px 8px var(--accent-glow);
}

.toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quality-options {
  display: flex;
  gap: 6px;
}

.quality-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 8px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quality-btn:hover:not(:disabled) {
  border-color: var(--accent);
}

.quality-btn.active {
  border-color: var(--accent);
  background: rgba(255, 107, 43, 0.1);
}

.quality-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.q-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.quality-btn.active .q-name {
  color: var(--accent);
}

.q-detail {
  font-size: 10px;
  color: var(--text-muted);
  font-weight: 500;
}

.audio-mode-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audio-mode-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.audio-mode-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}

.audio-mode-btn.active {
  border-color: var(--accent);
  background: rgba(255, 107, 43, 0.1);
  color: var(--accent);
}

.audio-mode-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.advanced-toggle-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.advanced-toggle-header:hover {
  color: var(--text-primary);
}

.advanced-status {
  margin-left: 8px;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  text-transform: none;
}

.advanced-status.on {
  background: rgba(255, 107, 43, 0.15);
  color: var(--accent);
}

.advanced-enter-active,
.advanced-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.advanced-enter-from,
.advanced-leave-to {
  opacity: 0;
  max-height: 0;
}

.advanced-enter-to,
.advanced-leave-from {
  max-height: 500px;
}

.advanced-settings {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}

.advanced-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}

.switch-wrapper {
  cursor: pointer;
}

.switch-wrapper.disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.switch-track {
  width: 42px;
  height: 24px;
  border-radius: 12px;
  background: var(--border-color);
  position: relative;
  transition: background var(--transition-fast);
}

.switch-track.on {
  background: var(--accent);
}

.switch-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.switch-track.on .switch-thumb {
  transform: translateX(18px);
}

.advanced-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.field-row label {
  width: 70px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  flex-shrink: 0;
}

.field-select {
  flex: 1;
  height: 32px;
  padding: 0 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-body);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.field-select:hover:not(:disabled) {
  border-color: var(--accent);
}

.field-select:focus {
  outline: none;
  border-color: var(--accent);
}

.field-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.size-estimate {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.estimate-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.estimate-content {
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
  padding: 12px;
}

.estimate-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}

.estimate-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
  font-family: var(--font-display);
}

.estimate-confidence {
  font-size: 11px;
  font-weight: 500;
}

.estimate-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-muted);
}

.detail-row span:last-child {
  color: var(--text-secondary);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.estimate-params {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
}

.param-sep {
  opacity: 0.5;
}
</style>
