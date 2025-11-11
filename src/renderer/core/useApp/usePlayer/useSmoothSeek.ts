import { ref, onBeforeUnmount } from 'vue'
import { getCurrentTime, getDuration, setPause, setPlay } from '@renderer/plugins/player'
import { appSetting } from '@renderer/store/setting'
import { isPlay } from '@renderer/store/player/state'

// Long press detection threshold (milliseconds)
const LONG_PRESS_THRESHOLD = 300

// Seek increment per step (seconds) - configurable from settings
const getSeekStep = () => appSetting['player.seekStep'] || 3

// Acceleration curve parameters
const MIN_SPEED = 0.2  // Initial speed (seconds per update)
const MAX_SPEED = 2.0  // Maximum speed (seconds per update)
const ACCELERATION_DURATION = 2000  // Time to reach max speed (milliseconds)
const UPDATE_INTERVAL = 50  // Minimum interval between updates (milliseconds)

// Calculate seek speed based on elapsed time using smooth acceleration curve
const getSeekSpeed = (elapsedTime: number): number => {
  // Use quadratic function for smooth acceleration
  const progress = Math.min(elapsedTime / ACCELERATION_DURATION, 1)
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * progress * progress
}

// Long press state management
interface LongPressState {
  isLongPressing: boolean
  timer: NodeJS.Timeout | null
  animationFrameId: number | null
  direction: 'forward' | 'backward' | null
  startTime: number
  wasPlaying: boolean  // Track if audio was playing before long press
  lastUpdateTime: number  // Track last update timestamp for throttling
  longPressStartTime: number  // Track when long press actually started
}

export default () => {
  const longPressState = ref<LongPressState>({
    isLongPressing: false,
    timer: null,
    animationFrameId: null,
    direction: null,
    startTime: 0,
    wasPlaying: false,
    lastUpdateTime: 0,
    longPressStartTime: 0,
  })

  // Perform smooth seek with acceleration
  const performSeek = (currentTime: number) => {
    const state = longPressState.value
    if (!state.isLongPressing || !state.direction) return

    // Calculate elapsed time since long press started
    const elapsedTime = currentTime - state.longPressStartTime

    // Calculate time since last update
    const timeSinceLastUpdate = currentTime - state.lastUpdateTime

    // Throttle updates to minimum interval
    if (timeSinceLastUpdate < UPDATE_INTERVAL) {
      state.animationFrameId = requestAnimationFrame(performSeek)
      return
    }

    // Update last update timestamp
    state.lastUpdateTime = currentTime

    // Calculate seek speed based on elapsed time
    const seekSpeed = getSeekSpeed(elapsedTime)

    // Get current audio position
    const curTime = getCurrentTime()
    const duration = getDuration()

    // Calculate new time with acceleration
    let newTime: number
    if (state.direction === 'forward') {
      newTime = Math.min(curTime + seekSpeed, duration)
    } else {
      newTime = Math.max(curTime - seekSpeed, 0)
    }

    // Only update if there's a meaningful change
    if (Math.abs(newTime - curTime) >= 0.01) {
      window.app_event.setProgress(newTime)
    }

    // Continue animation loop
    state.animationFrameId = requestAnimationFrame(performSeek)
  }

  // Start smooth seeking with requestAnimationFrame
  const startSmoothSeek = (direction: 'forward' | 'backward') => {
    if (longPressState.value.isLongPressing) return

    const state = longPressState.value
    state.isLongPressing = true
    state.direction = direction
    state.longPressStartTime = performance.now()
    state.lastUpdateTime = state.longPressStartTime

    // Remember if audio was playing
    state.wasPlaying = isPlay.value

    // Pause audio during long press seek to prevent audio glitches
    if (state.wasPlaying) {
      setPause()
    }

    console.log(`Starting smooth ${direction} seek (paused: ${state.wasPlaying})`)

    // Start animation loop with requestAnimationFrame
    state.animationFrameId = requestAnimationFrame(performSeek)
  }

  // Stop smooth seeking
  const stopSmoothSeek = () => {
    const state = longPressState.value
    if (!state.isLongPressing) return

    console.log('Stopping smooth seek')

    // Cancel animation frame
    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId)
      state.animationFrameId = null
    }

    // Resume playback if it was playing before
    if (state.wasPlaying) {
      setTimeout(() => {
        setPlay()
      }, 50)  // Small delay to ensure seek operation completes
    }

    // Reset state
    state.isLongPressing = false
    state.direction = null
    state.wasPlaying = false
    state.lastUpdateTime = 0
    state.longPressStartTime = 0
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
