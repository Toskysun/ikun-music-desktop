import { ref } from '@common/utils/vueTools'
import { getListMusics } from '@renderer/store/list/action'
import { dialog } from '@renderer/plugins/Dialog'

export default () => {
  const isShowDownloadMultiple = ref(false)
  const downloadListInfo = ref<any>(null)
  const downloadMusicList = ref<LX.Music.MusicInfoOnline[]>([])

  /**
   * 批量下载列表内的所有歌曲
   * @param listInfo 列表信息
   */
  const handleDownloadList = async (listInfo: any) => {
    try {
      // 获取列表内的所有歌曲
      const musicList = await getListMusics(listInfo.id)

      // 过滤出在线歌曲（本地歌曲不需要下载）
      const onlineMusicList = musicList.filter(
        (music) => music.source !== 'local'
      ) as LX.Music.MusicInfoOnline[]

      if (onlineMusicList.length === 0) {
        void dialog({
          message: (window.i18n.t as any)('lists__download_no_online_music'),
        })
        return
      }

      console.log('[useDownload] Preparing batch download:', {
        listId: listInfo.id,
        listName: listInfo.name,
        totalCount: musicList.length,
        onlineCount: onlineMusicList.length,
      })

      // 保存列表信息和歌曲列表
      downloadListInfo.value = listInfo
      downloadMusicList.value = onlineMusicList

      // 显示音质选择窗口
      isShowDownloadMultiple.value = true
    } catch (error) {
      console.error('[useDownload] Failed to prepare download:', error)
      void dialog({
        message: (window.i18n.t as any)('lists__download_error', {
          error: (error as Error).message,
        }),
      })
    }
  }

  return {
    handleDownloadList,
    isShowDownloadMultiple,
    downloadListInfo,
    downloadMusicList,
  }
}
