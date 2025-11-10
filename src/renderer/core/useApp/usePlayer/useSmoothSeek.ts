import { ref, onBeforeUnmount } from 'vue'
import { getCurrentTime, getDuration, setPause, setPlay } from '@renderer/plugins/player'
import { appSetting } from '@renderer/store/setting'
import { isPlay } from '@renderer/store/player/state'

// Long press detection threshold (milliseconds)
const LONG_PRESS_THRESHOLD = 300

// Smooth seek interval speed (milliseconds) - reduced for smoother experience
const SMOOTH_SEEK_INTERVAL = 100

// Seek increment per step (seconds) - now configurable from settings
const getSeekStep = () => appSetting['player.seekStep'] || 3

// Smooth seek step - larger increment for better performance
const SMOOTH_SEEK_STEP = 1.0

// Long press state management
interface LongPressState {
  isLongPressing: boolean
  timer: NodeJS.Timeout | null
  intervalTimer: NodeJS.Timeout | null
  direction: 'forward' | 'backward' | null
  startTime: number
  wasPlaying: boolean  // Track if audio was playing before long press
}

export default () => {
  const longPressState = ref<LongPressState>({
    isLongPressing: false,
    timer: null,
    intervalTimer: null,
    direction: null,
    startTime: 0,
    wasPlaying: false,
  })

  // Perform smooth seek
  const performSeek = (direction: 'forward' | 'backward') => {
    const curTime = getCurrentTime()
    const duration = getDuration()

    let newTime: number
    if (direction === 'forward') {
      newTime = Math.min(curTime + SMOOTH_SEEK_STEP, duration)
    } else {
      newTime = Math.max(curTime - SMOOTH_SEEK_STEP, 0)
    }

    // Only update if there's a meaningful change
    if (Math.abs(newTime - curTime) >= 0.01) {
      window.app_event.setProgress(newTime)
    }
  }

  // Start smooth seeking
  const startSmoothSeek = (direction: 'forward' | 'backward') => {
    if (longPressState.value.isLongPressing) return

    longPressState.value.isLongPressing = true
    longPressState.value.direction = direction

    // Remember if audio was playing
    longPressState.value.wasPlaying = isPlay.value

    // Pause audio during long press seek to prevent audio glitches
    if (longPressState.value.wasPlaying) {
      setPause()
    }

    console.log(`Starting smooth ${direction} seek (paused: ${longPressState.value.wasPlaying})`)

    // Immediately perform first seek
    performSeek(direction)

    // Start interval for continuous seeking
    longPressState.value.intervalTimer = setInterval(() => {
      performSeek(direction)
    }, SMOOTH_SEEK_INTERVAL)
  }

  // Stop smooth seeking
  const stopSmoothSeek = () => {
    if (!longPressState.value.isLongPressing) return

    console.log('Stopping smooth seek')

    // Clear interval timer
    if (longPressState.value.intervalTimer) {
      clearInterval(longPressState.value.intervalTimer)
      longPressState.value.intervalTimer = null
    }

    // Resume playback if it was playing before
    if (longPressState.value.wasPlaying) {
      setTimeout(() => {
        setPlay()
      }, 50)  // Small delay to ensure seek operation completes
    }

    // Reset state
    longPressState.value.isLongPressing = false
    longPressState.value.direction = null
    longPressState.value.wasPlaying = false
  }

  // Check if user is currently editing (input/textarea focused)
  const isEditing = (event?: LX.KeyDownEevent['event']): boolean => {
    if (!event?.target) return false
    const target = event.target as HTMLElement

    if (target.classList.contains('key-bind')) return false

    switch (target.tagName) {
      case 'INPUT':
      case 'SELECT':
      case 'TEXTAREA':
        return true
      default:
        return !!target.isContentEditable
    }
  }

  // Handle key down event (detect long press)
  const handleKeyDown = (direction: 'forward' | 'backward', event?: LX.KeyDownEevent) => {
    // Ignore if user is editing
    if (event && isEditing(event.event)) {
      return
    }

    // If already long pressing this direction, do nothing
    if (longPressState.value.isLongPressing && longPressState.value.direction === direction) {
      return
    }

    // If pressing different direction, stop current long press
    if (longPressState.value.isLongPressing && longPressState.value.direction !== direction) {
      stopSmoothSeek()
    }

    // Clear existing timer if any
    if (longPressState.value.timer) {
      clearTimeout(longPressState.value.timer)
    }

    // Record start time
    longPressState.value.startTime = Date.now()

    // Set timer to detect long press
    longPressState.value.timer = setTimeout(() => {
      startSmoothSeek(direction)
    }, LONG_PRESS_THRESHOLD)
  }

  // Handle key up event
  const handleKeyUp = (direction: 'forward' | 'backward', event?: LX.KeyDownEevent) => {
    // Ignore if user is editing
    if (event && isEditing(event.event)) {
      return
    }

    const pressDuration = Date.now() - longPressState.value.startTime

    // Clear long press detection timer
    if (longPressState.value.timer) {
      clearTimeout(longPressState.value.timer)
      longPressState.value.timer = null
    }

    // If it was a long press, just stop smooth seek
    if (longPressState.value.isLongPressing) {
      stopSmoothSeek()
      return
    }

    // If it was a short press, perform normal jump with configured seek step
    if (pressDuration < LONG_PRESS_THRESHOLD) {
      const seekOffset = getSeekStep()
      const curTime = getCurrentTime()
      const time = direction === 'forward'
        ? Math.min(curTime + seekOffset, getDuration())
        : Math.max(curTime - seekOffset, 0)

      if (Math.trunc(curTime) !== Math.trunc(time)) {
        window.app_event.setProgress(time)
      }
    }
  }

  // Export handlers for forward/backward
  const handleSeekForwardDown = (event?: LX.KeyDownEevent) => handleKeyDown('forward', event)
  const handleSeekBackwardDown = (event?: LX.KeyDownEevent) => handleKeyDown('backward', event)
  const handleSeekForwardUp = (event?: LX.KeyDownEevent) => handleKeyUp('forward', event)
  const handleSeekBackwardUp = (event?: LX.KeyDownEevent) => handleKeyUp('backward', event)

  // Register event listeners
  window.key_event.on('key_arrowright_down', handleSeekForwardDown)
  window.key_event.on('key_arrowright_up', handleSeekForwardUp)
  window.key_event.on('key_arrowleft_down', handleSeekBackwardDown)
  window.key_event.on('key_arrowleft_up', handleSeekBackwardUp)

  // Cleanup on unmount
  onBeforeUnmount(() => {
    // Stop any ongoing smooth seek
    stopSmoothSeek()

    // Clear any pending timers
    if (longPressState.value.timer) {
      clearTimeout(longPressState.value.timer)
    }

    // Unregister event listeners
    window.key_event.off('key_arrowright_down', handleSeekForwardDown)
    window.key_event.off('key_arrowright_up', handleSeekForwardUp)
    window.key_event.off('key_arrowleft_down', handleSeekBackwardDown)
    window.key_event.off('key_arrowleft_up', handleSeekBackwardUp)
  })

  return {
    isLongPressing: longPressState,
  }
}
