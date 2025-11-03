import { onBeforeUnmount } from '@common/utils/vueTools'
import {
  onPlaying,
  onPause,
  onEnded,
  onError,
  onLoadeddata,
  onLoadstart,
  onCanplay,
  onEmptied,
  onWaiting,
  getErrorCode,
  getCurrentAudioId,
  isCrossfading,
} from '@renderer/plugins/player'

export default () => {
  // 修复只响应当前活跃audio的事件，忽略预加载audio的事件
  const rOnPlaying = onPlaying((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onPlaying from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onPlaying from audio${audioId}`)
    window.app_event.playerPlaying()
    window.app_event.play()
  })
  const rOnPause = onPause((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onPause from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onPause from audio${audioId}`)
    window.app_event.playerPause()
    window.app_event.pause()
  })
  const rOnEnded = onEnded((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onEnded from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onEnded from audio${audioId}`)
    window.app_event.playerEnded()
    // window.app_event.pause()
  })
  const rOnError = onError((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onError from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onError from audio${audioId}`)
    const errorCode = getErrorCode()
    window.app_event.error(errorCode)
    window.app_event.playerError(errorCode)
  })
  const rOnLoadeddata = onLoadeddata((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onLoadeddata from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onLoadeddata from audio${audioId}`)
    window.app_event.playerLoadeddata()
  })
  const rOnLoadstart = onLoadstart((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onLoadstart from audio${audioId} (current: audio${currentId}) - 预加载不触发状态更新`)
      return
    }
    console.log(`[ACTIVE] onLoadstart from audio${audioId}`)
    window.app_event.playerLoadstart()
  })
  const rOnCanplay = onCanplay((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onCanplay from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onCanplay from audio${audioId}`)
    window.app_event.playerCanplay()
  })
  const rOnEmptied = onEmptied((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onEmptied from audio${audioId} (current: audio${currentId})`)
      return
    }
    console.log(`[ACTIVE] onEmptied from audio${audioId}`)
    window.app_event.playerEmptied()
    // window.app_event.stop()
  })
  const rOnWaiting = onWaiting((audioId) => {
    const currentId = getCurrentAudioId()
    if (audioId !== currentId) {
      console.log(`[IGNORED] onWaiting from audio${audioId} (current: audio${currentId})`)
      return
    }

    // CRITICAL FIX: 在 crossfade 期间忽略 pause() 调用
    // 因为 previousAudio 可能还在播放淡出
    if (isCrossfading()) {
      console.log(`[ACTIVE] onWaiting from audio${audioId} (during crossfade - skipping pause)`)
      window.app_event.playerWaiting()
      return
    }

    console.log(`[ACTIVE] onWaiting from audio${audioId}`)
    window.app_event.pause()
    window.app_event.playerWaiting()
  })

  onBeforeUnmount(() => {
    rOnPlaying()
    rOnPause()
    rOnEnded()
    rOnError()
    rOnLoadeddata()
    rOnLoadstart()
    rOnCanplay()
    rOnEmptied()
    rOnWaiting()
  })
}
