import { useRouter } from '@common/utils/vueRouter'
import musicSdk from '@renderer/utils/musicSdk'
import { openUrl } from '@common/utils/electron'
import { checkPath } from '@common/utils/nodejs'
// import { dialog } from '@renderer/plugins/Dialog'
// import { useI18n } from '@renderer/plugins/i18n'
// import { appSetting } from '@renderer/store/setting'
import { toOldMusicInfo } from '@renderer/utils/index'
import {
  startDownloadTasks,
  pauseDownloadTasks,
  removeDownloadTasks,
  cancelAllDownloadTasks,
  clearCompletedDownloadTasks,
} from '@renderer/store/download/action'
import { openDirInExplorer } from '@renderer/utils/ipc'
import { downloadStatus } from '@renderer/store/download/state'

export default ({ list, selectedList, removeAllSelect }) => {
  const router = useRouter()
  // const t = useI18n()

  const handleSearch = (index) => {
    const info = list.value[index].metadata.musicInfo
    router.push({
      path: '/search',
      query: {
        text: `${info.name} ${info.singer}`,
      },
    })
  }

  const handleOpenMusicDetail = (index) => {
    const task = list.value[index]
    const mInfo = toOldMusicInfo(task.metadata.musicInfo)
    const url = musicSdk[mInfo.source]?.getMusicDetailPageUrl?.(mInfo)
    if (!url) return
    openUrl(url)
  }

  const handleStartTask = async (index, single) => {
    if (selectedList.value.length && !single) {
      startDownloadTasks([...selectedList.value])
      removeAllSelect()
    } else {
      startDownloadTasks([list.value[index]])
    }
  }

  const handlePauseTask = async (index, single) => {
    if (selectedList.value.length && !single) {
      pauseDownloadTasks([...selectedList.value])
      removeAllSelect()
    } else {
      pauseDownloadTasks([list.value[index]])
    }
  }

  const handleRemoveTask = async (index, single) => {
    if (selectedList.value.length && !single) {
      // const confirm = await (selectedList.value.length > 1
      //   ? dialog.confirm({
      //     message: t('lists__remove_music_tip', { len: selectedList.value.length }),
      //     confirmButtonText: t('lists__remove_tip_button'),
      //   })
      //   : Promise.resolve(true)
      // )
      // if (!confirm) return
      removeDownloadTasks(selectedList.value.map((m) => m.id))
      removeAllSelect()
    } else {
      removeDownloadTasks([list.value[index].id])
    }
  }

  const handleOpenFile = async (index) => {
    const task = list.value[index]
    if (!checkPath(task.metadata.filePath)) return
    openDirInExplorer(task.metadata.filePath)
  }

  const handleCancelAll = async () => {
    const count = await cancelAllDownloadTasks()
    if (count > 0) {
      // 可选：显示成功提示
      console.log(`已取消 ${count} 个下载任务`)
    }
  }

  const handleClearCompleted = async () => {
    const count = await clearCompletedDownloadTasks()
    if (count > 0) {
      console.log(`已清空 ${count} 个下载任务`)
    }
  }

  const handleStartAll = async () => {
    // 找出所有暂停(PAUSE)和失败(ERROR)状态的任务
    const tasksToStart = list.value.filter(
      task => task.status === downloadStatus.PAUSE || task.status === downloadStatus.ERROR
    )

    if (tasksToStart.length > 0) {
      startDownloadTasks(tasksToStart)
      console.log(`已开始 ${tasksToStart.length} 个下载任务`)
    }
  }

  return {
    handleSearch,
    handleOpenMusicDetail,
    handleStartTask,
    handlePauseTask,
    handleRemoveTask,
    handleOpenFile,
    handleCancelAll,
    handleClearCompleted,
    handleStartAll,
  }
}
