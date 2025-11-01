import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { debounce, throttle } from '@common/utils/common'
// import { setDesktopLyricInfo, onGetDesktopLyricInfo } from '@renderer/utils/ipc'
// import { musicInfo } from '@renderer/store/player/state'
import { pause, play, playAtTime, setLyric, stop, init, sendInfo, setPlaybackRate } from '@renderer/core/lyric'
import { appSetting } from '@renderer/store/setting'
import { getCurrentTime as getPlayerCurrentTime } from '@renderer/plugins/player'
import { isPlay } from '@renderer/store/player/state'

const handleApplyPlaybackRate = debounce(setPlaybackRate, 300)

const handleSetProgress = () => {
  // Sync lyric to current playback position when progress changes
  // Update lyric position first (convert seconds to milliseconds)
  playAtTime(getPlayerCurrentTime() * 1000)

  // Then set playback state based on music player state
  if (isPlay.value) {
    // Resume lyric playback if music is playing
    play()
  } else {
    // Keep lyric paused if music is paused
    pause()
  }
}

// Throttle progress dragging updates to avoid performance issues
const handleProgressDragging = throttle((time: number) => {
  // Real-time lyric sync during progress bar dragging
  // Convert time from seconds to milliseconds for lyric player
  playAtTime(time * 1000)
  // Keep lyric paused if music is paused
  if (!isPlay.value) {
    pause()
  }
}, 100) // Update every 100ms during dragging

export default () => {
  init()

  const setPlayInfo = () => {
    stop()
    sendInfo()
  }

  watch(() => appSetting['player.isShowLyricTranslation'], setLyric)
  watch(() => appSetting['player.isShowLyricRoma'], setLyric)
  watch(() => appSetting['player.isSwapLyricTranslationAndRoma'], setLyric)
  watch(() => appSetting['player.isPlayLxlrc'], setLyric)

  window.app_event.on('play', play)
  window.app_event.on('pause', pause)
  window.app_event.on('stop', stop)
  window.app_event.on('error', pause)
  window.app_event.on('musicToggled', setPlayInfo)
  window.app_event.on('lyricUpdated', setLyric)
  window.app_event.on('setPlaybackRate', handleApplyPlaybackRate)
  window.app_event.on('setProgress', handleSetProgress)
  window.app_event.on('progressDragging', handleProgressDragging)

  onBeforeUnmount(() => {
    window.app_event.off('play', play)
    window.app_event.off('pause', pause)
    window.app_event.off('stop', stop)
    window.app_event.off('error', pause)
    window.app_event.off('musicToggled', setPlayInfo)
    window.app_event.off('lyricUpdated', setLyric)
    window.app_event.off('setPlaybackRate', handleApplyPlaybackRate)
    window.app_event.off('setProgress', handleSetProgress)
    window.app_event.off('progressDragging', handleProgressDragging)
  })
}
