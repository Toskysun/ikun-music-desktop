<template lang="pug">
transition(enter-active-class="animated slideInRight" leave-active-class="animated slideOutDown" @after-enter="handleAfterEnter" @after-leave="handleAfterLeave")
  div(v-if="isShowPlayerDetail" :class="[$style.container, { fullscreen: isFullscreen, [$style.flowingGlowMode]: appSetting['player.flowingGlowBackground'] && webglSupported }]" @contextmenu="handleContextMenu")
    //- 流光溢彩背景效果（可选）
    transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
      flowing-glow-background(
        v-if="appSetting['player.flowingGlowBackground'] && visibled && musicInfo.pic"
        :album="musicInfo.pic"
        :fps="60"
        :flow-speed="4"
        :render-scale="0.5"
        :has-lyric="true"
        @webgl-not-supported="handleWebGLNotSupported"
        @init-failed="handleFlowingGlowInitFailed"
        @init-success="handleFlowingGlowInitSuccess"
      )
    //- 静态背景（当流光溢彩效果关闭或WebGL不支持时）
    div(v-if="!appSetting['player.flowingGlowBackground'] || !webglSupported" :class="$style.bg")
    //- div(:class="$style.bg" :style="bgStyle")
    //- div(:class="$style.bg2")
    ControlBtnsLeftHeader(v-if="appSetting['common.controlBtnPosition'] == 'left'")
    ControlBtnsRightHeader(v-else)
    div(:class="[$style.main, {[$style.showComment]: isShowPlayComment}]")
      div.left(:class="$style.left")
        //- div(:class="$style.info")
        div(:class="$style.info")
          img(v-if="musicInfo.pic" :class="$style.img" :src="musicInfo.pic")
          div.description(:class="['scroll', $style.description]")
            p {{ $t('player__music_name') }}{{ musicInfo.name }}
            p {{ $t('player__music_singer') }}{{ musicInfo.singer }}
            p(v-if="musicInfo.album") {{ $t('player__music_album') }}{{ musicInfo.album }}

      transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
        LyricPlayer(v-if="visibled")
      music-comment(v-if="visibled" :class="$style.comment" :show="isShowPlayComment" :music-info="playMusicInfo.musicInfo" @close="hideComment")
    transition(enter-active-class="animated fadeIn" leave-active-class="animated fadeOut")
      play-bar(v-if="visibled")
    transition(enter-active-class="animated-slow fadeIn" leave-active-class="animated-slow fadeOut")
      common-audio-visualizer(v-if="appSetting['player.audioVisualization'] && visibled")
</template>

<script>
import { ref, watch } from '@common/utils/vueTools'
import { isFullscreen } from '@renderer/store'
import {
  isShowPlayerDetail,
  isShowPlayComment,
  musicInfo,
  playMusicInfo,
} from '@renderer/store/player/state'
import {
  setShowPlayerDetail,
  setShowPlayComment,
  setShowPlayLrcSelectContentLrc,
} from '@renderer/store/player/action'
import LyricPlayer from './LyricPlayer.vue'
import PlayBar from './PlayBar.vue'
import MusicComment from './components/MusicComment/index.vue'
import ControlBtnsLeftHeader from './ControlBtnsLeftHeader.vue'
import ControlBtnsRightHeader from './ControlBtnsRightHeader.vue'
import FlowingGlowBackground from './components/FlowingGlowBackground.vue'
import { registerAutoHideMounse, unregisterAutoHideMounse } from './autoHideMounse'
import { appSetting } from '@renderer/store/setting'
import { closeWindow, maxWindow, minWindow, setFullScreen } from '@renderer/utils/ipc'

export default {
  name: 'CorePlayDetail',
  components: {
    ControlBtnsLeftHeader,
    ControlBtnsRightHeader,
    LyricPlayer,
    PlayBar,
    MusicComment,
    FlowingGlowBackground,
  },
  setup() {
    const visibled = ref(false)
    const webglSupported = ref(true) // 跟踪WebGL支持状态

    let clickTime = 0

    const hide = () => {
      setShowPlayerDetail(false)
    }
    const handleContextMenu = () => {
      if (window.performance.now() - clickTime > 400) {
        clickTime = window.performance.now()
        return
      }
      clickTime = 0
      hide()
    }

    const hideComment = () => {
      setShowPlayComment(false)
    }

    const handleAfterEnter = () => {
      if (isFullscreen.value) registerAutoHideMounse()

      visibled.value = true
    }

    const handleAfterLeave = () => {
      setShowPlayLrcSelectContentLrc(false)
      hideComment(false)
      visibled.value = false

      unregisterAutoHideMounse()
    }

    // WebGL降级处理
    const handleWebGLNotSupported = (info) => {
      console.warn('[PlayDetail] WebGL not supported, using static background:', info)
      webglSupported.value = false
    }

    const handleFlowingGlowInitFailed = (error) => {
      console.error('[PlayDetail] Flowing glow background init failed:', error)
      webglSupported.value = false
    }

    const handleFlowingGlowInitSuccess = () => {
      console.log('[PlayDetail] Flowing glow background initialized successfully')
      webglSupported.value = true
    }

    watch(isFullscreen, (isFullscreen) => {
      ;(isFullscreen ? registerAutoHideMounse : unregisterAutoHideMounse)()
    })

    return {
      appSetting,
      playMusicInfo,
      isShowPlayerDetail,
      isShowPlayComment,
      musicInfo,
      hide,
      handleContextMenu,
      hideComment,
      handleAfterEnter,
      handleAfterLeave,
      visibled,
      isFullscreen,
      webglSupported,
      handleWebGLNotSupported,
      handleFlowingGlowInitFailed,
      handleFlowingGlowInitSuccess,
      fullscreenExit() {
        void setFullScreen(false).then((fullscreen) => {
          isFullscreen.value = fullscreen
        })
      },
      min() {
        minWindow()
      },
      max() {
        maxWindow()
      },
      close() {
        closeWindow()
      },
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

@control-btn-width: @height-toolbar * 0.26;

.container {
  position: absolute;
  display: flex;
  flex-flow: column nowrap;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-color: var(--color-content-background);
  z-index: 10;
  // -webkit-app-region: drag;
  overflow: hidden;
  border-radius: @radius-border;
  color: var(--color-font);
  // border-left: 12px solid var(--color-primary-alpha-900);
  -webkit-app-region: no-drag;
  contain: strict;

  box-sizing: border-box;

  * {
    box-sizing: border-box;
  }
}
.bg {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background: var(--background-image) var(--background-image-position) no-repeat;
  background-size: var(--background-image-size);
  // background-size: 110% 110%;
  // filter: blur(60px);
  opacity: 0.7;
  z-index: -1;
  &:before {
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--color-app-background);
  }
  &:after {
    position: absolute;
    left: 0;
    top: 0;
    content: '';
    display: block;
    width: 100%;
    height: 100%;
    background-color: var(--color-main-background);
  }
}
// .bg2 {
//   position: absolute;
//   width: 100%;
//   height: 100%;
//   top: 0;
//   left: 0;
//   z-index: -1;
//   background-color: rgba(255, 255, 255, .8);
// }

.main {
  flex: auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  margin: 0 30px;
  position: relative;

  &.showComment {
    :global {
      .left {
        flex-basis: 18%;
        .description p {
          font-size: 12px;
        }
      }
      .right {
        flex-basis: 30%;
        .lyricSelectContent {
          font-size: 14px;
        }
      }
      .comment {
        opacity: 1;
        transform: scaleX(1);
      }
    }
  }
}
.left {
  flex: 0 0 40%;
  display: flex;
  flex-flow: column nowrap;
  align-items: center;
  padding: 13px;
  overflow: hidden;
  transition: flex-basis @transition-normal;
}

.info {
  display: flex;
  flex-flow: column nowrap;
  justify-content: flex-start;
  max-width: 300px;
  min-height: 0;
}
.img {
  max-width: 100%;
  max-height: 80%;
  min-width: 100%;
  box-shadow: 0 0 6px var(--color-primary-alpha-500);
  border-radius: 6px;
  opacity: 0.8;
}
.description {
  max-width: 300px;
  margin-top: 15px;
  padding-bottom: 15px;
  min-height: 0;
  p {
    line-height: 1.5;
    font-size: 14px;
    overflow-wrap: break-word;
  }
}

.comment {
  position: absolute;
  right: 0;
  top: 0;
  width: 50%;
  height: 100%;
  opacity: 1;
  margin-left: 10px;
  transform: scaleX(0);
}

// 流光溢彩模式下的固定颜色样式
.flowingGlowMode {
  // 设置固定的白色文字
  color: #fff;

  // 歌曲信息文字
  .description p {
    color: rgba(255, 255, 255, 0.85);
  }

  // 所有按钮和图标
  :global {
    // 控制按钮
    button, .playBtn {
      color: rgba(255, 255, 255, 0.9) !important;
      svg {
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      }
    }

    // 歌词文字 - 未播放行使用半透明白色
    .font-lrc {
      color: rgba(255, 255, 255, 0.6) !important;
    }
    .line-content {
      color: rgba(255, 255, 255, 0.6) !important;
    }
    // 当前播放行高亮 - 纯白色
    .line-content.line-mode.active .font-lrc,
    .line-content.font-mode.played .font-lrc {
      color: #fff !important;
    }
    // 逐字歌词渐变效果
    .line-content.font-mode > .line > .font-lrc > span {
      background-color: rgba(255, 255, 255, 0.6) !important;
      background-image: -webkit-linear-gradient(
        top,
        #fff,
        #fff
      ) !important;
    }

    // 可选歌词内容
    .lyricSelectContent {
      color: rgba(255, 255, 255, 0.7) !important;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      .lrcActive {
        color: #fff !important;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      }
    }

    // 时间标签
    .timeLabel span {
      color: #fff !important;
    }

    // 播放控制区域
    .playControl {
      color: #fff !important;
    }

    // 底部控制按钮
    .footerLeftControlBtns button {
      color: rgba(255, 255, 255, 0.8) !important;
      &.active {
        color: #fff !important;
      }
    }

    // 跳转按钮
    .skip {
      .label {
        color: rgba(255, 255, 255, 0.8) !important;
      }
      .line {
        border-color: rgba(255, 255, 255, 0.4) !important;
      }
    }

    // 窗口控制按钮
    .control-btn {
      color: rgba(255, 255, 255, 0.9) !important;
      svg {
        filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
      }
    }
  }
}
</style>
