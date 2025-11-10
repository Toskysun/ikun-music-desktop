import { watch } from '@common/utils/vueTools'
import { setGaplessPreloadTime as setPlayerGaplessPreloadTime } from '@renderer/plugins/player'
import { appSetting } from '@renderer/store/setting'

export default () => {
  // Initialize gapless preload time from settings
  setPlayerGaplessPreloadTime(appSetting['player.gaplessPreloadTime'])

  // Watch for setting changes
  watch(
    () => appSetting['player.gaplessPreloadTime'],
    (time) => {
      setPlayerGaplessPreloadTime(time)
    }
  )
}
