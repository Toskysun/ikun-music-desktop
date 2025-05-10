import { watch } from '@common/utils/vueTools'
import { isFullscreen, proxy, sync, windowSizeList } from '@renderer/store'
import { appSetting } from '@renderer/store/setting'
import { sendSyncAction, setWindowSize } from '@renderer/utils/ipc'
import { setLanguage } from '@root/lang'
import { setUserApi } from '../apiSource'
// import { applyTheme, getThemes } from '@renderer/store/utils'

export default () => {
  watch(
    () => appSetting['common.windowSizeId'],
    (index) => {
      const info = index == null ? windowSizeList[2] : windowSizeList[index]
      setWindowSize(info.width, info.height)
    }
  )
  watch(
    () => appSetting['common.fontSize'],
    (fontSize) => {
      if (isFullscreen.value) return
      document.documentElement.style.fontSize = `${fontSize}px`
    }
  )

  watch(() => appSetting['network.proxy.enable'], enable => {
    proxy.enable = enable
  })
  watch(() => appSetting['network.proxy.host'], host => {
    proxy.host = host
  })
  watch(() => appSetting['network.proxy.port'], port => {
    proxy.port = port
  })
}
