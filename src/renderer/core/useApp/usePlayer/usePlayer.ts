import { onBeforeUnmount, watch } from '@common/utils/vueTools'
import { useI18n } from '@renderer/plugins/i18n'
import { setTitle } from '@renderer/utils'

import { getCurrentTime, getDuration, setPause, setStop, onNearEnd } from '@renderer/plugins/player'

import useMediaSessionInfo from './useMediaSessionInfo'
import usePlayProgress from './usePlayProgress'
import usePlayEvent from './usePlayEvent'

import { musicInfo, playMusicInfo, playedList } from '@renderer/store/player/state'
import {
  setPlay,
  setAllStatus,
  addPlayedList,
  clearPlayedList,
  // resetPlayerMusicInfo,
} from '@renderer/store/player/action'

import { appSetting } from '@renderer/store/setting'

import useLyric from './useLyric'
import useVolume from './useVolume'
import useWatchList from './useWatchList'
import { HOTKEY_PLAYER } from '@common/hotKey'
import {
  playNext,
  pause,
  playPrev,
  togglePlay,
  collectMusic,
  uncollectMusic,
  dislikeMusic,
} from '@renderer/core/player'
import usePlaybackRate from './usePlaybackRate'
import useSoundEffect from './useSoundEffect'
import useMaxOutputChannelCount from './useMaxOutputChannelCount'
import { setPowerSaveBlocker } from '@renderer/core/player/utils'
import usePreloadNextMusic from './usePreloadNextMusic'
import useGaplessPreloadTime from './useGaplessPreloadTime'
import useSmoothSeek from './useSmoothSeek'

export default () => {
  const t = useI18n()

  usePlayProgress()
  useMediaSessionInfo()
  usePlayEvent()
  useLyric()
  useVolume()
  useMaxOutputChannelCount()
  useSoundEffect()
  usePlaybackRate()
  useGaplessPreloadTime()
  useWatchList()
  usePreloadNextMusic()
  useSmoothSeek()

  const handlePlayNext = () => {
    void playNext()
  }
  const handlePlayPrev = () => {
    void playPrev()
  }

  const addPowerSaveBlocker = () => {
    setPowerSaveBlocker(true)
  }
  const removePowerSaveBlocker = () => {
    setPowerSaveBlocker(false)
  }

  const setPlayStatus = () => {
    setPlay(true)
  }
  const setPauseStatus = () => {
    setPlay(false)
    if (window.lx.isPlayedStop) pause()
    removePowerSaveBlocker()
  }

  const handleUpdatePlayInfo = () => {
    setTitle(musicInfo.id ? `${musicInfo.name} - ${musicInfo.singer}` : null)
  }

  const handleCanplay = () => {
    if (window.lx.isPlayedStop) {
      setPause()
    }
  }

  // CRITICAL FIX V5: 提前触发切换（在音频即将结束前 1 秒）
  const handleNearEnd = () => {
    if (window.lx.isPlayedStop) {
      console.log('played stop - ignoring near end')
      return
    }
    console.log('🎵 Near end detected, triggering early playNext for seamless transition')
    void playNext(true)
  }

  const handleEnded = () => {
    // CRITICAL FIX V5: onEnded 时不再触发 playNext，因为 handleNearEnd 已经处理了
    // 这里只设置状态
    if (window.lx.isPlayedStop) {
      setAllStatus(t('player__end'))
      console.log('played stop')
      return
    }
    setAllStatus(t('player__end'))
    console.log('🎵 Audio ended (crossfade should have already started)')
  }

  const setProgress = (time: number) => {
    window.app_event.setProgress(time)
  }
  // Note: Seek forward/backward is now handled by useSmoothSeek
  // which supports both short press (configurable step from settings) and long press (smooth seeking)
  const handleSeekforward = () => {
    const seekOffset = appSetting['player.seekStep'] || 3
    const curTime = getCurrentTime()
    const time = Math.min(getCurrentTime() + seekOffset, getDuration())
    if (Math.trunc(curTime) == Math.trunc(time)) return
    setProgress(time)
  }
  const handleSeekbackward = () => {
    const seekOffset = appSetting['player.seekStep'] || 3
    const curTime = getCurrentTime()
    const time = Math.max(getCurrentTime() - seekOffset, 0)
    if (Math.trunc(curTime) == Math.trunc(time)) return
    setProgress(time)
  }

  const setStopStatus = () => {
    setPlay(false)
    setTitle(null)
    setAllStatus('')
    setStop()
    removePowerSaveBlocker()
  }

  watch(
    () => appSetting['player.togglePlayMethod'],
    (newValue) => {
      // setLoopPlay(newValue == 'singleLoop')
      if (playedList.length) clearPlayedList()
      if (newValue == 'random' && playMusicInfo.musicInfo && !playMusicInfo.isTempPlay)
        addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })
    }
  )

  // setLoopPlay(appSetting['player.togglePlayMethod'] == 'singleLoop')

  window.key_event.on(HOTKEY_PLAYER.next.action, handlePlayNext)
  window.key_event.on(HOTKEY_PLAYER.prev.action, handlePlayPrev)
  window.key_event.on(HOTKEY_PLAYER.toggle_play.action, togglePlay)
  window.key_event.on(HOTKEY_PLAYER.music_love.action, collectMusic)
  window.key_event.on(HOTKEY_PLAYER.music_unlove.action, uncollectMusic)
  window.key_event.on(HOTKEY_PLAYER.music_dislike.action, dislikeMusic)
  // Note: seekforward/seekbackward handlers are now registered in useSmoothSeek
  // to support long press smooth seeking
  // window.key_event.on(HOTKEY_PLAYER.seekbackward.action, handleSeekbackward)
  // window.key_event.on(HOTKEY_PLAYER.seekforward.action, handleSeekforward)
  // 空格键暂停/播放
  window.key_event.on('key_space_down', togglePlay)

  window.app_event.on('play', setPlayStatus)
  window.app_event.on('pause', setPauseStatus)
  window.app_event.on('error', setPauseStatus)
  window.app_event.on('stop', setStopStatus)
  window.app_event.on('musicToggled', handleUpdatePlayInfo)
  window.app_event.on('playerCanplay', handleCanplay)
  window.app_event.on('playerPlaying', addPowerSaveBlocker)
  window.app_event.on('playerEmptied', removePowerSaveBlocker)

  window.app_event.on('playerEnded', handleEnded)

  // CRITICAL FIX V5: 注册提前切换回调
  const removeNearEndListener = onNearEnd(handleNearEnd)

  onBeforeUnmount(() => {
    window.key_event.off(HOTKEY_PLAYER.next.action, handlePlayNext)

    window.key_event.off(HOTKEY_PLAYER.prev.action, handlePlayPrev)
    window.key_event.off(HOTKEY_PLAYER.toggle_play.action, togglePlay)
    window.key_event.off(HOTKEY_PLAYER.music_love.action, collectMusic)
    window.key_event.off(HOTKEY_PLAYER.music_unlove.action, uncollectMusic)
    window.key_event.off(HOTKEY_PLAYER.music_dislike.action, dislikeMusic)
    // Note: seekforward/seekbackward cleanup is now handled in useSmoothSeek
    // window.key_event.off(HOTKEY_PLAYER.seekbackward.action, handleSeekbackward)
    // window.key_event.off(HOTKEY_PLAYER.seekforward.action, handleSeekforward)
    // 移除空格键监听
    window.key_event.off('key_space_down', togglePlay)

    window.app_event.off('play', setPlayStatus)
    window.app_event.off('pause', setPauseStatus)
    window.app_event.off('error', setPauseStatus)
    window.app_event.off('stop', setStopStatus)
    window.app_event.off('musicToggled', handleUpdatePlayInfo)
    window.app_event.off('playerPlaying', addPowerSaveBlocker)
    window.app_event.off('playerEmptied', removePowerSaveBlocker)
    window.app_event.off('playerCanplay', handleCanplay)

    window.app_event.off('playerEnded', handleEnded)

    // CRITICAL FIX V5: 清理提前切换监听器
    removeNearEndListener()
  })
}
