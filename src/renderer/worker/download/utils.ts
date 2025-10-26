import { DOWNLOAD_STATUS, QUALITYS } from '@common/constants'
import { filterFileName } from '@common/utils/common'
import { buildLyrics } from './lrcTool'
import fs from 'fs'
import { clipFileNameLength, clipNameLength } from '@common/utils/tools'
import { QUALITY_ORDER, getFallbackQualities } from '@common/utils/downloadQuality'

/**
 * 保存歌词文件
 */
export const saveLrc = async(lrcData: LX.Music.LyricInfo, info: {
  filePath: string
  format: LX.LyricFormat
  downloadLxlrc: boolean
  downloadTlrc: boolean
  downloadRlrc: boolean
}) => {
  const iconv = await import('iconv-lite')
  const lrc = buildLyrics(lrcData, info.downloadLxlrc, info.downloadTlrc, info.downloadRlrc)
  switch (info.format) {
    case 'gbk':
      fs.writeFile(info.filePath, iconv.encode(lrc, 'gbk', { addBOM: true }), err => {
        if (err) console.log(err)
      })
      break
    case 'utf8':
    default:
      fs.writeFile(info.filePath, iconv.encode(lrc, 'utf8', { addBOM: true }), err => {
        if (err) console.log(err)
      })
      break
  }
}

export const getExt = (type: string): LX.Download.FileExt => {
  switch (type) {
    case 'flac':
    case 'master':
    case 'atmos_plus':
    case 'atmos':
    case 'hires':
      return 'flac'
    case '128k':
    case '192k':
    case '320k':
    default:
      return 'mp3'
  }
}

/**
 * 获取音乐音质
 * @param musicInfo
 * @param type
 * @param qualityList
 * @param fallbackStrategy 回退策略（默认为 'downgrade'）
 */
export const getMusicType = (
  musicInfo: LX.Music.MusicInfoOnline,
  type: LX.Quality,
  qualityList: LX.QualityList,
  fallbackStrategy: 'downgrade' | 'upgrade' | 'max' | 'min' = 'downgrade'
): LX.Quality => {
  console.log('[utils/getMusicType] START - type:', type, 'source:', musicInfo.source)

  try {
    let list = qualityList[musicInfo.source]
    if (!list) {
      console.log('[utils/getMusicType] No quality list for source, returning 128k')
      return '128k'
    }
    if (!list.includes(type)) {
      type = list[list.length - 1]
      console.log('[utils/getMusicType] Requested quality not in list, using:', type)
    }

    // 检查 _qualitys 是否存在
    if (!musicInfo.meta || !musicInfo.meta._qualitys || Object.keys(musicInfo.meta._qualitys).length === 0) {
      // 如果 _qualitys 不存在或为空对象，返回请求的音质（如果在列表中）或默认值
      console.log('[utils/getMusicType] No _qualitys or empty, using fallback')
      return list.includes(type) ? type : list[list.length - 1]
    }

    // 检查请求的音质是否可用
    if (musicInfo.meta._qualitys[type]) {
      console.log('[utils/getMusicType] Requested quality available')
      return type
    }

    console.log('[utils/getMusicType] Requested quality not available, finding fallback')

    // 获取音乐的可用音质列表
    const musicAvailableQualities = Object.keys(musicInfo.meta._qualitys)
      .filter(q => musicInfo.meta._qualitys[q as LX.Quality]) as LX.Quality[]
    const filteredQualities = list.filter(q => musicAvailableQualities.includes(q))

    console.log('[utils/getMusicType] Available qualities:', musicAvailableQualities)
    console.log('[utils/getMusicType] Filtered qualities:', filteredQualities)

    // 根据策略获取备选音质列表
    const fallbackQualities = getFallbackQualities(type, filteredQualities, fallbackStrategy)

    console.log('[utils/getMusicType] Fallback qualities:', fallbackQualities)

    // 返回第一个可用的备选音质
    if (fallbackQualities.length > 0) {
      console.log('[utils/getMusicType] Using fallback:', fallbackQualities[0])
      return fallbackQualities[0]
    }

    // 如果没有备选音质，返回默认值
    console.log('[utils/getMusicType] No fallback available, returning 128k')
    return '128k'
  } catch (error) {
    console.error('[utils/getMusicType] Error:', error)
    return '128k'
  }
}

export const createDownloadInfo = (
  musicInfo: LX.Music.MusicInfoOnline,
  type: LX.Quality,
  fileName: string,
  qualityList: LX.QualityList,
  listId?: string,
  fallbackStrategy: 'downgrade' | 'upgrade' | 'max' | 'min' = 'downgrade'
) => {
  console.log('[utils/createDownloadInfo] START for:', musicInfo.name)

  try {
    type = getMusicType(musicInfo, type, qualityList, fallbackStrategy)
    let ext = getExt(type)
    const key = `${musicInfo.id}_${type}_${ext}`

    console.log('[utils/createDownloadInfo] Quality:', type, 'Ext:', ext, 'Key:', key)

    const downloadInfo: LX.Download.ListItem = {
      id: key,
      isComplate: false,
      status: DOWNLOAD_STATUS.WAITING,
      statusText: '待下载',
      downloaded: 0,
      total: 0,
      progress: 0,
      speed: '',
      writeQueue: 0,
      metadata: {
        musicInfo,
        url: null,
        quality: type,
        ext,
        filePath: '',
        listId,
        fileName: filterFileName(
          `${clipFileNameLength(
            fileName.replace('歌名', musicInfo.name).replace('歌手', clipNameLength(musicInfo.singer))
          )}.${ext}`
        ),
      },
    }

    console.log('[utils/createDownloadInfo] Created:', downloadInfo.id)
    return downloadInfo
  } catch (error) {
    console.error('[utils/createDownloadInfo] Error:', error)
    throw error
  }
}
