# WebGL2 Support Fix for Flowing Glow Background

## Problem Description
The flowing glow background effect was failing with error:
```
Failed to initialize flowing glow background: Error: WebGL2 not supported
```

## Root Cause Analysis
1. **Electron Configuration Issue**: In `src/main/modules/winMain/main.ts`, WebGL was explicitly disabled:
   ```typescript
   webgl: false  // Line 97
   ```

2. **Missing WebGL Detection**: The `FlowingGlowBackground.vue` component had no WebGL compatibility checking before initialization.

3. **No Fallback Mechanism**: When WebGL failed, there was no graceful degradation to static background.

## Fixes Applied

### 1. Enable WebGL in Electron (src/main/modules/winMain/main.ts)
**Changed line 97:**
```typescript
// Before
webgl: false,

// After
webgl: true, // 启用WebGL以支持流光溢彩背景效果
```

### 2. Add WebGL Detection (src/renderer/components/layout/PlayDetail/components/FlowingGlowBackground.vue)

**Added WebGL Support Checking Function:**
```typescript
const checkWebGLSupport = (): { webgl1: boolean; webgl2: boolean } => {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
  const gl2 = canvas.getContext('webgl2')

  return {
    webgl1: !!gl,
    webgl2: !!gl2,
  }
}
```

**Modified Initialization Logic:**
- Check WebGL2 support before attempting to create renderer
- Emit `webgl-not-supported` event if WebGL2 is unavailable
- Emit `init-failed` event if initialization throws an error
- Emit `init-success` event when successfully initialized
- Track WebGL support state with `isWebGLSupported` ref
- Guard all renderer operations with `isWebGLSupported` check

**Component Events:**
```typescript
emits: ['webgl-not-supported', 'init-failed', 'init-success']
```

**Enhanced Error Messages:**
```typescript
if (!webglSupport.webgl2) {
  const supportInfo = webglSupport.webgl1
    ? 'WebGL 1.0 is supported, but WebGL 2.0 is required for flowing glow background'
    : 'WebGL is not supported by your system'

  console.warn(`[FlowingGlowBackground] ${supportInfo}. Falling back to static background.`)
}
```

### 3. Implement Fallback in Parent Component (src/renderer/components/layout/PlayDetail/index.vue)

**Added State Tracking:**
```typescript
const webglSupported = ref(true) // Track WebGL support status
```

**Added Event Handlers:**
```typescript
const handleWebGLNotSupported = (info) => {
  console.warn('[PlayDetail] WebGL not supported, using static background:', info)
  webglSupported.value = false
}

const handleFlowingGlowInitFailed = (error) => {
  console.error('[PlayDetail] Flowing glow background init failed:', error)
  webglSupported.value = false
}

const handleFlowingGlowInitSuccess = () => {
  console.log('[PlayDetail] Flowing glow background initialized successfully')
  webglSupported.value = true
}
```

**Updated Template:**
```pug
//- Flowing glow background with event handlers
flowing-glow-background(
  v-if="appSetting['player.flowingGlowBackground'] && visibled && musicInfo.pic"
  :album="musicInfo.pic"
  :fps="60"
  :flow-speed="1"
  :render-scale="0.5"
  :has-lyric="true"
  @webgl-not-supported="handleWebGLNotSupported"
  @init-failed="handleFlowingGlowInitFailed"
  @init-success="handleFlowingGlowInitSuccess"
)

//- Static background fallback
div(v-if="!appSetting['player.flowingGlowBackground'] || !webglSupported" :class="$style.bg")
```

## Testing

### Build Verification
```bash
npm run build:renderer
```
✅ Compilation successful without errors

### Expected Behavior

**Scenario 1: WebGL2 Supported**
- Console log: `[FlowingGlowBackground] Successfully initialized with WebGL2`
- Flowing glow background renders correctly
- Dynamic background effects work as expected

**Scenario 2: WebGL2 Not Supported**
- Console warning: `[FlowingGlowBackground] WebGL is not supported by your system. Falling back to static background.`
- Static background (.bg) is displayed automatically
- No errors or crashes
- User experience remains functional

**Scenario 3: Initialization Failure**
- Console error with detailed error information
- Automatic fallback to static background
- Graceful degradation without user interruption

## Files Modified

1. ✅ `src/main/modules/winMain/main.ts` - Enabled WebGL support
2. ✅ `src/renderer/components/layout/PlayDetail/components/FlowingGlowBackground.vue` - Added WebGL detection and error handling
3. ✅ `src/renderer/components/layout/PlayDetail/index.vue` - Implemented fallback mechanism

## Benefits

1. **Robustness**: System no longer crashes when WebGL2 is unavailable
2. **User Experience**: Automatic fallback ensures uninterrupted playback
3. **Debugging**: Clear console messages help identify issues
4. **Compatibility**: Works on systems with varying GPU capabilities
5. **Graceful Degradation**: Users without WebGL2 get static background instead of errors

## Notes

- WebGL2 is required by the AppleMusic-like-lyrics library for optimal visual effects
- Systems without WebGL2 support will automatically use traditional static backgrounds
- The fix maintains backward compatibility while adding modern features
- No changes required to user settings or configuration
