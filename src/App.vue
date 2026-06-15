<script setup lang="ts">
import { useVideoMerger } from '@/composables/useVideoMerger'
import VideoUploader from '@/components/VideoUploader.vue'
import VideoList from '@/components/VideoList.vue'
import OutputConfig from '@/components/OutputConfig.vue'
import MergePanel from '@/components/MergePanel.vue'

const {
  videos,
  outputConfig,
  isMerging,
  mergeProgress,
  mergeStatus,
  outputUrl,
  outputFileName,
  canMerge,
  addVideos,
  removeVideo,
  updateTrim,
  moveVideo,
  reorderVideos,
  merge,
  download
} = useVideoMerger()
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="header-content">
        <div class="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="2" y="6" width="20" height="20" rx="3" stroke="var(--accent)" stroke-width="2.5"/>
            <polygon points="10,12 10,20 16,16" fill="var(--accent)"/>
            <rect x="22" y="10" width="8" height="12" rx="2" fill="var(--accent)" opacity="0.6"/>
            <line x1="24" y1="14" x2="28" y2="14" stroke="var(--bg-primary)" stroke-width="1.5"/>
            <line x1="24" y1="17" x2="28" y2="17" stroke="var(--bg-primary)" stroke-width="1.5"/>
          </svg>
          <h1 class="app-title">视频拼接器</h1>
        </div>
        <span class="app-subtitle">浏览器端视频裁剪与拼接工具</span>
      </div>
    </header>

    <main class="app-main">
      <div class="main-layout">
        <section class="left-panel">
          <VideoUploader @upload="addVideos" :disabled="isMerging" />
          <VideoList
            :videos="videos"
            :is-merging="isMerging"
            @remove="removeVideo"
            @update-trim="updateTrim"
            @move="moveVideo"
            @reorder="reorderVideos"
          />
        </section>

        <section class="right-panel">
          <OutputConfig
            v-model:config="outputConfig"
            :disabled="isMerging"
          />
          <MergePanel
            :can-merge="canMerge"
            :is-merging="isMerging"
            :progress="mergeProgress"
            :status="mergeStatus"
            :has-output="!!outputUrl"
            :output-file-name="outputFileName"
            @merge="merge"
            @download="download"
          />
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 32px;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  color: var(--text-primary);
}

.app-subtitle {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.app-main {
  flex: 1;
  padding: 28px 32px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 28px;
  align-items: start;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 80px;
}

@media (max-width: 900px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .right-panel {
    position: static;
  }
  .app-header {
    padding: 12px 16px;
  }
  .app-main {
    padding: 16px;
  }
}
</style>
