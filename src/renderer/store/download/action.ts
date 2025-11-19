import {
  downloadTasksGet,
  // downloadListClear,
  downloadTasksCreate,
  downloadTasksRemove,
  downloadTasksUpdate,
} from '@renderer/utils/ipc'
import { downloadList } from './state'
import { markRaw, toRaw } from '@common/utils/vueTools'
import { getMusicUrl, getPicUrl, getLyricInfo } from '@renderer/core/music/online'
import { appSetting } from '../setting'
import { qualityList } from '..'
import { proxyCallback } from '@renderer/worker/utils'
import { arrPush, arrUnshift, joinPath } from '@renderer/utils'
import { DOWNLOAD_STATUS } from '@common/constants'
import { proxy } from '../index'
import { buildSavePath } from './utils'
import {
  QUALITY_ORDER as _QUALITY_ORDER,
  getFallbackQualities as _getFallbackQualities,
} from '@common/utils/downloadQuality'
import { checkPath, removeFile } from '@common/utils/nodejs'
import { dialog } from '@renderer/plugins/Dialog'

// 从共享模块重新导出，避免循环依赖
// 原函数已移至 @common/utils/downloadQuality.ts
export { QUALITY_ORDER, getFallbackQualities } from '@common/utils/downloadQuality'

// 内部使用别名导入
const QUALITY_ORDER = _QUALITY_ORDER
const getFallbackQualities = _getFallbackQualities

const waitingUpdateTasks = new Map<string, LX.Download.ListItem>()
let timer: NodeJS.Timeout | null = null
const throttleUpdateTask = (tasks: LX.Download.ListItem[]) => {
  for (const task of tasks) waitingUpdateTasks.set(task.id, toRaw(task))
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    void downloadTasksUpdate(Array.from(waitingUpdateTasks.values()))
    waitingUpdateTasks.clear()
  }, 100)
}

const runingTask = new Map<string, LX.Download.ListItem>()

// const initDownloadList = (list: LX.Download.ListItem[]) => {
//   downloadList.splice(0, downloadList.length, ...list)
// }

export const getDownloadList = async (): Promise<LX.Download.ListItem[]> => {
  if (!downloadList.length) {
    const list = await downloadTasksGet()
    for (const downloadInfo of list) {
      markRaw(downloadInfo.metadata)
      switch (downloadInfo.status) {
        case DOWNLOAD_STATUS.RUN:
        case DOWNLOAD_STATUS.WAITING:
          downloadInfo.status = DOWNLOAD_STATUS.PAUSE
          downloadInfo.statusText = window.i18n.t('download___status_paused')
        default:
          break
      }
    }
    arrPush(downloadList, list)
  }
  return downloadList
}

const addTasks = async (list: LX.Download.ListItem[]) => {
  const addMusicLocationType = appSetting['list.addMusicLocationType']

  await downloadTasksCreate(
    list.map((i) => toRaw(i)),
    addMusicLocationType
  )

  if (addMusicLocationType === 'top') {
    arrUnshift(downloadList, list)
  } else {
    arrPush(downloadList, list)
  }
  window.app_event.downloadListUpdate()
}

const setStatusText = (downloadInfo: LX.Download.ListItem, text: string) => {
  // 设置状态文本
  downloadInfo.statusText = text
  throttleUpdateTask([downloadInfo])
}

const setUrl = (downloadInfo: LX.Download.ListItem, url: string) => {
  downloadInfo.metadata.url = url
  throttleUpdateTask([downloadInfo])
}

const updateFilePath = (downloadInfo: LX.Download.ListItem, filePath: string) => {
  downloadInfo.metadata.filePath = filePath
  throttleUpdateTask([downloadInfo])
}

const setProgress = (downloadInfo: LX.Download.ListItem, progress: LX.Download.ProgressInfo) => {
  downloadInfo.total = progress.total
  downloadInfo.downloaded = progress.downloaded
  downloadInfo.writeQueue = progress.writeQueue
  if (progress.progress == 100) {
    downloadInfo.speed = ''
    downloadInfo.progress = 99.99
    setStatusText(
      downloadInfo,
      window.i18n.t('download_status_write_queue', { num: progress.writeQueue })
    )
  } else {
    downloadInfo.speed = progress.speed
    downloadInfo.progress = progress.progress
  }
  throttleUpdateTask([downloadInfo])
}

const setStatus = (
  downloadInfo: LX.Download.ListItem,
  status: LX.Download.DownloadTaskStatus,
  statusText?: string
) => {
  // 设置状态及状态文本
  if (statusText == null) {
    switch (status) {
      case DOWNLOAD_STATUS.RUN:
        statusText = window.i18n.t('download___status_running')
        break
      case DOWNLOAD_STATUS.WAITING:
        statusText = window.i18n.t('download___status_waiting')
        break
      case DOWNLOAD_STATUS.PAUSE:
        statusText = window.i18n.t('download___status_paused')
        break
      case DOWNLOAD_STATUS.ERROR:
        statusText = window.i18n.t('download___status_error')
        break
      case DOWNLOAD_STATUS.COMPLETED:
        statusText = window.i18n.t('download___status_completed')
        break
      default:
        statusText = ''
        break
    }
  }

  if (downloadInfo.statusText == statusText && downloadInfo.status == status) return

  if (status == DOWNLOAD_STATUS.COMPLETED) downloadInfo.isComplate = true
  downloadInfo.statusText = statusText
  downloadInfo.status = status
  throttleUpdateTask([downloadInfo])
}

// 修复 1.1.x版本 酷狗源歌词格式
const fixKgLyric = (lrc: string) =>
  /\[00:\d\d:\d\d.\d+\]/.test(lrc) ? lrc.replace(/(?:\[00:(\d\d:\d\d.\d+\]))/gm, '[$1') : lrc

const getProxy = () => {
  return proxy.enable && proxy.host
    ? {
        host: proxy.host,
        port: parseInt(proxy.port || '80'),
      }
    : proxy.envProxy
      ? {
          host: proxy.envProxy.host,
          port: parseInt(proxy.envProxy.port || '80'),
        }
      : undefined
}
/**
 * 设置歌曲meta信息
 * @param downloadInfo 下载任务信息
 */
const saveMeta = (downloadInfo: LX.Download.ListItem) => {
  const isUseOtherSource = appSetting['download.isUseOtherSource']
  const tasks: [Promise<string | null>, Promise<LX.Player.LyricInfo | null>] = [
    appSetting['download.isEmbedPic']
      ? downloadInfo.metadata.musicInfo.meta.picUrl
        ? Promise.resolve(downloadInfo.metadata.musicInfo.meta.picUrl)
        : getPicUrl({
            musicInfo: downloadInfo.metadata.musicInfo,
            isRefresh: false,
            allowToggleSource: isUseOtherSource,
          }).catch((err) => {
            console.log(err)
            return null
          })
      : Promise.resolve(null),
    appSetting['download.isEmbedLyric']
      ? getLyricInfo({
          musicInfo: downloadInfo.metadata.musicInfo,
          isRefresh: false,
          allowToggleSource: isUseOtherSource,
        }).catch((err) => {
          console.log(err)
          return null
        })
      : Promise.resolve(null),
  ]
  void Promise.all(tasks).then(([imgUrl, lyrics]) => {
    const info = {
      filePath: downloadInfo.metadata.filePath,
      isEmbedLyricLx: appSetting['download.isEmbedLyricLx'],
      isEmbedLyricT: appSetting['download.isEmbedLyricT'],
      isEmbedLyricR: appSetting['download.isEmbedLyricR'],
      title: downloadInfo.metadata.musicInfo.name,
      artist: downloadInfo.metadata.musicInfo.singer?.replaceAll('、', ';'),
      album: downloadInfo.metadata.musicInfo.meta.albumName,
      APIC: imgUrl,
    }
    void window.lx.worker.download.writeMeta(info, lyrics ?? { lyric: '' }, getProxy())
  })
}

/**
 * 保存歌词文件
 * @param downloadInfo 下载任务信息
 */
const downloadLyric = (downloadInfo: LX.Download.ListItem) => {
  if (!appSetting['download.isDownloadLrc']) return
  void getLyricInfo({
    musicInfo: downloadInfo.metadata.musicInfo,
    isRefresh: false,
    allowToggleSource: appSetting['download.isUseOtherSource'],
  }).then((lrcs) => {
    if (lrcs.lyric) {
      lrcs.lyric = fixKgLyric(lrcs.lyric)
      const info = {
        filePath: downloadInfo.metadata.filePath.substring(0, downloadInfo.metadata.filePath.lastIndexOf('.')) + '.lrc',
        format: appSetting['download.lrcFormat'],
        downloadLxlrc: appSetting['download.isDownloadLxLrc'],
        downloadTlrc: appSetting['download.isDownloadTLrc'],
        downloadRlrc: appSetting['download.isDownloadRLrc'],
      }
      void window.lx.worker.download.saveLrc(lrcs, info)
    }
  })
}

const getUrl = async (downloadInfo: LX.Download.ListItem, isRefresh: boolean = false) => {
  let toggleMusicInfo = downloadInfo.metadata.musicInfo.meta.toggleMusicInfo
  const requestedQuality = downloadInfo.metadata.quality

  // 尝试使用原始请求的音质
  const tryWithQuality = async (quality: LX.Quality): Promise<string> => {
    return (
      toggleMusicInfo
        ? getMusicUrl({
            musicInfo: toggleMusicInfo,
            isRefresh,
            quality,
            allowToggleSource: false,
          })
        : Promise.reject(new Error('not found'))
    )
      .catch(() => {
        return getMusicUrl({
          musicInfo: downloadInfo.metadata.musicInfo,
          isRefresh: false,
          quality,
          allowToggleSource: appSetting['download.isUseOtherSource'],
        })
      })
  }

  try {
    // 首先尝试请求的音质
    return await tryWithQuality(requestedQuality)
  } catch (error) {
    // 获取可用音质列表
    const musicInfo = toggleMusicInfo || downloadInfo.metadata.musicInfo
    const availableQualities = qualityList.value[musicInfo.source] || []

    // 如果音乐信息中有 _qualitys 字段，使用它来过滤可用音质
    if (musicInfo.meta._qualitys) {
      const musicAvailableQualities = Object.keys(musicInfo.meta._qualitys)
        .filter(q => musicInfo.meta._qualitys[q as LX.Quality]) as LX.Quality[]
      const filteredQualities = availableQualities.filter(q => musicAvailableQualities.includes(q))

      // 根据策略获取备选音质列表
      const fallbackStrategy = appSetting['download.qualityFallbackStrategy'] as 'downgrade' | 'upgrade' | 'max' | 'min'
      const fallbackQualities = getFallbackQualities(requestedQuality, filteredQualities, fallbackStrategy)

      // 逐个尝试备选音质
      for (const fallbackQuality of fallbackQualities) {
        try {
          const url = await tryWithQuality(fallbackQuality)
          if (url) {
            // 更新下载任务的音质为实际使用的音质
            downloadInfo.metadata.quality = fallbackQuality

            // 添加音质变更提示
            if (fallbackQuality !== requestedQuality) {
              setStatusText(downloadInfo,
                window.i18n.t('download_quality_fallback_notice', {
                  requested: requestedQuality,
                  actual: fallbackQuality
                })
              )
            }

            return url
          }
        } catch (err) {
          // 继续尝试下一个音质
          continue
        }
      }
    }

    // 所有音质都失败，返回空字符串
    return ''
  }
}
const handleRefreshUrl = (downloadInfo: LX.Download.ListItem) => {
  setStatusText(downloadInfo, window.i18n.t('download_status_error_refresh_url'))
  let toggleMusicInfo = downloadInfo.metadata.musicInfo.meta.toggleMusicInfo
  ;(toggleMusicInfo
    ? getMusicUrl({
        musicInfo: toggleMusicInfo,
        isRefresh: true,
        quality: downloadInfo.metadata.quality,
        allowToggleSource: false,
      })
    : Promise.reject(new Error('not found'))
  )
    .catch(() => {
      return getMusicUrl({
        musicInfo: downloadInfo.metadata.musicInfo,
        isRefresh: true,
        quality: downloadInfo.metadata.quality,
        allowToggleSource: appSetting['download.isUseOtherSource'],
      })
    })
    .catch(() => '')
    .then((url) => {
      // commit('setStatusText', { downloadInfo, text: '链接刷新成功' })
      setUrl(downloadInfo, url)
      void window.lx.worker.download.updateUrl(downloadInfo.id, url)
    })
    .catch((err) => {
      console.log(err)
      handleError(downloadInfo, err.message)
    })
}
const handleError = (downloadInfo: LX.Download.ListItem, message?: string) => {
  setStatus(downloadInfo, DOWNLOAD_STATUS.ERROR, message)
  void window.lx.worker.download.removeTask(downloadInfo.id)
  runingTask.delete(downloadInfo.id)
  void checkStartTask()
}

const handleStartTask = async (downloadInfo: LX.Download.ListItem) => {
  if (!downloadInfo.metadata.url) {
    setStatusText(downloadInfo, window.i18n.t('download_status_url_getting'))
    const url = await getUrl(downloadInfo)
    if (!url) {
      handleError(downloadInfo, window.i18n.t('download_status_error_url_failed'))
      return
    }
    setUrl(downloadInfo, url)
    if (downloadInfo.status != DOWNLOAD_STATUS.RUN) return
  }

  const savePath = buildSavePath(downloadInfo)
  const filePath = joinPath(savePath, downloadInfo.metadata.fileName)
  if (downloadInfo.metadata.filePath != filePath) updateFilePath(downloadInfo, filePath)

  setStatusText(downloadInfo, window.i18n.t('download_status_start'))

  await window.lx.worker.download.startTask(
    toRaw(downloadInfo),
    savePath,
    appSetting['download.skipExistFile'],
    proxyCallback((event: LX.Download.DownloadTaskActions) => {
      // console.log(event)
      switch (event.action) {
        case 'start':
          setStatus(downloadInfo, DOWNLOAD_STATUS.RUN)
          break
        case 'complete':
          downloadInfo.progress = 100
          saveMeta(downloadInfo)
          downloadLyric(downloadInfo)
          void window.lx.worker.download.removeTask(downloadInfo.id)
          runingTask.delete(downloadInfo.id)
          setStatus(downloadInfo, DOWNLOAD_STATUS.COMPLETED)
          void checkStartTask()
          break
        case 'refreshUrl':
          handleRefreshUrl(downloadInfo)
          break
        case 'statusText':
          setStatusText(downloadInfo, event.data)
          break
        case 'progress':
          setProgress(downloadInfo, event.data)
          break
        case 'error':
          handleError(
            downloadInfo,
            event.data.error
              ? window.i18n.t(event.data.error) + (event.data.message ?? '')
              : event.data.message
          )
          break
        default:
          break
      }
    }),
    getProxy()
  )
}
const startTask = async (downloadInfo: LX.Download.ListItem) => {
  setStatus(downloadInfo, DOWNLOAD_STATUS.RUN)
  runingTask.set(downloadInfo.id, downloadInfo)
  void handleStartTask(downloadInfo)
}

const getStartTask = (list: LX.Download.ListItem[]): LX.Download.ListItem | null => {
  let downloadCount = 0
  const waitList = list.filter((item) => {
    if (item.status == DOWNLOAD_STATUS.WAITING) return true
    if (item.status == DOWNLOAD_STATUS.RUN) ++downloadCount
    return false
  })
  // console.log(downloadCount, waitList)
  return downloadCount < appSetting['download.maxDownloadNum'] ? (waitList.shift() ?? null) : null
}

const checkStartTask = async () => {
  if (runingTask.size >= appSetting['download.maxDownloadNum']) return
  let result = getStartTask(downloadList)
  // console.log(result)
  while (result) {
    await startTask(result)
    result = getStartTask(downloadList)
  }
}

/**
 * 过滤重复任务
 * @param list
 */
const filterTask = (list: LX.Download.ListItem[]) => {
  const set = new Set<string>()
  for (const item of downloadList) set.add(item.id)
  return list.filter((item) => {
    if (set.has(item.id)) return false
    markRaw(item.metadata)
    set.add(item.id)
    return true
  })
}

/**
 * 处理已存在的下载任务
 * 检查文件状态并询问用户是否重新下载
 * @param task 已存在的下载任务
 * @returns Promise<boolean> - 是否需要重新下载（删除旧任务）
 */
const handleExistingTask = async (task: LX.Download.ListItem): Promise<boolean> => {
  console.log(`[handleExistingTask] Checking task ${task.id}`)
  console.log(`[handleExistingTask] Task status: ${task.status}, isComplate: ${task.isComplate}`)

  // 如果任务正在运行，不允许重新下载
  if (task.status === DOWNLOAD_STATUS.RUN || task.status === DOWNLOAD_STATUS.WAITING) {
    console.log(`[handleExistingTask] Task ${task.id} is running/waiting, cannot re-download`)
    return false
  }

  // 如果任务已完成，检查文件是否存在
  if (task.isComplate) {
    const savePath = buildSavePath(task)
    const filePath = task.metadata.filePath || joinPath(savePath, task.metadata.fileName)

    // 检查文件是否存在
    const fileExists = await checkPath(filePath)

    // 如果文件不存在，自动重新下载（不需要询问用户）
    if (!fileExists) {
      console.log(`[handleExistingTask] File missing for task ${task.id}, will auto re-download`)
      return true
    }

    // 文件存在，显示确认对话框询问用户
    const i18n = window.i18n
    const musicName = `${task.metadata.musicInfo.name} - ${task.metadata.musicInfo.singer}`
    const message = i18n.t('download__file_exists_message')
    const title = i18n.t('download__file_exists_title')

    const shouldRedownload = await dialog.confirm({
      message: `${title}\n\n${musicName}\n\n${message}`,
      confirmButtonText: i18n.t('confirm_button_text'),
      cancelButtonText: i18n.t('cancel_button_text_2')
    })

    if (!shouldRedownload) {
      console.log(`[handleExistingTask] User cancelled re-download for task ${task.id}`)
      return false
    }

    // 用户确认重新下载，删除旧文件
    console.log(`[handleExistingTask] User confirmed re-download for task ${task.id}`)
    try {
      await removeFile(filePath)
      console.log(`[handleExistingTask] Successfully deleted existing file: ${filePath}`)
      return true
    } catch (error) {
      console.error(`[handleExistingTask] Failed to delete file ${filePath}:`, error)
      void dialog({
        message: i18n.t('download__file_delete_failed') || 'Failed to delete existing file. Please check file permissions.',
        confirmButtonText: i18n.t('confirm_button_text')
      })
      return false
    }
  }

  // 任务未完成（暂停、错误等状态），询问用户是否重新开始
  const i18n = window.i18n
  const musicName = `${task.metadata.musicInfo.name} - ${task.metadata.musicInfo.singer}`

  const shouldRedownload = await dialog.confirm({
    message: `${musicName}\n\n${i18n.t('download__task_exists_restart') || '该任务已存在但未完成，是否重新开始下载？'}`,
    confirmButtonText: i18n.t('confirm_button_text'),
    cancelButtonText: i18n.t('cancel_button_text_2')
  })

  console.log(`[handleExistingTask] User ${shouldRedownload ? 'confirmed' : 'cancelled'} restart for incomplete task ${task.id}`)
  return shouldRedownload
}

/**
 * 创建下载任务
 * @param list 要下载的歌曲
 * @param quality 下载音质
 */
export const createDownloadTasks = async (
  list: LX.Music.MusicInfoOnline[],
  quality: LX.Quality,
  listId?: string
) => {
  console.log('[action] createDownloadTasks called with:', { list, quality, listId })
  if (!list.length) {
    console.log('[action] No items in list, returning early')
    return
  }

  // CRITICAL: Ensure downloadList is loaded from database before checking for existing tasks
  if (downloadList.length === 0) {
    console.log('[action] downloadList is empty, loading from database...')
    await getDownloadList()
    console.log(`[action] Loaded ${downloadList.length} tasks from database`)
  }
  const fallbackStrategy = appSetting['download.qualityFallbackStrategy'] as 'downgrade' | 'upgrade' | 'max' | 'min'
  console.log('[action] Calling worker.download.createDownloadTasks with:', {
    listLength: list.length,
    quality,
    fileName: appSetting['download.fileName'],
    qualityList: toRaw(qualityList.value),
    listId,
    fallbackStrategy
  })

  try {
    const workerResult = await window.lx.worker.download.createDownloadTasks(
      list,
      quality,
      appSetting['download.fileName'],
      toRaw(qualityList.value),
      listId,
      fallbackStrategy
    )
    console.log('[action] Worker result:', workerResult)

    // Process tasks one by one to handle re-downloads properly
    const tasksToAdd: LX.Download.ListItem[] = []
    const processedIds = new Set<string>()

    for (const task of workerResult) {
      markRaw(task.metadata)

      // Skip if we've already processed this ID in this batch
      if (processedIds.has(task.id)) {
        console.log(`Task ${task.id} already processed in this batch, skipping duplicate`)
        continue
      }
      processedIds.add(task.id)

      // Check if task exists NOW (not using cached set)
      const existingTask = downloadList.find(item => item.id === task.id)

      if (existingTask) {
        // Task already exists - check if we should re-download
        const shouldRedownload = await handleExistingTask(existingTask)
        if (shouldRedownload) {
          // Remove the old task immediately
          console.log(`[RE-DOWNLOAD] Removing old task ${task.id}...`)
          console.log(`[RE-DOWNLOAD] downloadList length before removal: ${downloadList.length}`)

          await removeDownloadTasks([task.id])

          console.log(`[RE-DOWNLOAD] downloadList length after removal: ${downloadList.length}`)

          // CRITICAL: Wait for database operation to complete
          // The removeDownloadTasks updates memory immediately but DB operation may be async
          // Increased delay to 200ms to be safer
          console.log(`[RE-DOWNLOAD] Waiting 200ms for DB sync...`)
          await new Promise(resolve => setTimeout(resolve, 200))

          console.log(`[RE-DOWNLOAD] Old task ${task.id} removed, will add new task`)

          // Add to list for adding
          tasksToAdd.push(task)
        } else {
          console.log(`Task ${task.id} skipped - user cancelled or already exists`)
        }
      } else {
        // New task - add it
        tasksToAdd.push(task)
        console.log(`New task ${task.id} will be added`)
      }
    }

    console.log('[action] Total tasks to add:', tasksToAdd.length)

    // Add all new tasks (including re-downloads)
    if (tasksToAdd.length > 0) {
      console.log('[action] Adding tasks...')
      console.log('[action] Task IDs to add:', tasksToAdd.map(t => t.id))

      // Final safety check: ensure none of these IDs exist in downloadList
      // This should not happen but is a final safeguard
      const currentIds = new Set(downloadList.map(item => item.id))
      const safeTasks = tasksToAdd.filter(task => {
        const exists = currentIds.has(task.id)
        if (exists) {
          console.error(`SAFETY CHECK FAILED: Task ${task.id} still exists in downloadList!`)
        }
        return !exists
      })

      if (safeTasks.length !== tasksToAdd.length) {
        console.error(`Filtered out ${tasksToAdd.length - safeTasks.length} duplicate tasks`)
      }

      if (safeTasks.length > 0) {
        await addTasks(safeTasks)
        console.log('[action] Tasks added successfully')
      } else {
        console.log('[action] No tasks to add after safety check')
      }
    }

    console.log('[action] Checking start task...')
    void checkStartTask()
  } catch (error) {
    console.error('[action] Error in createDownloadTasks:', error)
    throw error
  }
}

/**
 * 开始下载任务
 * @param list
 */
export const startDownloadTasks = async (list: LX.Download.ListItem[]) => {
  for (const downloadInfo of list) {
    switch (downloadInfo.status) {
      case DOWNLOAD_STATUS.PAUSE:
      case DOWNLOAD_STATUS.ERROR:
        if (runingTask.size < appSetting['download.maxDownloadNum']) void startTask(downloadInfo)
        else setStatus(downloadInfo, DOWNLOAD_STATUS.WAITING)
      default:
        break
    }
  }
  void checkStartTask()
}

/**
 * 暂停下载任务
 * @param list
 */
export const pauseDownloadTasks = async (list: LX.Download.ListItem[]) => {
  for (const downloadInfo of list) {
    switch (downloadInfo.status) {
      case DOWNLOAD_STATUS.RUN:
        void window.lx.worker.download.pauseTask(downloadInfo.id)
        runingTask.delete(downloadInfo.id)
      case DOWNLOAD_STATUS.WAITING:
      case DOWNLOAD_STATUS.ERROR:
        setStatus(downloadInfo, DOWNLOAD_STATUS.PAUSE)
      default:
        break
    }
  }
  void checkStartTask()
}

/**
 * 移除下载任务
 * @param ids 要移除的任务Id
 */
export const removeDownloadTasks = async (ids: string[]) => {
  await downloadTasksRemove(ids)

  const idsSet = new Set<string>(ids)
  const newList = downloadList.filter((task) => {
    if (runingTask.has(task.id)) {
      void window.lx.worker.download.removeTask(task.id)
      runingTask.delete(task.id)
    }
    return !idsSet.has(task.id)
  })
  downloadList.splice(0, downloadList.length)
  arrPush(downloadList, newList)

  void checkStartTask()
  window.app_event.downloadListUpdate()
}

/**
 * 取消所有正在运行和等待中的下载任务
 */
export const cancelAllDownloadTasks = async () => {
  const tasksToCancel = downloadList.filter(
    task => task.status === DOWNLOAD_STATUS.RUN || task.status === DOWNLOAD_STATUS.WAITING
  )

  if (tasksToCancel.length === 0) {
    return 0 // 返回取消的任务数量
  }

  await pauseDownloadTasks(tasksToCancel)
  return tasksToCancel.length
}

/**
 * 清空所有已完成、出错和暂停的下载任务
 */
export const clearCompletedDownloadTasks = async () => {
  const tasksToClear = downloadList.filter(
    task => task.status === DOWNLOAD_STATUS.COMPLETED ||
            task.status === DOWNLOAD_STATUS.ERROR ||
            task.status === DOWNLOAD_STATUS.PAUSE
  )

  if (tasksToClear.length === 0) {
    return 0
  }

  const ids = tasksToClear.map(task => task.id)
  await removeDownloadTasks(ids)
  return tasksToClear.length
}
