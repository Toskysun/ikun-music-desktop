<!-- Flowing Glow Background Effect based on AppleMusic-like-lyrics -->
<template lang="pug">
div(ref="wrapperRef" :class="$style.background")
</template>

<script lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import {
  AbstractBaseRenderer,
  BackgroundRender,
  EplorRenderer,
} from '@applemusic-like-lyrics/core'

// WebGL检测函数
const checkWebGLSupport = (): { webgl1: boolean; webgl2: boolean } => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  const gl2 = canvas.getContext('webgl2')

  return {
    webgl1: !!gl,
    webgl2: !!gl2,
  }
}

interface Props {
  // 封面图片 URL
  album?: string
  // 是否为视频封面
  albumIsVideo?: boolean
  // 帧率
  fps?: number
  // 是否暂停
  playing?: boolean
  // 流动速度
  flowSpeed?: number
  // 渲染比例
  renderScale?: number
  // 低频音量（用于与音频可视化同步）
  lowFreqVolume?: number
  // 是否有歌词
  hasLyric?: boolean
}

export default {
  name: 'FlowingGlowBackground',
  props: {
    album: {
      type: String,
      default: '',
    },
    albumIsVideo: {
      type: Boolean,
      default: false,
    },
    fps: {
      type: Number,
      default: 60,
    },
    playing: {
      type: Boolean,
      default: false,
    },
    flowSpeed: {
      type: Number,
      default: 1,
    },
    renderScale: {
      type: Number,
      default: 0.5,
    },
    lowFreqVolume: {
      type: Number,
      default: 0,
    },
    hasLyric: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['webgl-not-supported', 'init-failed', 'init-success'],
  setup(props: Props, { emit }: { emit: (event: string, ...args: any[]) => void }) {
    const wrapperRef = ref<HTMLDivElement>()
    const bgRenderRef = ref<AbstractBaseRenderer>()
    const isWebGLSupported = ref(false)

    // 初始化背景渲染器
    const initBackgroundRender = () => {
      if (!wrapperRef.value) return

      // 检查WebGL支持
      const webglSupport = checkWebGLSupport()

      if (!webglSupport.webgl2) {
        const supportInfo = webglSupport.webgl1
          ? 'WebGL 1.0 is supported, but WebGL 2.0 is required for flowing glow background'
          : 'WebGL is not supported by your system'

        console.warn(`[FlowingGlowBackground] ${supportInfo}. Falling back to static background.`)
        emit('webgl-not-supported', {
          hasWebGL1: webglSupport.webgl1,
          hasWebGL2: webglSupport.webgl2,
          message: supportInfo,
        })
        isWebGLSupported.value = false
        return
      }

      isWebGLSupported.value = true

      try {
        // 创建背景渲染器实例
        bgRenderRef.value = BackgroundRender.new(EplorRenderer)
        const canvasEl = bgRenderRef.value.getElement()

        // 设置画布样式
        canvasEl.style.width = '100%'
        canvasEl.style.height = '100%'
        canvasEl.style.position = 'absolute'
        canvasEl.style.top = '0'
        canvasEl.style.left = '0'

        // 添加到包装器
        wrapperRef.value.appendChild(canvasEl)

        // 初始化配置
        if (props.album) {
          bgRenderRef.value.setAlbum(props.album, props.albumIsVideo || false)
        }
        if (props.fps) {
          bgRenderRef.value.setFPS(props.fps)
        }
        if (props.flowSpeed) {
          bgRenderRef.value.setFlowSpeed(props.flowSpeed)
        }
        if (props.renderScale) {
          bgRenderRef.value.setRenderScale(props.renderScale)
        }
        if (props.hasLyric !== undefined) {
          bgRenderRef.value.setHasLyric(props.hasLyric)
        }

        emit('init-success')
        console.log('[FlowingGlowBackground] Successfully initialized with WebGL2')
      } catch (error) {
        console.error('[FlowingGlowBackground] Failed to initialize:', error)
        emit('init-failed', { error })
        isWebGLSupported.value = false
      }
    }

    // 监听封面变化
    watch(
      () => props.album,
      (newAlbum) => {
        if (isWebGLSupported.value && bgRenderRef.value && newAlbum) {
          bgRenderRef.value.setAlbum(newAlbum, props.albumIsVideo || false)
        }
      },
    )

    // 监听帧率变化
    watch(
      () => props.fps,
      (newFps) => {
        if (isWebGLSupported.value && bgRenderRef.value && newFps) {
          bgRenderRef.value.setFPS(newFps)
        }
      },
    )

    // 监听播放状态
    watch(
      () => props.playing,
      (isPlaying) => {
        if (isWebGLSupported.value && bgRenderRef.value) {
          isPlaying ? bgRenderRef.value.pause() : bgRenderRef.value.resume()
        }
      },
    )

    // 监听流动速度
    watch(
      () => props.flowSpeed,
      (newSpeed) => {
        if (isWebGLSupported.value && bgRenderRef.value && newSpeed) {
          bgRenderRef.value.setFlowSpeed(newSpeed)
        }
      },
    )

    // 监听渲染比例
    watch(
      () => props.renderScale,
      (newScale) => {
        if (isWebGLSupported.value && bgRenderRef.value && newScale) {
          bgRenderRef.value.setRenderScale(newScale)
        }
      },
    )

    // 监听低频音量
    watch(
      () => props.lowFreqVolume,
      (newVolume) => {
        if (isWebGLSupported.value && bgRenderRef.value && newVolume !== undefined) {
          bgRenderRef.value.setLowFreqVolume(newVolume)
        }
      },
    )

    // 监听歌词状态
    watch(
      () => props.hasLyric,
      (hasLyric) => {
        if (isWebGLSupported.value && bgRenderRef.value && hasLyric !== undefined) {
          bgRenderRef.value.setHasLyric(hasLyric)
        }
      },
    )

    onMounted(() => {
      initBackgroundRender()
    })

    onBeforeUnmount(() => {
      if (isWebGLSupported.value && bgRenderRef.value) {
        try {
          bgRenderRef.value.dispose()
          console.log('[FlowingGlowBackground] Successfully disposed renderer')
        } catch (error) {
          console.error('[FlowingGlowBackground] Failed to dispose renderer:', error)
        }
      }
    })

    return {
      wrapperRef,
      isWebGLSupported,
    }
  },
}
</script>

<style lang="less" module>
.background {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
</style>
