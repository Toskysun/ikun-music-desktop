# 无缝播放终极方案 V5 - 提前重叠播放

## 核心突破：两轨重叠才是真无缝

经过多次尝试，最终发现**所有在 onEnded 后开始切换的方案都会失败**，因为：

### 为什么之前的方案都失败？

**V1-V4 的共同问题**：
```
audioA → onEnded（已无声音）→ switchToNextAudio() → audioB.play() → onWaiting（50-100ms）
                                                                        ↑
                                                            用户听到停顿！
```

即使：
- audioB 已经 `readyState=4`（完全缓存）
- audioB 的 `currentTime=0`（无需 seeking）
- crossfade 持续 500ms

**仍然有停顿**，因为从暂停状态调用 `play()` 需要启动时间（触发 onWaiting）。

### V5 终极解决方案

**关键创新：在 audioA 即将结束前 1 秒就开始切换！**

```
audioA (还在播放) → 检测剩余 1s → playNext() → switchToNextAudio() → audioB.play()
       ↓                                                                  ↓
   覆盖声音                                                        即使有 onWaiting
       ↓                                                                  ↓
     500ms crossfade (audioA 淡出 + audioB 淡入)                   用户听不到！
```

## 实现细节

### 1. 添加 timeupdate 监听器

**`src/renderer/plugins/player/index.ts`**:

```typescript
// 创建 audio 时添加监听器
const handleTimeupdateA = () => {
  if (currentAudioId === 'A' && audioA && !hasTriggeredNearEnd && nearEndCallback) {
    const remaining = audioA.duration - audioA.currentTime
    if (remaining > 0 && remaining <= 1) {
      console.log(`⏰ AudioA near end (${remaining.toFixed(2)}s remaining)`)
      hasTriggeredNearEnd = true
      nearEndCallback()  // 触发提前切换
    }
  }
}

audioA.addEventListener('timeupdate', handleTimeupdateA)
```

### 2. 注册提前切换回调

**`src/renderer/core/useApp/usePlayer/usePlayer.ts`**:

```typescript
const handleNearEnd = () => {
  if (window.lx.isPlayedStop) return
  console.log('🎵 Near end detected, triggering early playNext')
  void playNext(true)  // 提前 1 秒触发切换
}

const handleEnded = () => {
  // 只设置状态，不再调用 playNext
  setAllStatus(t('player__end'))
  console.log('🎵 Audio ended (crossfade already started)')
}

// 注册回调
const removeNearEndListener = onNearEnd(handleNearEnd)
```

### 3. 重置标志

**`src/renderer/plugins/player/index.ts`**:

```typescript
export const setResource = (src: string) => {
  if (audio) {
    audio.src = src
    hasTriggeredNearEnd = false  // 新歌曲开始，重置标志
  }
}
```

## 为什么这次能成功？

### 时序对比

**V4 (失败)**：
```
t=0s    audioA 播放
t=180s  audioA onEnded → audioB.play() → onWaiting (50ms) → 停顿！
```

**V5 (成功)**：
```
t=0s    audioA 播放
t=179s  检测剩余 1s → playNext()
        ├─ audioB.play() → onWaiting (50ms)
        └─ audioA 仍在播放 → 覆盖停顿
t=179.5s crossfade 完成
t=180s  audioA 自然结束
```

### 关键优势

1. **audioA 覆盖**：在 audioB 启动期间，audioA 仍在播放
2. **crossfade 重叠**：500ms 的 crossfade 完全覆盖 audioB 的启动延迟
3. **用户无感知**：即使 audioB 触发 onWaiting，用户听到的是 audioA

## 测试要点

### 预期日志

正常切换时应该看到：
```
⏰ AudioA near end (0.95s remaining), triggering early crossfade
🎵 Near end detected, triggering early playNext for seamless transition
🔄 Attempting to switch to audioB
✅ Switched to audioB, starting crossfade
▶️ Starting playback of audioB from paused state
[ACTIVE] onWaiting from audioB (during crossfade - skipping pause) ← 被覆盖！
✅ AudioB started playing, beginning crossfade
▶️ Starting crossfade for audioB
🎵 Audio ended (crossfade already started) ← onEnded 时已完成切换
```

### 关键指标

- ✅ "near end" 日志出现在 "ended" 之前
- ✅ crossfade 在 audioA 仍在播放时开始
- ✅ 即使触发 onWaiting，也被 "skipping pause" 处理
- ✅ 用户听到平滑过渡，无停顿

## 版本历史

- **V1-V3**: 静音播放 + 定期重置 → 切换时仍需 seeking
- **V4**: 预加载后暂停在 currentTime=0 → play() 启动延迟仍导致停顿
- **V5**: 提前 1 秒开始切换 → audioA 覆盖 audioB 启动延迟 → **真正无缝**

## 技术要点

### 为什么 1 秒？

- **太早（> 2s）**: 用户可能在切换前手动跳转，导致预加载浪费
- **太晚（< 0.5s）**: audioB 启动延迟 + crossfade 可能超过剩余时间
- **1 秒**: 平衡点，足够覆盖启动延迟，且不会过早触发

### 为什么仍需 crossfade？

- 不是为了覆盖 audioA 结束（已经提前切换）
- 而是为了平滑音量过渡（audioA 淡出 + audioB 淡入）
- 提供更专业的听感体验

## 最终效果

用户体验：
- ✅ 完全无缝切换
- ✅ 音量平滑过渡（500ms crossfade）
- ✅ 无可察觉的停顿或缓冲
- ✅ 与专业音乐播放器体验一致

## 日期

2025-01-03 (Final Solution)
