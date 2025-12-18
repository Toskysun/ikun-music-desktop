<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  .p.small
    | 本软件完全免费, 基于此项目修改：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Toskysun/ikun-music-desktop#readme')") https://github.com/Toskysun/ikun-music-desktop
  .p.small
    | 最新版下载地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://qm.qq.com/q/ovKqDzTNg4')") QQ群文件
  .p.small
    | 软件的常见问题可转至：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://ikunshare.github.io/lx-music-doc/desktop/faq')") 桌面版常见问题
  .p.small
    strong 本软件没有客服
    | ，但我们整理了一些常见的使用问题。
    strong 仔细、仔细、仔细
    | 地阅读常见问题后即可解决大部分问题。
  br
  .p.small 由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。
  .p.small
    | 目前本修改版本项目的原始发布地址
    strong 只有&nbsp;QQ
    | ，其他渠道均为第三方转载发布，可信度请自行鉴别。
  .p.small
    strong 本项目没有微信公众号之类的所谓「官方账号」，谨防被骗！
  br

  .p.small
    | 你已签署本软件的
    base-btn(min @click="handleShowPact") 许可协议
    | ，协议的在线版本在
    strong.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/Toskysun/ikun-music-desktop#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE')") 这里
    | 。
  br

  .p.small
    | By:&nbsp;
    span.credit-name(@click="handleCreditClick('落雪无痕')") 落雪无痕
    span.credit-separator  &&
    span.credit-name.easter-egg-trigger(@click="handleCreditClick('ikun0014')") ikun0014
    span.credit-separator  &&
    span.credit-name.easter-egg-trigger(@click="handleCreditClick('Toskysun')") Toskysun
</template>

<script>
import { ref } from '@common/utils/vueTools'
import { isShowPact } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'
import { appSetting, updateSetting } from '@renderer/store/setting'

export default {
  name: 'SettingAbout',
  setup() {
    const handleShowPact = () => {
      isShowPact.value = true
    }

    // 彩蛋点击状态管理
    const clickCounts = ref({
      Toskysun: 0,
      ikun0014: 0,
    })
    const lastClickTimes = ref({
      Toskysun: 0,
      ikun0014: 0,
    })
    const CLICK_THRESHOLD = 5 // 需要点击的次数
    const TIME_WINDOW = 500 // 时间窗口（毫秒）

    const handleCreditClick = (name) => {
      const now = Date.now()

      // 只处理有彩蛋的名字
      if (name === 'Toskysun' || name === 'ikun0014') {
        const timeDiff = now - lastClickTimes.value[name]

        // 如果点击间隔超过时间窗口，重置计数
        if (timeDiff > TIME_WINDOW) {
          clickCounts.value[name] = 1
        } else {
          clickCounts.value[name]++
        }

        lastClickTimes.value[name] = now

        // Toskysun 彩蛋：解锁流光溢彩
        if (name === 'Toskysun' && clickCounts.value[name] >= CLICK_THRESHOLD) {
          updateSetting({ 'player.flowingGlowUnlocked': true })
          console.log('🎉 流光溢彩彩蛋已解锁！请前往播放详细页设置查看')
          clickCounts.value[name] = 0
        }

        // ikun0014 彩蛋：解锁逐字歌词上移效果
        if (name === 'ikun0014' && clickCounts.value[name] >= CLICK_THRESHOLD) {
          updateSetting({ 'playDetail.lyricTextLiftEffectUnlocked': true })
          console.log('🎉 逐字歌词上移效果彩蛋已解锁！请前往播放详细页设置查看')
          clickCounts.value[name] = 0
        }

        // 调试信息
        console.log(`[Easter Egg] ${name} clicked, count: ${clickCounts.value[name]}/${CLICK_THRESHOLD}`)
      }
    }

    return {
      openUrl,
      clipboardWriteText,
      handleShowPact,
      handleCreditClick,
      appSetting,
    }
  },
}
</script>

<style lang="less" scoped>
// 彩蛋入口样式
.credit-name {
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 1px 3px;
  border-radius: 3px;

  &:hover {
    color: var(--color-primary);
    background: var(--color-primary-alpha-100);
  }

  &:active {
    transform: scale(0.95);
  }
}

.easter-egg-trigger {
  // 最后的 Toskysun 有特殊样式提示
  font-weight: 600;

  &:hover {
    color: var(--color-theme);
    background: var(--color-theme-alpha-100);
  }
}

.credit-separator {
  user-select: none;
}
</style>
