import { getListMusicsFromCache } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { dialog } from '@renderer/plugins/Dialog'

export default () => {
  /**
   * 将整个列表的所有歌曲批量添加到播放列表
   * @param listInfo 列表信息
   */
  const handleAddToPlayList = (listInfo: LX.List.MyListInfo) => {
    // 获取列表中的所有歌曲
    const musics = getListMusicsFromCache(listInfo.id)

    // 检查列表是否为空
    if (!musics || musics.length === 0) {
      void dialog({
        message: (window.i18n.t as any)('lists__add_to_play_list_empty'),
      })
      return
    }

    // 播放第一首歌曲,这会自动将播放列表设置为当前列表
    playList(listInfo.id, 0)
  }

  return {
    handleAddToPlayList,
  }
}
