import {
  isEmpty,
  setPause,
  setPlay,
  setResource,
  setStop,
  preloadNextMusic,
  switchToNextAudio,
  clearNextAudio,
} from '@renderer/plugins/player'
import {
  isPlay,
  playedList,
  playInfo,
  playMusicInfo,
  tempPlayList,
  musicInfo as _musicInfo,
} from '@renderer/store/player/state'
import {
  getList,
  clearPlayedList,
  clearTempPlayeList,
  setPlayMusicInfo,
  addPlayedList,
  setMusicInfo,
  setAllStatus,
  removeTempPlayList,
  setPlayListId,
  removePlayedList,
} from '@renderer/store/player/action'
import { appSetting } from '@renderer/store/setting'
import { getMusicUrl, getPicPath, getLyricInfo } from '../music/index'
import { filterList } from './utils'
import { requestMsg } from '@renderer/utils/message'
import { getRandom } from '@renderer/utils/index'
import { addListMusics, removeListMusics } from '@renderer/store/list/action'
import { loveList } from '@renderer/store/list/state'
import { addDislikeInfo } from '@renderer/core/dislikeList'
// import { checkMusicFileAvailable } from '@renderer/utils/music'

let gettingUrlId = ''
const createGettingUrlId = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem) => {
  const tInfo =
    'progress' in musicInfo
      ? musicInfo.metadata.musicInfo.meta.toggleMusicInfo
      : musicInfo.meta.toggleMusicInfo
  return `${musicInfo.id}_${tInfo?.id ?? ''}`
}
const createDelayNextTimeout = (delay: number) => {
  let timeout: NodeJS.Timeout | null
  const clearDelayNextTimeout = () => {
    // console.log(this.timeout)
    if (timeout) {
      clearTimeout(timeout)
      timeout = null
    }
  }

  const addDelayNextTimeout = () => {
    clearDelayNextTimeout()
    timeout = setTimeout(() => {
      timeout = null
      if (window.lx.isPlayedStop) return
      console.warn('delay next timeout timeout', delay)
      void playNext(true)
    }, delay)
  }

  return {
    clearDelayNextTimeout,
    addDelayNextTimeout,
  }
}
const { addDelayNextTimeout, clearDelayNextTimeout } = createDelayNextTimeout(5000)
const { addDelayNextTimeout: addLoadTimeout, clearDelayNextTimeout: clearLoadTimeout } =
  createDelayNextTimeout(100000)

/**
 * 检查音乐信息是否已更改
 */
const diffCurrentMusicInfo = (curMusicInfo: LX.Music.MusicInfo | LX.Download.ListItem): boolean => {
  // return curMusicInfo !== playMusicInfo.musicInfo || isPlay.value
  return (
    gettingUrlId != createGettingUrlId(curMusicInfo) ||
    curMusicInfo.id != playMusicInfo.musicInfo?.id ||
    isPlay.value
  )
}

let cancelDelayRetry: (() => void) | null = null
const delayRetry = async (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false
): Promise<string | null> => {
  // if (cancelDelayRetry) cancelDelayRetry()
  return new Promise<string | null>((resolve, reject) => {
    const time = getRandom(2, 6)
    setAllStatus(window.i18n.t('player__getting_url_delay_retry', { time }))
    const tiemout = setTimeout(() => {
      getMusicPlayUrl(musicInfo, isRefresh, true)
        .then((result) => {
          cancelDelayRetry = null
          resolve(result)
        })
        .catch(async (err: any) => {
          cancelDelayRetry = null
          reject(err)
        })
    }, time * 1000)
    cancelDelayRetry = () => {
      clearTimeout(tiemout)
      cancelDelayRetry = null
      resolve(null)
    }
  })
}
const getMusicPlayUrl = async (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh = false,
  isRetryed = false,
  isPreload = false  // 新增标记是否为预加载模式
): Promise<string | null> => {
  // this.musicInfo.url = await getMusicPlayUrl(targetSong, type)
  if (!isPreload) {
    setAllStatus(window.i18n.t('player__getting_url'))
    if (appSetting['player.autoSkipOnError']) addLoadTimeout()
  }

  // const type = getPlayType(appSetting['player.highQuality'], musicInfo)
  let toggleMusicInfo = ('progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo).meta
    .toggleMusicInfo

  return (
    toggleMusicInfo
      ? getMusicUrl({
          musicInfo: toggleMusicInfo,
          isRefresh,
          allowToggleSource: false,
        })
      : Promise.reject(new Error('not found'))
  )
    .catch(async () => {
      return getMusicUrl({
        musicInfo,
        isRefresh,
        onToggleSource(mInfo) {
          if (!isPreload && diffCurrentMusicInfo(musicInfo)) return  // 预加载模式跳过检查
          if (!isPreload) setAllStatus(window.i18n.t('toggle_source_try'))
        },
      })
    })
    .then((url) => {
      // 预加载模式跳过当前音乐检查
      if (!isPreload && (window.lx.isPlayedStop || diffCurrentMusicInfo(musicInfo))) return null

      return url
    })
    .catch((err) => {
      // console.log('err', err.message)
      if (
        !isPreload &&  // 预加载模式跳过检查
        (window.lx.isPlayedStop ||
          diffCurrentMusicInfo(musicInfo) ||
          err.message == requestMsg.cancelRequest)
      )
        return null

      if (err.message == requestMsg.tooManyRequests) return delayRetry(musicInfo, isRefresh)

      if (!isRetryed) return getMusicPlayUrl(musicInfo, isRefresh, true, isPreload)

      throw err
    })
}

export const setMusicUrl = (
  musicInfo: LX.Music.MusicInfo | LX.Download.ListItem,
  isRefresh?: boolean
) => {
  // if (appSetting['player.autoSkipOnError']) addLoadTimeout()
  if (!diffCurrentMusicInfo(musicInfo)) return
  if (cancelDelayRetry) cancelDelayRetry()
  gettingUrlId = createGettingUrlId(musicInfo)
  void getMusicPlayUrl(musicInfo, isRefresh)
    .then((url) => {
      if (!url) return
      setResource(url)

      // 关键修复延迟清除状态，确保在 loadstart 事件处理之后执行
      // setResource 会同步触发 loadstart 事件，导致状态被重新设置
      // 使用 setTimeout 将清除操作推迟到下一个事件循环
      setTimeout(() => {
        setAllStatus('')
      }, 0)

      // 关键修复URL设置成功后，立即预加载下一首
      console.log('🔗 Current music URL set, triggering preload for next music')
      void preloadNextMusicUrl()
    })
    .catch((err: any) => {
      console.log(err)
      setAllStatus(err.message)
      window.app_event.error()
      if (appSetting['player.autoSkipOnError']) addDelayNextTimeout()
    })
    .finally(() => {
      if (musicInfo === playMusicInfo.musicInfo) {
        gettingUrlId = ''
        clearLoadTimeout()
      }
    })
}

/**
 * 预加载下一首歌曲的URL (双Audio无缝切换核心)
 */
const preloadNextMusicUrl = async () => {
  try {
    const nextPlayInfo = await getNextPlayMusicInfo()
    if (!nextPlayInfo || !nextPlayInfo.musicInfo) {
      console.log('No next music to preload')
      return
    }

    const nextMusicInfo = nextPlayInfo.musicInfo
    // 处理 ListItem 类型
    const musicName =
      'progress' in nextMusicInfo ? nextMusicInfo.metadata.musicInfo.name : nextMusicInfo.name
    const musicSinger =
      'progress' in nextMusicInfo ? nextMusicInfo.metadata.musicInfo.singer : nextMusicInfo.singer
    console.log(`🎵 Preloading next music: ${musicName} - ${musicSinger}`)

    // 关键修复使用 isRefresh=true 获取新鲜URL，避免预加载URL过期
    const url = await getMusicPlayUrl(nextMusicInfo, true, false, true)
    if (!url) {
      console.warn('❌ Failed to get URL for next music')
      return
    }

    console.log(`🔗 Got preload URL: ${url.substring(0, 50)}...`)

    // 检查当前播放是否已经改变 (避免过时的预加载)
    if (nextPlayInfo.musicInfo.id !== (await getNextPlayMusicInfo())?.musicInfo?.id) {
      console.log('⚠️ Current playing changed, cancel preload')
      return
    }

    // 预加载到下一个audio元素
    preloadNextMusic(url)
    console.log(`✅ Next music preloaded successfully to backup audio`)
  } catch (err) {
    console.error('❌ Failed to preload next music:', err)
  }
}

// 加载歌词和封面
const loadLyricAndPic = (musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, listId: string | null) => {
  void getPicPath({ musicInfo, listId: listId || '' })
    .then((url: string) => {
      if (musicInfo.id != playMusicInfo.musicInfo?.id || url == _musicInfo.pic) return
      setMusicInfo({ pic: url })
      window.app_event.picUpdated()
    })
    .catch((_) => _)

  void getLyricInfo({ musicInfo })
    .then((lyricInfo) => {
      if (musicInfo.id != playMusicInfo.musicInfo?.id) return
      setMusicInfo({
        lrc: lyricInfo.lyric,
        tlrc: lyricInfo.tlyric,
        lxlrc: lyricInfo.lxlyric,
        rlrc: lyricInfo.rlyric,
        rawlrc: lyricInfo.rawlrcInfo.lyric,
      })
      window.app_event.lyricUpdated()
    })
    .catch((err) => {
      console.log(err)
      if (musicInfo.id != playMusicInfo.musicInfo?.id) return
      setAllStatus(window.i18n.t('lyric__load_error'))
    })
}

// 恢复上次播放的状态
const handleRestorePlay = async (restorePlayInfo: LX.Player.SavedPlayInfo) => {
  const musicInfo = playMusicInfo.musicInfo
  if (!musicInfo) return

  setImmediate(() => {
    if (musicInfo.id != playMusicInfo.musicInfo?.id) return
    window.app_event.setProgress(
      appSetting['player.isSavePlayTime'] ? restorePlayInfo.time : 0,
      restorePlayInfo.maxTime
    )
    window.app_event.pause()
  })

  // 加载歌词和封面
  loadLyricAndPic(musicInfo, playMusicInfo.listId)

  if (appSetting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay)
    addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })
}

// 处理音乐播放
const handlePlay = () => {
  window.lx.isPlayedStop &&= false

  resetRandomNextMusicInfo()
  if (window.lx.restorePlayInfo) {
    void handleRestorePlay(window.lx.restorePlayInfo)
    window.lx.restorePlayInfo = null
    return
  }
  const musicInfo = playMusicInfo.musicInfo

  if (!musicInfo) return

  // 关键修复立即停止所有audio避免重叠
  setPause()  // 先暂停当前audio
  clearNextAudio()  // 清空并暂停下一个audio的预加载
  setStop()  // 清空当前audio的src
  window.app_event.pause()

  clearDelayNextTimeout()
  clearLoadTimeout()

  if (appSetting['player.togglePlayMethod'] == 'random' && !playMusicInfo.isTempPlay)
    addPlayedList({ ...(playMusicInfo as LX.Player.PlayMusicInfo) })

  setMusicUrl(musicInfo)

  // 加载歌词和封面
  loadLyricAndPic(musicInfo, playMusicInfo.listId)

  // 预加载已移至 setMusicUrl 成功回调中 (避免时序问题)
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param id 歌曲id
 */
export const playListById = (listId: string, id: string) => {
  const prevListId = playInfo.playerListId
  setPlayListId(listId)
  // pause()
  const musicInfo = getList(listId).find(m => m.id == id)
  if (!musicInfo) return
  setPlayMusicInfo(listId, musicInfo)
  if (appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

/**
 * 播放列表内歌曲
 * @param listId 列表id
 * @param index 播放的歌曲位置
 */
export const playList = (listId: string, index: number) => {
  const prevListId = playInfo.playerListId
  setPlayListId(listId)
  // pause()
  setPlayMusicInfo(listId, getList(listId)[index])
  if (appSetting['player.isAutoCleanPlayedList'] || prevListId != listId) clearPlayedList()
  clearTempPlayeList()
  handlePlay()
}

const handleToggleStop = () => {
  stop()
  setTimeout(() => {
    setPlayMusicInfo(null, null)
  })
}

const randomNextMusicInfo = {
  info: null as LX.Player.PlayMusicInfo | null,
  // index: -1,
}
export const resetRandomNextMusicInfo = () => {
  if (randomNextMusicInfo.info) {
    randomNextMusicInfo.info = null
    // randomNextMusicInfo.index = -1
  }
}

export const getNextPlayMusicInfo = async (): Promise<LX.Player.PlayMusicInfo | null> => {
  if (tempPlayList.length) {
    // 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    const playMusicInfo = tempPlayList[0]
    return playMusicInfo
  }

  if (playMusicInfo.musicInfo == null) return null

  if (randomNextMusicInfo.info) return randomNextMusicInfo.info

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) return null
  const currentList = getList(currentListId)

  if (playedList.length) {
    // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (
      index = playedList.findIndex((m) => m.musicInfo.id === currentId) + 1;
      index < playedList.length;
      index++
    ) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some((m) => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) return playedList[index]
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({
    // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) return null
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = appSetting['player.togglePlayMethod']
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      return null
  }
  if (nextIndex < 0) return null

  const nextPlayMusicInfo = {
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }

  if (togglePlayMethod == 'random') {
    randomNextMusicInfo.info = nextPlayMusicInfo
    // randomNextMusicInfo.index = nextIndex
  }
  return nextPlayMusicInfo
}

const handlePlayNext = (playMusicInfo: LX.Player.PlayMusicInfo, allowSeamlessSwitch = false) => {
  // 只在自动播放下一首时尝试无缝切换
  if (allowSeamlessSwitch) {
    const switched = switchToNextAudio()

    if (switched) {
      // 无缝切换成功,只需更新播放信息
      console.log('✅ Seamless switch successful (auto-play next)')
      setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)

      // 关键修复清除旧的加载状态文本（双audio切换不会触发setMusicUrl）
      setAllStatus('')

      // 关键修复手动触发playerLoadeddata事件更新duration
      // 因为切换到的audio的loadeddata事件在预加载时被过滤了
      window.app_event.playerLoadeddata()

      // 加载歌词和封面
      const musicInfo = playMusicInfo.musicInfo
      void getPicPath({ musicInfo, listId: playMusicInfo.listId })
        .then((url: string) => {
          if (musicInfo.id != playMusicInfo.musicInfo?.id || url == _musicInfo.pic) return
          setMusicInfo({ pic: url })
          window.app_event.picUpdated()
        })
        .catch((_) => _)

      void getLyricInfo({ musicInfo })
        .then((lyricInfo) => {
          if (musicInfo.id != playMusicInfo.musicInfo?.id) return
          setMusicInfo({
            lrc: lyricInfo.lyric,
            tlrc: lyricInfo.tlyric,
            lxlrc: lyricInfo.lxlyric,
            rlrc: lyricInfo.rlyric,
            rawlrc: lyricInfo.rawlrcInfo.lyric,
          })
          window.app_event.lyricUpdated()
        })
        .catch((err) => {
          console.log(err)
          if (musicInfo.id != playMusicInfo.musicInfo?.id) return
          setAllStatus(window.i18n.t('lyric__load_error'))
        })

      // 继续预加载下一首
      void preloadNextMusicUrl()
      return
    }
  }

  // 手动切歌或无缝切换失败 - 使用传统方式
  console.log(allowSeamlessSwitch ? '⚠️ Seamless switch failed, fallback to traditional' : '📍 Manual switch - using traditional play method')
  setPlayMusicInfo(playMusicInfo.listId, playMusicInfo.musicInfo, playMusicInfo.isTempPlay)
  handlePlay()
}
/**
 * 下一曲
 * @param isAutoToggle 是否自动切换
 * @returns
 */
export const playNext = async (isAutoToggle = false): Promise<void> => {
  console.log('skip next', isAutoToggle)
  if (tempPlayList.length) {
    // 修复 如果稍后播放列表存在歌曲则直接播放改列表的歌曲
    // 当添加稍后播放时已经预加载了第一首稍后播放歌曲，所以可以使用无缝切换
    const playMusicInfo = tempPlayList[0]
    removeTempPlayList(0)

    // 修复 支持无缝切换，因为在addTempPlayList时已经预加载了正确的歌曲
    handlePlayNext(playMusicInfo, isAutoToggle)
    console.log('play temp list')
    return
  }

  if (playMusicInfo.musicInfo == null) {
    handleToggleStop()
    console.log(playMusicInfo.musicInfo)
    console.log('musicInfo empty')
    return
  }

  // console.log(playInfo.playerListId)
  const currentListId = playInfo.playerListId
  if (!currentListId) {
    handleToggleStop()
    console.log('currentListId empty')
    return
  }
  const currentList = getList(currentListId)

  if (playedList.length) {
    // 移除已播放列表内不存在原列表的歌曲
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (
      index = playedList.findIndex((m) => m.musicInfo.id === currentId) + 1;
      index < playedList.length;
      index++
    ) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some((m) => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index < playedList.length) {
      handlePlayNext(playedList[index], isAutoToggle)
      console.log('play played list')
      return
    }
  }
  if (randomNextMusicInfo.info) {
    handlePlayNext(randomNextMusicInfo.info, isAutoToggle)
    return
  }
  // const isCheckFile = findNum > 2 // 针对下载列表，如果超过两次都碰到无效歌曲，则过滤整个列表内的无效歌曲
  let { filteredList, playerIndex } = await filterList({
    // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: true,
  })

  if (!filteredList.length) {
    handleToggleStop()
    console.log('filtered list empty')
    return
  }
  // let currentIndex: number = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex

  let togglePlayMethod = appSetting['player.togglePlayMethod']
  if (!isAutoToggle) {
    switch (togglePlayMethod) {
      case 'list':
      case 'singleLoop':
      case 'none':
        togglePlayMethod = 'listLoop'
    }
  }
  switch (togglePlayMethod) {
    case 'listLoop':
      nextIndex = playerIndex === filteredList.length - 1 ? 0 : playerIndex + 1
      break
    case 'random':
      nextIndex = getRandom(0, filteredList.length)
      break
    case 'list':
      nextIndex = playerIndex === filteredList.length - 1 ? -1 : playerIndex + 1
      break
    case 'singleLoop':
      break
    default:
      nextIndex = -1
      console.log('stop toggle play', togglePlayMethod, isAutoToggle)
      return
  }
  if (nextIndex < 0) {
    console.log('next index empty')
    return
  }

  handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }, isAutoToggle)
}

/**
 * 上一曲
 */
export const playPrev = async (isAutoToggle = false): Promise<void> => {
  if (playMusicInfo.musicInfo == null) {
    handleToggleStop()
    return
  }

  const currentListId = playInfo.playerListId
  if (!currentListId) {
    handleToggleStop()
    return
  }
  const currentList = getList(currentListId)

  if (playedList.length) {
    let currentId: string
    if (playMusicInfo.isTempPlay) {
      const musicInfo = currentList[playInfo.playerPlayIndex]
      if (musicInfo) currentId = musicInfo.id
    } else {
      currentId = playMusicInfo.musicInfo.id
    }
    // 从已播放列表移除播放列表已删除的歌曲
    let index
    for (
      index = playedList.findIndex((m) => m.musicInfo.id === currentId) - 1;
      index > -1;
      index--
    ) {
      const playMusicInfo = playedList[index]
      const currentId = playMusicInfo.musicInfo.id
      if (playMusicInfo.listId == currentListId && !currentList.some((m) => m.id === currentId)) {
        removePlayedList(index)
        continue
      }
      break
    }

    if (index > -1) {
      handlePlayNext(playedList[index], false)  // 上一首不使用无缝切换
      return
    }
  }

  // const isCheckFile = findNum > 2
  let { filteredList, playerIndex } = await filterList({
    // 过滤已播放歌曲
    listId: currentListId,
    list: currentList,
    playedList,
    playerMusicInfo: currentList[playInfo.playerPlayIndex],
    isNext: false,
  })
  if (!filteredList.length) {
    handleToggleStop()
    return
  }

  // let currentIndex = filteredList.indexOf(currentList[playInfo.playerPlayIndex])
  if (playerIndex == -1 && filteredList.length) playerIndex = 0
  let nextIndex = playerIndex
  if (!playMusicInfo.isTempPlay) {
    let togglePlayMethod = appSetting['player.togglePlayMethod']
    if (!isAutoToggle) {
      switch (togglePlayMethod) {
        case 'list':
        case 'singleLoop':
        case 'none':
          togglePlayMethod = 'listLoop'
      }
    }
    switch (togglePlayMethod) {
      case 'random':
        nextIndex = getRandom(0, filteredList.length)
        break
      case 'listLoop':
      case 'list':
        nextIndex = playerIndex === 0 ? filteredList.length - 1 : playerIndex - 1
        break
      case 'singleLoop':
        break
      default:
        nextIndex = -1
        return
    }
    if (nextIndex < 0) return
  }

  handlePlayNext({
    musicInfo: filteredList[nextIndex],
    listId: currentListId,
    isTempPlay: false,
  }, false)  // 上一首不使用无缝切换
}

/**
 * 恢复播放
 */
export const play = () => {
  if (playMusicInfo.musicInfo == null) return
  if (isEmpty()) {
    if (createGettingUrlId(playMusicInfo.musicInfo) != gettingUrlId)
      setMusicUrl(playMusicInfo.musicInfo)
    return
  }
  setPlay()
}

/**
 * 暂停播放
 */
export const pause = () => {
  setPause()
}

/**
 * 停止播放
 */
export const stop = () => {
  setStop()
  setTimeout(() => {
    window.app_event.stop()
  })
}

/**
 * 播放、暂停播放切换
 */
export const togglePlay = () => {
  window.lx.isPlayedStop &&= false
  if (isPlay.value) {
    pause()
  } else {
    play()
  }
}

/**
 * 收藏当前播放的歌曲
 */
export const collectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void addListMusics(loveList.id, [
    'progress' in playMusicInfo.musicInfo
      ? playMusicInfo.musicInfo.metadata.musicInfo
      : playMusicInfo.musicInfo,
  ])
}

/**
 * 取消收藏当前播放的歌曲
 */
export const uncollectMusic = () => {
  if (!playMusicInfo.musicInfo) return
  void removeListMusics({
    listId: loveList.id,
    ids: [
      'progress' in playMusicInfo.musicInfo
        ? playMusicInfo.musicInfo.metadata.musicInfo.id
        : playMusicInfo.musicInfo.id,
    ],
  })
}

/**
 * 不喜欢当前播放的歌曲
 */
export const dislikeMusic = async () => {
  if (!playMusicInfo.musicInfo) return
  const minfo =
    'progress' in playMusicInfo.musicInfo
      ? playMusicInfo.musicInfo.metadata.musicInfo
      : playMusicInfo.musicInfo
  await addDislikeInfo([{ name: minfo.name, singer: minfo.singer }])
  await playNext(true)
}
