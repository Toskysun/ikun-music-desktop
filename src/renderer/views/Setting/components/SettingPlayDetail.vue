<template lang="pug">
dt#play_detail {{ $t('setting__play_detail') }}
dd
  .gap-top
    base-checkbox(id="setting_play_detail_font_zoom_enable" :model-value="appSetting['playDetail.isZoomActiveLrc']" :label="$t('setting__play_detail_font_zoom')" @update:model-value="updateSetting({'playDetail.isZoomActiveLrc': $event})")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_delayScroll" :model-value="appSetting['playDetail.isDelayScroll']" :label="$t('setting__play_detail_lyric_delay_scroll')" @update:model-value="updateSetting({ 'playDetail.isDelayScroll': $event })")
  .gap-top
    base-checkbox(id="setting_play_detail_lyric_progress_enable" :model-value="appSetting['playDetail.isShowLyricProgressSetting']" :label="$t('setting__play_detail_lyric_progress')" @update:model-value="updateSetting({'playDetail.isShowLyricProgressSetting': $event})")

  //- 流光溢彩设置（通过关于页面的彩蛋解锁）
  .gap-top(v-if="showFlowingGlowSetting")
    base-checkbox(id="setting_play_detail_flowing_glow_background" :model-value="appSetting['player.flowingGlowBackground']" :label="$t('setting__play_detail_flowing_glow_background')" @update:model-value="updateSetting({'player.flowingGlowBackground': $event})")

  //- 逐字歌词上移效果设置（通过关于页面的 ikun0014 彩蛋解锁）
  .gap-top(v-if="showLyricTextLiftSetting")
    base-checkbox(id="setting_play_detail_lyric_text_lift" :model-value="appSetting['playDetail.lyricTextLiftEffect']" :label="$t('setting__play_detail_lyric_text_lift')" @update:model-value="updateSetting({'playDetail.lyricTextLiftEffect': $event})")
  .gap-top(v-if="showLyricTextLiftSetting && appSetting['playDetail.lyricTextLiftEffect']")
    h3 {{ $t('setting__play_detail_lyric_text_lift_offset') }}
    .slider-row
      base-slider-bar(
        :class="$style.slider"
        :value="appSetting['playDetail.lyricTextLiftEffectOffset']"
        :min="1"
        :max="20"
        @change="updateSetting({'playDetail.lyricTextLiftEffectOffset': Math.round($event)})"
      )
      span.gap-left {{ (appSetting['playDetail.lyricTextLiftEffectOffset'] / 100).toFixed(2) }}em

dd
  h3#play_detail_align {{ $t('setting__play_detail_align') }}
  div
    base-checkbox.gap-left(id="setting_play_detail_align_left" :model-value="appSetting['playDetail.style.align']" need value="left" :label="$t('setting__play_detail_align_left')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_center" :model-value="appSetting['playDetail.style.align']" need value="center" :label="$t('setting__play_detail_align_center')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")
    base-checkbox.gap-left(id="setting_play_detail_align_right" :model-value="appSetting['playDetail.style.align']" need value="right" :label="$t('setting__play_detail_align_right')" @update:model-value="updateSetting({ 'playDetail.style.align': $event })")

</template>

<script>
import { computed } from '@common/utils/vueTools'
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingPlayDetail',
  setup() {
    // 从持久化设置中读取彩蛋解锁状态
    const showFlowingGlowSetting = computed(() => appSetting['player.flowingGlowUnlocked'])
    const showLyricTextLiftSetting = computed(() => appSetting['playDetail.lyricTextLiftEffectUnlocked'])

    return {
      appSetting,
      updateSetting,
      showFlowingGlowSetting,
      showLyricTextLiftSetting,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.slider {
  flex: 1;
  width: 150px;
}
</style>
