/**
 * 下载音质相关工具函数
 * 从 renderer/store/download/action.ts 提取到共享模块，解决循环依赖
 */

// 音质顺序：从低到高
export const QUALITY_ORDER: LX.Quality[] = [
  '128k',
  '192k',
  '320k',
  'flac',
  'hires',
  'atmos',
  'atmos_plus',
  'master',
]

/**
 * 根据回退策略获取备选音质列表
 * @param requestedQuality 请求的音质
 * @param availableQualities 可用的音质列表
 * @param strategy 回退策略
 * @returns 按优先级排序的备选音质列表
 */
export const getFallbackQualities = (
  requestedQuality: LX.Quality,
  availableQualities: LX.Quality[],
  strategy: 'downgrade' | 'upgrade' | 'max' | 'min'
): LX.Quality[] => {
  const requestedIndex = QUALITY_ORDER.indexOf(requestedQuality)

  switch (strategy) {
    case 'downgrade': {
      // 降级：从请求的音质向下查找
      const fallbackQualities = QUALITY_ORDER.slice(0, requestedIndex)
        .reverse()
        .filter((q) => availableQualities.includes(q))
      return fallbackQualities
    }
    case 'upgrade': {
      // 升级：从请求的音质向上查找
      const fallbackQualities = QUALITY_ORDER.slice(requestedIndex + 1).filter((q) =>
        availableQualities.includes(q)
      )
      return fallbackQualities
    }
    case 'max': {
      // 最大音质：从高到低排序
      const fallbackQualities = [...QUALITY_ORDER]
        .reverse()
        .filter((q) => availableQualities.includes(q) && q !== requestedQuality)
      return fallbackQualities
    }
    case 'min': {
      // 最低音质：从低到高排序
      const fallbackQualities = QUALITY_ORDER.filter(
        (q) => availableQualities.includes(q) && q !== requestedQuality
      )
      return fallbackQualities
    }
    default:
      return []
  }
}
