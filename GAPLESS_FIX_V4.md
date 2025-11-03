# 无缝播放优化 V4 - 终极修复

## 问题分析

从日志发现：即使跳过了 `pause()` 调用，仍然有停顿声，原因是：

```
index.ts:694 ⏮️ Resetting audioB to start (from 2.09s)  ← 触发 seeking
usePlayerEvent.ts:92 [ACTIVE] onWaiting (during crossfade - skipping pause)
```

**根本原因**：`currentTime = 0` 的 seeking 操作本身会导致音频短暂中断，即使数据已缓存。

## V4 解决方案：避免切换时的 seeking

### 核心策略

**预加载阶段**：
1. 播放 200ms 静音音频（强制浏览器解码）
2. 暂停音频
3. 重置 `currentTime = 0`（在暂停状态下完成 seeking）
4. 保持暂停状态，等待切换

**切换阶段**：
1. 验证 `currentTime` 已经接近 0（< 0.05s）
2. 直接 `play()`（无需 seeking）
3. 开始 crossfade（500ms）

### 关键优化点

1. **预加载时的 seeking 不影响用户体验**
   - 在暂停状态下重置 currentTime
   - 用户听不到预加载 audio 的声音

2. **切换时避免 seeking**
   - currentTime 已经是 0
   - 直接播放，无延迟

3. **crossfade 期间忽略 pause()**
   - 即使触发 onWaiting，previousAudio 继续播放
   - 500ms crossfade 覆盖短暂的缓冲延迟

## 代码修改

### 1. `src/renderer/plugins/player/index.ts`

**预加载逻辑**：
```typescript
// 播放 200ms 后暂停并重置
setTimeout(() => {
  if (nextAudio.src) {
    nextAudio.pause()
    nextAudio.currentTime = 0  // seeking 在暂停状态下完成
    nextAudio.muted = false
    console.log(`🎯 Audio${nextAudioId} preloaded and ready at currentTime=0`)
  }
}, 200)
```

**切换逻辑**：
```typescript
// 验证 currentTime 接近 0
if (nextAudio.currentTime > 0.05) {
  console.warn(`⚠️ Next audio currentTime not at 0, resetting...`)
  nextAudio.currentTime = 0
}

// 直接播放（无 seeking）
nextAudio.play().then(() => {
  startCrossfade()
})
```

### 2. `src/renderer/core/useApp/usePlayer/usePlayerEvent.ts`

**onWaiting 处理**：
```typescript
if (isCrossfading()) {
  console.log(`[ACTIVE] onWaiting (during crossfade - skipping pause)`)
  window.app_event.playerWaiting()  // 只显示状态
  return  // 不调用 pause()
}
```

## 预期效果

- ✅ 切换时无 seeking 操作
- ✅ 即使触发 onWaiting，延迟极短（< 50ms）
- ✅ previousAudio 在 crossfade 期间持续播放
- ✅ 用户体验：平滑过渡，无停顿

## 测试要点

1. 观察日志中是否出现 "already near start" 或 "not at 0"
2. 检查 crossfade 期间是否有 "skipping pause"
3. 验证切换时是否仍有停顿声
4. 测试不同网络条件下的表现

## 版本历史

- **V1**: 静音播放 + 定期重置 currentTime
  - 问题：切换时仍需重置，触发 seeking

- **V2**: 增加重置频率（3s → 1s，阈值 5s → 0.5s）
  - 问题：仍可能在 0.5s-1s 间隔切换，需要重置

- **V3**: 在 onWaiting 中跳过 pause() 调用
  - 问题：seeking 本身仍导致音频中断

- **V4**: 预加载后暂停在 currentTime=0，切换时直接播放
  - 理论上完美：无 seeking，无停顿

## 日期

2025-01-03
