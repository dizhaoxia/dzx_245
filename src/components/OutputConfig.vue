<script setup lang="ts">
import type { OutputConfig } from '@/types'

const config = defineModel<OutputConfig>('config', { required: true })

defineProps<{
  disabled?: boolean
}>()
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
          @click="config.format = 'mp4'"
        >
          MP4
        </button>
        <button
          class="toggle-btn"
          :class="{ active: config.format === 'webm' }"
          :disabled="disabled"
          @click="config.format = 'webm'"
        >
          WebM
        </button>
      </div>
    </div>

    <div class="config-group">
      <label class="config-label">画质预设</label>
      <div class="quality-options">
        <button
          v-for="q in (['low', 'medium', 'high'] as const)"
          :key="q"
          class="quality-btn"
          :class="{ active: config.quality === q }"
          :disabled="disabled"
          @click="config.quality = q"
        >
          <span class="q-name">{{ q === 'low' ? '低' : q === 'medium' ? '中' : '高' }}</span>
          <span class="q-detail">{{ q === 'low' ? '360p' : q === 'medium' ? '720p' : '1080p' }}</span>
        </button>
      </div>
    </div>

    <div class="config-group">
      <label class="config-label">音频</label>
      <div class="audio-toggle" @click="!disabled && (config.keepAudio = !config.keepAudio)">
        <div class="toggle-track" :class="{ on: config.keepAudio, disabled }">
          <div class="toggle-thumb" />
        </div>
        <span class="toggle-label">{{ config.keepAudio ? '保留音频' : '移除音频' }}</span>
      </div>
    </div>
  </div>
</template>

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

.audio-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.toggle-track {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  background: var(--border-color);
  position: relative;
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.toggle-track.on {
  background: var(--accent);
}

.toggle-track.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.toggle-track.on .toggle-thumb {
  transform: translateX(18px);
}

.toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
