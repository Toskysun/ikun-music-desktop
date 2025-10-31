import path from 'node:path'
import { existsSync, mkdirSync, renameSync, readFileSync } from 'fs'
import { app, shell, screen, nativeTheme, dialog } from 'electron'
import { URL_SCHEME_RXP } from '@common/constants'
import { getTheme, initHotKey, initSetting, parseEnvParams } from './utils'
import { navigationUrlWhiteList } from '@common/config'
import defaultSetting from '@common/defaultSetting'
import { isExistWindow as isExistMainWindow, showWindow as showMainWindow } from './modules/winMain'
import { createAppEvent, createDislikeEvent, createListEvent } from '@main/event'
import { isMac, log } from '@common/utils'
import createWorkers from './worker'
import { migrateDBData } from './utils/migrate'
import { openDirInExplorer } from '@common/utils/electron'

// 加载自定义证书
const loadCustomCertificates = (): string[] => {
  const customCerts: string[] = []

  // 用户提供的证书路径
  const certPaths = [
    'D:\\Downloads\\reqable-ca.crt',
    path.join(app.getPath('userData'), 'custom-ca.crt'),
  ]

  for (const certPath of certPaths) {
    try {
      if (existsSync(certPath)) {
        const cert = readFileSync(certPath, 'utf-8')
        customCerts.push(cert)
        console.log(`✅ Loaded custom certificate: ${certPath}`)
      }
    } catch (err) {
      console.warn(`⚠️  Failed to load certificate from ${certPath}:`, err)
    }
  }

  return customCerts
}

// 存储自定义证书
let customTrustedCerts: string[] = []

export const initGlobalData = () => {
  const envParams = parseEnvParams()
  // envParams.cmdParams.dt = !!envParams.cmdParams.dt

  global.envParams = {
    cmdParams: envParams.cmdParams,
    deeplink: envParams.deeplink,
  }
  global.lx = {
    inited: false,
    isSkipTrayQuit: false,
    // mainWindowClosed: true,
    event_app: createAppEvent(),
    event_list: createListEvent(),
    event_dislike: createDislikeEvent(),
    appSetting: defaultSetting,
    worker: createWorkers(),
    hotKey: {
      enable: true,
      config: {
        local: {
          enable: false,
          keys: {},
        },
        global: {
          enable: false,
          keys: {},
        },
      },
      state: new Map(),
    },
    theme: {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
      theme: {
        id: '',
        name: '',
        isDark: false,
        colors: {},
      },
    },
    player_status: {
      status: 'stoped',
      name: '',
      singer: '',
      albumName: '',
      picUrl: '',
      progress: 0,
      duration: 0,
      playbackRate: 1,
      lyricLineText: '',
      lyricLineAllText: '',
      lyric: '',
      tlyric: '',
      rlyric: '',
      lxlyric: '',
      collect: false,
      volume: 0,
      mute: false,
    },
  }

  global.staticPath =
    process.env.NODE_ENV !== 'production' ? webpackStaticPath : path.join(__dirname, 'static')
}

export const initSingleInstanceHandle = () => {
  // 单例应用程序
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
  }

  app.on('second-instance', (event, argv, cwd) => {
    if (isExistMainWindow()) {
      const envParams = parseEnvParams(argv)
      if (envParams.deeplink) {
        global.envParams.deeplink = envParams.deeplink
        global.lx.event_app.deeplink(global.envParams.deeplink)
        return
      }
      if (envParams.cmdParams.hidden !== true) {
        showMainWindow()
      }
    } else {
      app.quit()
    }
  })
}

export const applyElectronEnvParams = () => {
  // Is disable hardware acceleration
  if (global.envParams.cmdParams.dha) {
    app.disableHardwareAcceleration()
    console.warn('⚠️  Hardware acceleration disabled - WebGL 2 will not be available')
  }
  if (global.envParams.cmdParams.dhmkh)
    app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

  // fix linux transparent fail. https://github.com/electron/electron/issues/25153#issuecomment-843688494
  if (process.platform == 'linux') app.commandLine.appendSwitch('use-gl', 'desktop')

  // https://github.com/electron/electron/issues/22691
  app.commandLine.appendSwitch('wm-window-animations-disabled')

  // WebGL 2 support configuration for Electron 39+
  // These switches ensure WebGL 2 works properly in Chromium 142+
  if (!global.envParams.cmdParams.dha) {
    // ⚡ CRITICAL: Ignore GPU blocklist - allows WebGL 2 on all supported GPUs
    app.commandLine.appendSwitch('ignore-gpu-blocklist')

    // ⚠️ DO NOT force ANGLE backend - let Chromium choose (D3D11 on Windows is fine)
    // app.commandLine.appendSwitch('use-angle', 'gl')  // This breaks WebGL on some systems!

    // 🚀 Enable WebGL 2 and extensions
    app.commandLine.appendSwitch('enable-webgl2-compute-context')
    app.commandLine.appendSwitch('enable-webgl-draft-extensions')

    // 💪 GPU acceleration optimizations
    app.commandLine.appendSwitch('enable-gpu-rasterization')
    app.commandLine.appendSwitch('enable-zero-copy')
    app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds')
    app.commandLine.appendSwitch('disable-gpu-sandbox')

    // 🔥 NUCLEAR OPTION: Force disable software rendering
    app.commandLine.appendSwitch('disable-software-rasterizer')

    // 🎯 FORCE ENABLE WebGL 2 - Override all restrictions
    app.commandLine.appendSwitch('enable-unsafe-webgpu')
    app.commandLine.appendSwitch('enable-features', 'Vulkan,UseSkiaRenderer')

    console.log('✅ WebGL 2 acceleration enabled (ignoring GPU blocklist)')
    console.log('   - GPU blocklist: IGNORED')
    console.log('   - ANGLE backend: AUTO (Chromium decides D3D11/OpenGL)')
    console.log('   - Software rendering: DISABLED')
    console.log('   - WebGPU: ENABLED (unsafe mode)')
    console.log('   - Vulkan/Skia: ENABLED')
  }

  // 支持自定义证书，允许抓包工具（如 Reqable）
  // 检查是否存在自定义证书文件
  const customCertPaths = [
    'D:\\Downloads\\reqable-ca.crt',
    path.join(app.getPath('userData'), 'custom-ca.crt'),
  ]
  const hasCustomCert = customCertPaths.some(certPath => existsSync(certPath))

  if (hasCustomCert) {
    // 忽略证书错误，允许使用自定义 CA 证书
    app.commandLine.appendSwitch('ignore-certificate-errors')
    console.log('🔓 Certificate validation relaxed: Custom CA certificates detected')
  }

  // proxy
  if (global.envParams.cmdParams['proxy-server']) {
    app.commandLine.appendSwitch('proxy-server', global.envParams.cmdParams['proxy-server'])
    app.commandLine.appendSwitch(
      'proxy-bypass-list',
      global.envParams.cmdParams['proxy-bypass-list'] ?? '<local>'
    )
  }
}

export const setUserDataPath = () => {
  // windows平台下如果应用目录下存在 portable 文件夹则将数据存在此文件下
  if (process.platform == 'win32') {
    const portablePath = path.join(path.dirname(app.getPath('exe')), '/portable')
    if (existsSync(portablePath)) {
      app.setPath('appData', portablePath)
      const appDataPath = path.join(portablePath, '/userData')
      if (!existsSync(appDataPath)) mkdirSync(appDataPath)
      app.setPath('userData', appDataPath)
    }
  }

  const userDataPath = app.getPath('userData')
  global.lxOldDataPath = userDataPath
  global.lxDataPath = path.join(userDataPath, 'LxDatas')
  if (!existsSync(global.lxDataPath)) mkdirSync(global.lxDataPath)
}

export const registerDeeplink = (startApp: () => void) => {
  if (process.env.NODE_ENV !== 'production' && process.platform === 'win32') {
    // Set the path of electron.exe and your app.
    // These two additional parameters are only available on windows.
    // console.log(process.execPath, process.argv)
    app.setAsDefaultProtocolClient('lxmusic', process.execPath, process.argv.slice(1))
  } else {
    app.setAsDefaultProtocolClient('lxmusic')
  }

  // deep link
  app.on('open-url', (event, url) => {
    if (!URL_SCHEME_RXP.test(url)) return
    event.preventDefault()
    global.envParams.deeplink = url
    if (isExistMainWindow()) {
      if (global.envParams.deeplink) global.lx.event_app.deeplink(global.envParams.deeplink)
      else showMainWindow()
    } else {
      startApp()
    }
  })
}

export const listenerAppEvent = (startApp: () => void) => {
  // 加载自定义受信任证书
  customTrustedCerts = loadCustomCertificates()

  // 处理证书验证错误，支持抓包工具（如 Reqable）
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault()

    // 检查是否是自定义受信任的证书
    const certPEM = certificate.data.toString()
    const isTrustedCert = customTrustedCerts.some(trustedCert => {
      // 移除证书中的空白字符进行比较
      const cleanTrusted = trustedCert.replace(/\s/g, '')
      const cleanCert = certPEM.replace(/\s/g, '')
      return cleanTrusted === cleanCert
    })

    if (isTrustedCert) {
      console.log(`✅ Certificate verified: Using custom trusted certificate for ${url}`)
      callback(true)
    } else if (process.env.NODE_ENV !== 'production') {
      // 开发环境下允许所有证书
      console.log(`⚠️  Certificate error bypassed in development mode for ${url}`)
      callback(true)
    } else {
      console.warn(`❌ Certificate verification failed for ${url}: ${error}`)
      callback(false)
    }
  })

  app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          'navigation to url:',
          navigationUrl.length > 130 ? navigationUrl.substring(0, 130) + '...' : navigationUrl
        )
        return
      }
      if (!navigationUrlWhiteList.some((url) => url.test(navigationUrl))) {
        event.preventDefault()
        return
      }
      console.log('navigation to url:', navigationUrl)
    })
    contents.setWindowOpenHandler(({ url }) => {
      if (!/^devtools/.test(url) && /^https?:\/\//.test(url)) {
        void shell.openExternal(url)
      }
      console.log(url)
      return { action: 'deny' }
    })
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      // Strip away preload scripts if unused or verify their location is legitimate
      delete webPreferences.preload
      // delete webPreferences.preloadURL

      // Disable Node.js integration
      webPreferences.nodeIntegration = false

      // Verify URL being loaded
      if (!navigationUrlWhiteList.some((url) => url.test(params.src))) {
        event.preventDefault()
      }
    })

    // disable create dictionary
    // https://github.com/ikunshare/ikun-music-desktop/issues/773
    contents.session.setSpellCheckerDictionaryDownloadURL('http://0.0.0.0')
  })

  app.on('activate', () => {
    if (isExistMainWindow()) {
      showMainWindow()
    } else {
      startApp()
    }
  })

  app.on('before-quit', () => {
    global.lx.isSkipTrayQuit = true
  })
  app.on('window-all-closed', () => {
    if (isMac) return

    app.quit()
  })

  const initScreenParams = () => {
    global.envParams.workAreaSize = screen.getPrimaryDisplay().workAreaSize
  }
  app.on('ready', () => {
    screen.on('display-metrics-changed', initScreenParams)
    initScreenParams()
  })

  nativeTheme.addListener('updated', () => {
    const shouldUseDarkColors = nativeTheme.shouldUseDarkColors
    if (shouldUseDarkColors == global.lx.theme.shouldUseDarkColors) return
    global.lx.theme.shouldUseDarkColors = shouldUseDarkColors
    global.lx?.event_app.system_theme_change(shouldUseDarkColors)
  })

  global.lx.event_app.on('updated_config', (config, setting) => {
    if (config.includes('player.volume')) {
      global.lx.event_app.player_status({ volume: Math.trunc(setting['player.volume']! * 100) })
    }
    if (config.includes('player.isMute')) {
      global.lx.event_app.player_status({ mute: setting['player.isMute'] })
    }
  })
}

const initTheme = () => {
  global.lx.theme = getTheme()
  const themeConfigKeys = ['theme.id', 'theme.lightId', 'theme.darkId']
  global.lx.event_app.on('updated_config', (keys) => {
    let requireUpdate = false
    for (const key of keys) {
      if (themeConfigKeys.includes(key)) {
        requireUpdate = true
        break
      }
    }
    if (requireUpdate) {
      global.lx.theme = getTheme()
      global.lx.event_app.theme_change()
    }
  })
  global.lx.event_app.on('system_theme_change', () => {
    if (global.lx.appSetting['theme.id'] == 'auto') {
      global.lx.theme = getTheme()
      global.lx.event_app.theme_change()
    }
  })
}

const backupDB = (backupPath: string) => {
  const dbPath = path.join(global.lxDataPath, 'lx.data.db')
  try {
    renameSync(dbPath, backupPath)
  } catch {}
  try {
    renameSync(`${dbPath}-wal`, `${backupPath}-wal`)
  } catch {}
  try {
    renameSync(`${dbPath}-shm`, `${backupPath}-shm`)
  } catch {}
  openDirInExplorer(backupPath)
}

let isInitialized = false
export const initAppSetting = async () => {
  if (!global.lx.inited) {
    const config = await initHotKey()
    global.lx.hotKey.config.local = config.local
    global.lx.hotKey.config.global = config.global
    global.lx.inited = true
  }

  if (!isInitialized) {
    let dbFileExists = await global.lx.worker.dbService.init(global.lxDataPath)
    if (dbFileExists === null) {
      const backupPath = path.join(global.lxDataPath, `lx.data.db.${Date.now()}.bak`)
      dialog.showMessageBoxSync({
        type: 'warning',
        message: 'Database verify failed',
        detail: `数据库表结构校验失败，我们将把有问题的数据库备份到：${backupPath}\n若此问题导致你的数据丢失，你可以尝试从备份文件找回它们。\n\nThe database table structure verification failed, we will back up the problematic database to: ${backupPath}\nIf this problem causes your data to be lost, you can try to retrieve them from the backup file.`,
      })
      backupDB(backupPath)
      dbFileExists = await global.lx.worker.dbService.init(global.lxDataPath)
    }
    global.lx.appSetting = (await initSetting()).setting
    if (!dbFileExists)
      await migrateDBData().catch((err) => {
        log.error(err)
      })
    initTheme()
    if (envParams.cmdParams.dt == null) envParams.cmdParams.dt = !global.lx.appSetting['common.transparentWindow']
  }
  // global.lx.theme = getTheme()

  isInitialized ||= true
}

export const quitApp = () => {
  global.lx.isSkipTrayQuit = true
  app.quit()
}
