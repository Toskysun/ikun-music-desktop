interface HTMLAudioElementChrome extends HTMLAudioElement {
  setSinkId: (id: string) => Promise<void>
}

// 双Audio元素系统 - 用于无缝切换
let audioA: HTMLAudioElementChrome | null = null
let audioB: HTMLAudioElementChrome | null = null
let currentAudioId: 'A' | 'B' = 'A'  // 当前播放的audio
let audio: HTMLAudioElementChrome | null = null  // 指向当前活跃的audio

let audioContext: AudioContext
let mediaSourceA: MediaElementAudioSourceNode | null = null
let mediaSourceB: MediaElementAudioSourceNode | null = null
let mediaSource: MediaElementAudioSourceNode  // 指向当前活跃的mediaSource
let analyser: AnalyserNode
// https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext
// https://benzleung.gitbooks.io/web-audio-api-mini-guide/content/chapter5-1.html
export const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const
type Freqs = (typeof freqs)[number]
let biquads: Map<`hz${Freqs}`, BiquadFilterNode>
export const freqsPreset = [
  {
    name: 'pop',
    hz31: 6,
    hz62: 5,
    hz125: -3,
    hz250: -2,
    hz500: 5,
    hz1000: 4,
    hz2000: -4,
    hz4000: -3,
    hz8000: 6,
    hz16000: 4,
  },
  {
    name: 'dance',
    hz31: 4,
    hz62: 3,
    hz125: -4,
    hz250: -6,
    hz500: 0,
    hz1000: 0,
    hz2000: 3,
    hz4000: 4,
    hz8000: 4,
    hz16000: 5,
  },
  {
    name: 'rock',
    hz31: 7,
    hz62: 6,
    hz125: 2,
    hz250: 1,
    hz500: -3,
    hz1000: -4,
    hz2000: 2,
    hz4000: 1,
    hz8000: 4,
    hz16000: 5,
  },
  {
    name: 'classical',
    hz31: 6,
    hz62: 7,
    hz125: 1,
    hz250: 2,
    hz500: -1,
    hz1000: 1,
    hz2000: -4,
    hz4000: -6,
    hz8000: -7,
    hz16000: -8,
  },
  {
    name: 'vocal',
    hz31: -5,
    hz62: -6,
    hz125: -4,
    hz250: -3,
    hz500: 3,
    hz1000: 4,
    hz2000: 5,
    hz4000: 4,
    hz8000: -3,
    hz16000: -3,
  },
  {
    name: 'slow',
    hz31: 5,
    hz62: 4,
    hz125: 2,
    hz250: 0,
    hz500: -2,
    hz1000: 0,
    hz2000: 3,
    hz4000: 6,
    hz8000: 7,
    hz16000: 8,
  },
  {
    name: 'electronic',
    hz31: 6,
    hz62: 5,
    hz125: 0,
    hz250: -5,
    hz500: -4,
    hz1000: 0,
    hz2000: 6,
    hz4000: 8,
    hz8000: 8,
    hz16000: 7,
  },
  {
    name: 'subwoofer',
    hz31: 8,
    hz62: 7,
    hz125: 5,
    hz250: 4,
    hz500: 0,
    hz1000: 0,
    hz2000: 0,
    hz4000: 0,
    hz8000: 0,
    hz16000: 0,
  },
  {
    name: 'soft',
    hz31: -5,
    hz62: -5,
    hz125: -4,
    hz250: -4,
    hz500: 3,
    hz1000: 2,
    hz2000: 4,
    hz4000: 4,
    hz8000: 0,
    hz16000: 0,
  },
] as const
export const convolutions = [
  { name: 'telephone', mainGain: 0.0, sendGain: 3.0, source: 'filter-telephone.wav' }, // 电话
  { name: 's2_r4_bd', mainGain: 1.8, sendGain: 0.9, source: 's2_r4_bd.wav' }, // 教堂
  { name: 'bright_hall', mainGain: 0.8, sendGain: 2.4, source: 'bright-hall.wav' },
  { name: 'cinema_diningroom', mainGain: 0.6, sendGain: 2.3, source: 'cinema-diningroom.wav' },
  {
    name: 'dining_living_true_stereo',
    mainGain: 0.6,
    sendGain: 1.8,
    source: 'dining-living-true-stereo.wav',
  },
  {
    name: 'living_bedroom_leveled',
    mainGain: 0.6,
    sendGain: 2.1,
    source: 'living-bedroom-leveled.wav',
  },
  { name: 'spreader50_65ms', mainGain: 1, sendGain: 2.5, source: 'spreader50-65ms.wav' },
  // { name: 'spreader25_125ms', mainGain: 1, sendGain: 2.5, source: 'spreader25-125ms.wav' },
  // { name: 'backslap', mainGain: 1.8, sendGain: 0.8, source: 'backslap1.wav' },
  { name: 's3_r1_bd', mainGain: 1.8, sendGain: 0.8, source: 's3_r1_bd.wav' },
  { name: 'matrix_1', mainGain: 1.5, sendGain: 0.9, source: 'matrix-reverb1.wav' },
  { name: 'matrix_2', mainGain: 1.3, sendGain: 1, source: 'matrix-reverb2.wav' },
  {
    name: 'cardiod_35_10_spread',
    mainGain: 1.8,
    sendGain: 0.6,
    source: 'cardiod-35-10-spread.wav',
  },
  {
    name: 'tim_omni_35_10_magnetic',
    mainGain: 1,
    sendGain: 0.2,
    source: 'tim-omni-35-10-magnetic.wav',
  },
  // { name: 'spatialized', mainGain: 1.8, sendGain: 0.8, source: 'spatialized8.wav' },
  // { name: 'zing_long_stereo', mainGain: 0.8, sendGain: 1.8, source: 'zing-long-stereo.wav' },
  { name: 'feedback_spring', mainGain: 1.8, sendGain: 0.8, source: 'feedback-spring.wav' },
  // { name: 'tim_omni_rear_blend', mainGain: 1.8, sendGain: 0.8, source: 'tim-omni-rear-blend.wav' },
] as const
// 半音
// export const semitones = [-1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] as const

let convolver: ConvolverNode
let convolverSourceGainNode: GainNode
let convolverOutputGainNode: GainNode
let convolverDynamicsCompressor: DynamicsCompressorNode
let gainNode: GainNode
let panner: PannerNode
let pitchShifterNode: AudioWorkletNode
let pitchShifterNodePitchFactor: AudioParam | null
let pitchShifterNodeLoadStatus: 'none' | 'loading' | 'unconnect' | 'connected' = 'none'
let pitchShifterNodeTempValue = 1
let defaultChannelCount = 2
export const soundR = 0.5

export const createAudio = () => {
  if (audio) return

  // 创建两个audio元素用于无缝切换
  audioA = new window.Audio() as HTMLAudioElementChrome
  audioA.controls = false
  audioA.autoplay = true
  audioA.preload = 'auto'
  audioA.crossOrigin = 'anonymous'

  audioB = new window.Audio() as HTMLAudioElementChrome
  audioB.controls = false
  audioB.autoplay = false  // B初始不自动播放
  audioB.preload = 'auto'
  audioB.crossOrigin = 'anonymous'

  // 默认使用 audioA
  audio = audioA
  currentAudioId = 'A'
}

const initAnalyser = () => {
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
}

const initBiquadFilter = () => {
  biquads = new Map()
  let i

  for (const item of freqs) {
    const filter = audioContext.createBiquadFilter()
    biquads.set(`hz${item}`, filter)
    filter.type = 'peaking'
    filter.frequency.value = item
    filter.Q.value = 1.4
    filter.gain.value = 0
  }

  for (i = 1; i < freqs.length; i++) {
    biquads.get(`hz${freqs[i - 1]}`)!.connect(biquads.get(`hz${freqs[i]}`)!)
  }
}

const initConvolver = () => {
  convolverSourceGainNode = audioContext.createGain()
  convolverOutputGainNode = audioContext.createGain()
  convolverDynamicsCompressor = audioContext.createDynamicsCompressor()
  convolver = audioContext.createConvolver()
  convolver.connect(convolverOutputGainNode)
  convolverSourceGainNode.connect(convolverDynamicsCompressor)
  convolverOutputGainNode.connect(convolverDynamicsCompressor)
}

const initPanner = () => {
  panner = audioContext.createPanner()
}

const initGain = () => {
  gainNode = audioContext.createGain()
}

const initAdvancedAudioFeatures = () => {
  if (audioContext) return
  if (!audio || !audioA || !audioB) throw new Error('audio not defined')
  audioContext = new window.AudioContext({ latencyHint: 'playback' })
  defaultChannelCount = audioContext.destination.channelCount

  initAnalyser()
  initBiquadFilter()
  initConvolver()
  initPanner()
  initGain()

  // 创建双audio的mediaSource
  // source -> analyser -> biquadFilter -> pitchShifter -> [(convolver & convolverSource)->convolverDynamicsCompressor] -> panner -> gain
  mediaSourceA = audioContext.createMediaElementSource(audioA)
  mediaSourceB = audioContext.createMediaElementSource(audioB)

  // 默认连接 mediaSourceA
  mediaSource = mediaSourceA
  mediaSource.connect(analyser)

  analyser.connect(biquads.get(`hz${freqs[0]}`)!)
  const lastBiquadFilter = biquads.get(`hz${freqs.at(-1)!}`)!
  lastBiquadFilter.connect(convolverSourceGainNode)
  lastBiquadFilter.connect(convolver)
  convolverDynamicsCompressor.connect(panner)
  panner.connect(gainNode)
  gainNode.connect(audioContext.destination)

  // 音频输出设备改变时刷新 audio node 连接
  window.app_event.on('playerDeviceChanged', handleMediaListChange)

  // audio.addEventListener('playing', connectAudioNode)
  // audio.addEventListener('pause', disconnectAudioNode)
  // audio.addEventListener('waiting', disconnectAudioNode)
  // audio.addEventListener('emptied', disconnectAudioNode)
  // if (!audio.paused) connectAudioNode()
}

const handleMediaListChange = () => {
  mediaSource.disconnect()
  mediaSource.connect(analyser)
}

// let isConnected = true
// const connectAudioNode = () => {
//   if (isConnected) return
//   console.log('connect Node')
//   mediaSource.connect(analyser)
//   isConnected = true
//   if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
//     disconnectPitchShifterNode()
//   }
// }

// const disconnectAudioNode = () => {
//   if (!isConnected) return
//   console.log('disconnect Node')
//   mediaSource.disconnect()
//   isConnected = false
//   if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
//     disconnectPitchShifterNode()
//   }
// }

export const getAudioContext = () => {
  initAdvancedAudioFeatures()
  return audioContext
}

let unsubMediaListChangeEvent: (() => void) | null = null
export const setMaxOutputChannelCount = (enable: boolean) => {
  if (enable) {
    initAdvancedAudioFeatures()
    audioContext.destination.channelCountMode = 'max'
    audioContext.destination.channelCount = audioContext.destination.maxChannelCount
    // navigator.mediaDevices.addEventListener('devicechange', handleMediaListChange)
    if (!unsubMediaListChangeEvent) {
      let handleMediaListChange = () => {
        setMaxOutputChannelCount(true)
      }
      window.app_event.on('playerDeviceChanged', handleMediaListChange)
      unsubMediaListChangeEvent = () => {
        window.app_event.off('playerDeviceChanged', handleMediaListChange)
        unsubMediaListChangeEvent = null
      }
    }
  } else {
    unsubMediaListChangeEvent?.()
    if (audioContext && audioContext.destination.channelCountMode != 'explicit') {
      audioContext.destination.channelCount = defaultChannelCount
      // audioContext.destination.channelInterpretation
      audioContext.destination.channelCountMode = 'explicit'
    }
  }
}

export const getAnalyser = (): AnalyserNode | null => {
  initAdvancedAudioFeatures()
  return analyser
}

export const getBiquadFilter = () => {
  initAdvancedAudioFeatures()
  return biquads
}

// let isConvolverConnected = false
export const setConvolver = (buffer: AudioBuffer | null, mainGain: number, sendGain: number) => {
  initAdvancedAudioFeatures()
  convolver.buffer = buffer
  // console.log(mainGain, sendGain)
  if (buffer) {
    convolverSourceGainNode.gain.value = mainGain
    convolverOutputGainNode.gain.value = sendGain
  } else {
    convolverSourceGainNode.gain.value = 1
    convolverOutputGainNode.gain.value = 0
  }
}

export const setConvolverMainGain = (gain: number) => {
  if (convolverSourceGainNode.gain.value == gain) return
  // console.log(gain)
  convolverSourceGainNode.gain.value = gain
}

export const setConvolverSendGain = (gain: number) => {
  if (convolverOutputGainNode.gain.value == gain) return
  // console.log(gain)
  convolverOutputGainNode.gain.value = gain
}

let pannerInfo = {
  x: 0,
  y: 0,
  z: 0,
  soundR: 0.5,
  rad: 0,
  speed: 1,
  intv: null as NodeJS.Timeout | null,
}
const setPannerXYZ = (nx: number, ny: number, nz: number) => {
  pannerInfo.x = nx
  pannerInfo.y = ny
  pannerInfo.z = nz
  // console.log(pannerInfo)
  panner.positionX.value = nx * pannerInfo.soundR
  panner.positionY.value = ny * pannerInfo.soundR
  panner.positionZ.value = nz * pannerInfo.soundR
}
export const setPannerSoundR = (r: number) => {
  pannerInfo.soundR = r
}

export const setPannerSpeed = (speed: number) => {
  pannerInfo.speed = speed
  if (pannerInfo.intv) startPanner()
}
export const stopPanner = () => {
  if (pannerInfo.intv) {
    clearInterval(pannerInfo.intv)
    pannerInfo.intv = null
    pannerInfo.rad = 0
  }
  panner.positionX.value = 0
  panner.positionY.value = 0
  panner.positionZ.value = 0
}

export const startPanner = () => {
  initAdvancedAudioFeatures()
  if (pannerInfo.intv) {
    clearInterval(pannerInfo.intv)
    pannerInfo.intv = null
    pannerInfo.rad = 0
  }
  pannerInfo.intv = setInterval(() => {
    pannerInfo.rad += 1
    if (pannerInfo.rad > 360) pannerInfo.rad -= 360
    setPannerXYZ(
      Math.sin((pannerInfo.rad * Math.PI) / 180),
      Math.cos((pannerInfo.rad * Math.PI) / 180),
      Math.cos((pannerInfo.rad * Math.PI) / 180)
    )
  }, pannerInfo.speed * 10)
}

let isConnected = true
const connectNode = () => {
  if (isConnected) return
  console.log('connect Node')
  analyser?.connect(biquads.get(`hz${freqs[0]}`)!)
  isConnected = true
  if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
    disconnectPitchShifterNode()
  }
}
const disconnectNode = () => {
  if (!isConnected) return
  console.log('disconnect Node')
  analyser?.disconnect()
  isConnected = false
  if (pitchShifterNodeTempValue == 1 && pitchShifterNodeLoadStatus == 'connected') {
    disconnectPitchShifterNode()
  }
}
const connectPitchShifterNode = () => {
  console.log('connect Pitch Shifter Node')
  audio!.addEventListener('playing', connectNode)
  audio!.addEventListener('pause', disconnectNode)
  audio!.addEventListener('waiting', disconnectNode)
  audio!.addEventListener('emptied', disconnectNode)
  if (audio!.paused) disconnectNode()

  const lastBiquadFilter = biquads.get(`hz${freqs.at(-1)!}`)!
  lastBiquadFilter.disconnect()
  lastBiquadFilter.connect(pitchShifterNode)

  pitchShifterNode.connect(convolver)
  pitchShifterNode.connect(convolverSourceGainNode)
  // convolverDynamicsCompressor.disconnect(panner)
  // convolverDynamicsCompressor.connect(pitchShifterNode)
  // pitchShifterNode.connect(panner)
  pitchShifterNodeLoadStatus = 'connected'
  pitchShifterNodePitchFactor!.value = pitchShifterNodeTempValue
}
const disconnectPitchShifterNode = () => {
  console.log('disconnect Pitch Shifter Node')
  const lastBiquadFilter = biquads.get(`hz${freqs.at(-1)!}`)!
  lastBiquadFilter.disconnect()
  lastBiquadFilter.connect(convolver)
  lastBiquadFilter.connect(convolverSourceGainNode)
  pitchShifterNodeLoadStatus = 'unconnect'
  pitchShifterNodePitchFactor = null

  audio!.removeEventListener('playing', connectNode)
  audio!.removeEventListener('pause', disconnectNode)
  audio!.removeEventListener('waiting', disconnectNode)
  audio!.removeEventListener('emptied', disconnectNode)
  connectNode()
}
const loadPitchShifterNode = () => {
  pitchShifterNodeLoadStatus = 'loading'
  initAdvancedAudioFeatures()
  // source -> analyser -> biquadFilter -> audioWorklet(pitch shifter) -> [(convolver & convolverSource)->convolverDynamicsCompressor] -> panner -> gain
  void audioContext.audioWorklet
    .addModule(
      new URL(
        /* webpackChunkName: 'pitch_shifter.audioWorklet' */
        './pitch-shifter/phase-vocoder.js',
        import.meta.url
      )
    )
    .then(() => {
      console.log('pitch shifter audio worklet loaded')
      // https://github.com/olvb/phaze/issues/26#issuecomment-1574629971
      pitchShifterNode = new AudioWorkletNode(audioContext, 'phase-vocoder-processor', {
        outputChannelCount: [2],
      })
      let pitchFactorParam = pitchShifterNode.parameters.get('pitchFactor')
      if (!pitchFactorParam) return
      pitchShifterNodePitchFactor = pitchFactorParam
      pitchShifterNodeLoadStatus = 'unconnect'
      if (pitchShifterNodeTempValue == 1) return

      connectPitchShifterNode()
    })
}

export const setPitchShifter = (val: number) => {
  // console.log('setPitchShifter', val)
  pitchShifterNodeTempValue = val
  switch (pitchShifterNodeLoadStatus) {
    case 'loading':
      break
    case 'none':
      loadPitchShifterNode()
      break
    case 'connected':
      // a: 1 = 半音
      // value = 2 ** (a / 12)
      pitchShifterNodePitchFactor!.value = val
      break
    case 'unconnect':
      connectPitchShifterNode()
      break
  }
}

export const hasInitedAdvancedAudioFeatures = (): boolean => audioContext != null

// ============ 双Audio无缝切换系统 ============

/**
 * 获取下一个待用的audio元素 (用于预加载)
 */
export const getNextAudio = (): HTMLAudioElementChrome | null => {
  return currentAudioId === 'A' ? audioB : audioA
}

/**
 * 获取当前活跃的audio ID
 */
export const getCurrentAudioId = (): 'A' | 'B' => {
  return currentAudioId
}

/**
 * 预加载下一首歌曲到备用audio
 * @param src 音频URL
 */
export const preloadNextMusic = (src: string) => {
  const nextAudio = getNextAudio()
  if (!nextAudio) return

  console.log(`Preloading next music to audio${currentAudioId === 'A' ? 'B' : 'A'}`)

  // 关键修复确保预加载时不会自动播放
  nextAudio.autoplay = false
  nextAudio.src = src
  nextAudio.load()  // 强制开始加载
}

/**
 * 切换到下一个audio (无缝切换核心函数)
 * @returns 是否切换成功
 */
export const switchToNextAudio = (): boolean => {
  const nextAudio = getNextAudio()
  const nextAudioId = currentAudioId === 'A' ? 'B' : 'A'

  console.log(`🔄 Attempting to switch to audio${nextAudioId}`)
  console.log(`   Next audio exists: ${!!nextAudio}`)
  console.log(`   Next audio src: ${nextAudio?.src ? nextAudio.src.substring(0, 50) + '...' : 'EMPTY'}`)

  if (!nextAudio || !nextAudio.src) {
    console.warn(`❌ Next audio not ready for switch (audio${nextAudioId})`)
    return false
  }

  // 如果AudioContext已初始化,切换mediaSource连接
  if (audioContext && mediaSourceA && mediaSourceB) {
    const currentMediaSource = mediaSource
    const nextMediaSource = currentAudioId === 'A' ? mediaSourceB : mediaSourceA

    // 断开当前mediaSource
    currentMediaSource.disconnect()

    // 连接下一个mediaSource
    nextMediaSource.connect(analyser)
    mediaSource = nextMediaSource

    console.log(`🔊 Switched AudioContext connection to audio${nextAudioId}`)
  }

  // 关键修复立即完全停止当前audio，避免两个音轨同时播放
  const currentAudio = audio
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0  // 重置播放位置
    currentAudio.autoplay = false // 重置autoplay，防止下次预加载时自动播放
    currentAudio.src = ''          // 立即清空src（不延迟）
    currentAudio.removeAttribute('src')
    console.log(`🧹 Immediately stopped and cleaned up audio${currentAudioId}`)
  }

  // 切换到下一个audio
  audio = nextAudio
  currentAudioId = currentAudioId === 'A' ? 'B' : 'A'

  console.log(`✅ Switched to audio${currentAudioId}, starting playback`)

  // 立即播放下一个audio
  nextAudio.autoplay = true
  void nextAudio.play().catch(err => {
    console.error('❌ Failed to auto-play next audio:', err)
  })

  return true
}

/**
 * 清空下一个audio的资源
 */
export const clearNextAudio = () => {
  const nextAudio = getNextAudio()
  if (nextAudio && nextAudio.src) {
    nextAudio.pause()
    nextAudio.autoplay = false  // 重置autoplay
    nextAudio.src = ''
    nextAudio.removeAttribute('src')
    console.log(`Cleared next audio${currentAudioId === 'A' ? 'B' : 'A'}`)
  }
}

// ============================================

export const setResource = (src: string) => {
  if (audio) audio.src = src
}

export const setPlay = () => {
  void audio?.play()
}

export const setPause = () => {
  audio?.pause()
}

export const setStop = () => {
  if (audio) {
    audio.src = ''
    audio.removeAttribute('src')
  }
}

export const isEmpty = (): boolean => !audio?.src

export const setLoopPlay = (isLoop: boolean) => {
  if (audio) audio.loop = isLoop
}

export const getPlaybackRate = (): number => {
  return audio?.defaultPlaybackRate ?? 1
}

export const setPlaybackRate = (rate: number) => {
  if (!audio) return
  audio.defaultPlaybackRate = rate
  audio.playbackRate = rate
}

export const setPreservesPitch = (preservesPitch: boolean) => {
  if (!audio) return
  audio.preservesPitch = preservesPitch
}

export const getMute = (): boolean => {
  return audio?.muted ?? false
}

export const setMute = (isMute: boolean) => {
  if (audio) audio.muted = isMute
}

export const getCurrentTime = () => {
  return audio?.currentTime || 0
}

export const setCurrentTime = (time: number) => {
  if (audio) audio.currentTime = time
}

export const setMediaDeviceId = async (mediaDeviceId: string): Promise<void> => {
  if (!audio) return
  return audio.setSinkId(mediaDeviceId)
}

export const setVolume = (volume: number) => {
  if (audio) audio.volume = volume
}

export const getDuration = () => {
  return audio?.duration || 0
}

// export const getPlaybackRate = () => {
//   return audio?.playbackRate ?? 1
// }

type Noop = () => void

// 双Audio事件监听 - 同时监听两个audio元素
// 优化传递audioId参数，让回调函数能识别是哪个audio触发的事件
type AudioEventCallback = (audioId?: 'A' | 'B') => void

export const onPlaying = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('playing', handlerA)
  audioB.addEventListener('playing', handlerB)
  return () => {
    audioA?.removeEventListener('playing', handlerA)
    audioB?.removeEventListener('playing', handlerB)
  }
}

export const onPause = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('pause', handlerA)
  audioB.addEventListener('pause', handlerB)
  return () => {
    audioA?.removeEventListener('pause', handlerA)
    audioB?.removeEventListener('pause', handlerB)
  }
}

export const onEnded = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('ended', handlerA)
  audioB.addEventListener('ended', handlerB)
  return () => {
    audioA?.removeEventListener('ended', handlerA)
    audioB?.removeEventListener('ended', handlerB)
  }
}

export const onError = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('error', handlerA)
  audioB.addEventListener('error', handlerB)
  return () => {
    audioA?.removeEventListener('error', handlerA)
    audioB?.removeEventListener('error', handlerB)
  }
}

export const onLoadeddata = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('loadeddata', handlerA)
  audioB.addEventListener('loadeddata', handlerB)
  return () => {
    audioA?.removeEventListener('loadeddata', handlerA)
    audioB?.removeEventListener('loadeddata', handlerB)
  }
}

export const onLoadstart = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('loadstart', handlerA)
  audioB.addEventListener('loadstart', handlerB)
  return () => {
    audioA?.removeEventListener('loadstart', handlerA)
    audioB?.removeEventListener('loadstart', handlerB)
  }
}

export const onCanplay = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('canplay', handlerA)
  audioB.addEventListener('canplay', handlerB)
  return () => {
    audioA?.removeEventListener('canplay', handlerA)
    audioB?.removeEventListener('canplay', handlerB)
  }
}

export const onEmptied = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('emptied', handlerA)
  audioB.addEventListener('emptied', handlerB)
  return () => {
    audioA?.removeEventListener('emptied', handlerA)
    audioB?.removeEventListener('emptied', handlerB)
  }
}

export const onTimeupdate = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('timeupdate', handlerA)
  audioB.addEventListener('timeupdate', handlerB)
  return () => {
    audioA?.removeEventListener('timeupdate', handlerA)
    audioB?.removeEventListener('timeupdate', handlerB)
  }
}

// 缓冲中
export const onWaiting = (callback: AudioEventCallback) => {
  if (!audioA || !audioB) throw new Error('audio not defined')

  const handlerA = () => callback('A')
  const handlerB = () => callback('B')

  audioA.addEventListener('waiting', handlerA)
  audioB.addEventListener('waiting', handlerB)
  return () => {
    audioA?.removeEventListener('waiting', handlerA)
    audioB?.removeEventListener('waiting', handlerB)
  }
}

// 可见性改变
export const onVisibilityChange = (callback: Noop) => {
  document.addEventListener('visibilitychange', callback)
  return () => {
    document.removeEventListener('visibilitychange', callback)
  }
}

export const getErrorCode = () => {
  return audio?.error?.code
}
