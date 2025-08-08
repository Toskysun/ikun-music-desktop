<template>
  <material-modal :show="show" :bg-close="bgClose" :teleport="teleport" @close="handleClose">
    <main :class="$style.main">
      <h2>{{ info.name }}<br />{{ info.singer }}</h2>

      <div :class="[$style.qualityList, qualitys.length > 4 && $style.scrollable]">
        <base-btn
          v-for="quality in qualitys"
          :key="quality.type"
          :class="$style.btn"
          @click="handleClick(quality.type)"
        >
          {{ getTypeName(quality.type) }}{{ quality.size && ` - ${quality.size.toUpperCase()}` }}
        </base-btn>
      </div>
    </main>
  </material-modal>
</template>

<script>
import { qualityList } from '@renderer/store'
import { createDownloadTasks } from '@renderer/store/download/action'

export default {
  props: {
    show: {
      type: Boolean,
      default: false,
    },
    musicInfo: {
      type: [Object, null],
      required: true,
    },
    listId: {
      type: String,
      default: '',
    },
    bgClose: {
      type: Boolean,
      default: true,
    },
    teleport: {
      type: String,
      default: '#root',
    },
  },
  emits: ['update:show'],
  setup() {
    return {
      qualityList,
    }
  },
  computed: {
    info() {
      return this.musicInfo || {}
    },
    sourceQualityList() {
      return this.qualityList[this.musicInfo.source] || []
    },
    qualitys() {
      return this.info.meta?.qualitys?.filter((quality) => this.checkSource(quality.type)) || []
    },
  },
  methods: {
    handleClick(quality) {
      void createDownloadTasks([this.musicInfo], quality, this.listId)
      this.handleClose()
    },
    handleClose() {
      this.$emit('update:show', false)
    },
    getTypeName(quality) {
      switch (quality) {
        case 'master':
          return this.$t('download__lossless') + ' Master'
        case 'atmos_plus':
          return this.$t('download__lossless') + ' Atmos 2.0'
        case 'atmos':
          return this.$t('download__lossless') + ' Atmos'
        case 'hires':
          return this.$t('download__lossless') + ' FLAC Hires'
        case 'flac':
        case '320k':
          return this.$t('download__high_quality') + ' ' + quality.toUpperCase()
        case '192k':
        case '128k':
          return this.$t('download__normal') + ' ' + quality.toUpperCase()
      }
    },
    checkSource(quality) {
      return this.sourceQualityList.includes(quality)
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
