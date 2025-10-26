<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>
        {{ $t('download__multiple_tip', { len: list.length }) }}<br />{{
          $t('download__multiple_tip2')
        }}
      </h2>

      <div :class="[$style.qualityList, qualityOptions.length > 4 && $style.scrollable]">
        <base-btn
          v-for="quality in qualityOptions"
          :key="quality.value"
          :class="$style.btn"
          @click="handleClick(quality.value)"
        >
          {{ quality.label }}
        </base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script>
import { createDownloadTasks } from '@renderer/store/download/action'

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    listId: {
      type: String,
      default: '',
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show', 'confirm'],
  data() {
    return {
      qualityOptions: [
        { value: '128k', label: this.$t('download__normal') + ' - 128K' },
        { value: '320k', label: this.$t('download__high_quality') + ' - 320K' },
        { value: 'flac', label: this.$t('download__lossless') + ' - FLAC' },
        { value: 'hires', label: this.$t('download__lossless') + ' - FLAC Hires' },
        { value: 'atmos', label: this.$t('download__lossless') + ' - Atmos' },
        { value: 'atmos_plus', label: this.$t('download__lossless') + ' - Atmos 2.0' },
        { value: 'master', label: this.$t('download__lossless') + ' - Master' },
      ],
    }
  },
  methods: {
    async handleClick(quality) {
      console.log('[DownloadMultipleModal] Quality selected:', quality)
      console.log('[DownloadMultipleModal] List to download:', this.list.filter((item) => item.source != 'local'))
      console.log('[DownloadMultipleModal] ListId:', this.listId)

      try {
        await createDownloadTasks(
          this.list.filter((item) => item.source != 'local'),
          quality,
          this.listId
        )
        console.log('[DownloadMultipleModal] Download tasks created successfully')
      } catch (error) {
        console.error('[DownloadMultipleModal] Error creating download tasks:', error)
        alert('下载任务创建失败: ' + error.message)
      }

      this.handleClose()
      this.$emit('confirm')
    },
    handleClose() {
      this.$emit('update:show', false)
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.main {
  padding: 15px;
  max-width: 400px;
  min-width: 200px;
  display: flex;
  flex-flow: column nowrap;
  justify-content: center;

  h2 {
    font-size: 13px;
    color: var(--color-font);
    line-height: 1.3;
    text-align: center;
    margin-bottom: 15px;
  }
}

.qualityList {
  display: flex;
  flex-direction: column;
  gap: 15px;

  &.scrollable {
    max-height: 260px;
    overflow-y: auto;
    padding-right: 5px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: var(--color-secondary-background);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 3px;

      &:hover {
        background: var(--color-primary);
      }
    }
  }
}

.btn {
  display: block;
  flex-shrink: 0;
}
</style>
