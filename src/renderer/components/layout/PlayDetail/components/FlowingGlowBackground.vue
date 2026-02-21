<!-- Flowing Glow Background Effect based on AppleMusic-like-lyrics -->
<template lang="pug">
div(ref="wrapperRef" :class="$style.background")
</template>

<script lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from '@common/utils/vueTools'
import {
  AbstractBaseRenderer,
  BackgroundRender,
  MeshGradientRenderer,
} from '@applemusic-like-lyrics/core'

// WebGL检测函数（增强版 - 提供详细诊断信息）
const checkWebGLSupport = (): {
  webgl1: boolean
  webgl2: boolean
  diagnostics?: string
} => {
  // CRITICAL FIX Use separate canvases for each context type
  // A canvas can only have ONE rendering context - once getContext() is called,
  // you cannot get a different context type on the same canvas!

  // Test WebGL 1.0 with dedicated canvas
  const canvas1 = document.createElement('canvas')
  const gl = (canvas1.getContext('webgl') || canvas1.getContext('experimental-webgl')) as WebGLRenderingContext | null

  // Test WebGL 2.0 with SEPARATE canvas (critical!)
  const canvas2 = document.createElement('canvas')
  let gl2: WebGL2RenderingContext | null = null
  let diagnostics = ''

  try {
    console.log('[WebGL2 Detection] Attempting getContext("webgl2") on fresh canvas...')
    gl2 = canvas2.getContext('webgl2') as WebGL2RenderingContext | null

    console.log('[WebGL2 Detection] Result:', gl2 ? '✅ SUCCESS' : '❌ FAILED')

    if (!gl2 && gl) {
      // WebGL 1可用但WebGL 2不可用 - 收集诊断信息
      const glContext = gl as WebGLRenderingContext
      const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const vendor = glContext.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
        const renderer = glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
        diagnostics = `GPU: ${vendor} - ${renderer}. WebGL 2 may be disabled by GPU blocklist.`
      } else {
        diagnostics = 'WebGL 1 is available, but WebGL 2 context creation failed. Check Electron GPU settings.'
      }
    }
  } catch (error) {
    console.error('[WebGL2 Detection] Exception caught:', error)
    diagnostics = `WebGL 2 context creation threw error: ${error instanceof Error ? error.message : String(error)}`
  }

  return {
    webgl1: !!gl,
    webgl2: !!gl2,
    diagnostics: diagnostics || undefined,
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

        const fullDiagnostics = webglSupport.diagnostics
          ? `${supportInfo}. ${webglSupport.diagnostics}`
          : supportInfo

        console.warn(`[FlowingGlowBackground] ${fullDiagnostics}`)
        console.warn('[FlowingGlowBackground] Troubleshooting:')
        console.warn('  1. Ensure hardware acceleration is enabled in Electron')
        console.warn('  2. Check that GPU is not blocked by Chromium blocklist')
        console.warn('  3. Verify GPU drivers are up to date')
        console.warn('  4. Restart the application after GPU driver updates')

        emit('webgl-not-supported', {
          hasWebGL1: webglSupport.webgl1,
          hasWebGL2: webglSupport.webgl2,
          message: fullDiagnostics,
        })
        isWebGLSupported.value = false
        return
      }

      isWebGLSupported.value = true

      try {
        // 创建背景渲染器实例
        bgRenderRef.value = BackgroundRender.new(MeshGradientRenderer)
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
        console.log('[FlowingGlowBackground] Successfully initialized with WebGL 2')
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
      // FIX Delay initialization to ensure GPU process is fully ready
      // Electron's GPU context may not be available immediately on component mount
      console.log('[FlowingGlowBackground] Component mounted, delaying WebGL initialization...')

      // Wait for GPU context to be ready (100ms should be enough)
      setTimeout(() => {
        console.log('[FlowingGlowBackground] Starting WebGL initialization after delay...')
        initBackgroundRender()
      }, 100)
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
