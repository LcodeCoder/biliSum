---
name: BiliSum
description: 手绘笔记本风格的视频学习工作台
colors:
  paper: '#fffef5'
  ink: '#2c2c2c'
  muted: '#626258'
  line: '#aaa99a'
  line-soft: '#deddd0'
  accent: '#236e68'
  accent-soft: '#d9efdf'
  marker-red: '#ff6b6b'
  marker-teal: '#4ecdc4'
  marker-yellow: '#ffd93d'
  eye-paper: '#f5efdc'
  eye-ink: '#38322b'
  dark-paper: '#262923'
  dark-ink: '#f0eddd'
typography:
  title:
    fontFamily: "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '21px'
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '14px'
    lineHeight: 1.85
  control:
    fontFamily: "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '12px'
    lineHeight: 1.5
  map-root:
    fontFamily: "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '20px'
    fontWeight: 700
    lineHeight: '28px'
  map-topic:
    fontFamily: "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '16px'
    fontWeight: 650
    lineHeight: '24px'
  map-detail:
    fontFamily: "'BiliSum Hand', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: '20px'
rounded:
  control: '4px'
  paper: '3px 6px 4px 5px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '18px'
  xl: '22px'
components:
  button:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.control}'
    rounded: '{rounded.paper}'
    padding: '6px 10px'
    height: '34px'
  button-primary:
    backgroundColor: '{colors.marker-yellow}'
    textColor: '{colors.ink}'
    typography: '{typography.control}'
    rounded: '{rounded.paper}'
    padding: '6px 10px'
  field:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.control}'
    rounded: '{rounded.control}'
    padding: '7px 12px'
    height: '36px'
  reading-paper:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.paper}'
    padding: '18px'
---

# Design System: BiliSum

## Overview

**手绘涂鸦风（Hand-Drawn Doodle）。** 页面像一本可操作的学习笔记：暖纸、墨色文字、细虚线和红／蓝绿／黄记号笔点缀。胶带和微小旋转只出现在少量纸片与当前选项上，正文保持清楚、稳定。实现来源是 `src/lib/theme.ts`、`entrypoints/sidepanel/style.css`、`src/lib/mindmap.ts` 与 `src/lib/html-report.ts`。

## Colors

浅色使用奶白纸与墨黑。Marker 色用于胶带、选中底、曲线和硬偏移影；链接和较小文字使用对比度更高的 `accent`。护眼与深色从同一主题表读取纸色、文字和三种 marker，屏幕、SVG／PNG 与离线 HTML 共享这些颜色。横线背景用本地 SVG，不用渐变。

## Typography

正文、标题、代码与数值统一使用本地 `BiliSum Hand`，缺字回退到苹方、微软雅黑和 sans-serif。字体来自重命名后的 LXGW WenKai Lite 子集；保留 OFL 许可，Regular 字重使用 `font-synthesis: weight`。阅读正文为 14px／1.85；页面标题约 19–24px，HTML 节标题 20px。长文行宽上限 72ch。导图测量前等待字体加载，导出内嵌相同字体，避免节点边界和文字错位。

## Layout

支持 280px 侧栏至 1200px 工作台。应用容器达到 640px 时，视频来源成为左侧轨；335px 及以下收紧工具间距，保留全部操作。短窗口允许内容滚动，不裁掉操作。HTML 卡片版在 760px 以下为单列，宽屏双列自然排布；长文版保留目录与连续阅读。

导图始终向右展开：中心至一级主题间距 80px，之后每级 44px；只有中心使用纸片形节点，普通节点为文字和彩色下划线。窄屏初始相机优先保留可读比例，允许拖动查看右侧分支，并提供适应画布与主题筛选。屏幕折叠不删减完整导出。

## Elevation & Depth

表面以细虚线和留白组织。常用按钮的硬偏移影为 2px，hover 改为 3px 黄 marker；阅读纸片按场景使用 3–4px 偏移。影子模糊为 0，不使用内凹或环境软影。字段用虚线焦点轮廓，不靠阴影表达输入状态。

## Shapes

圆角基准 4px，纸片用轻微不对称的 3px／6px／4px／5px 角。常规边界为 1–1.5px 虚线，离线纸片为 2px 虚线。红色波浪下划线标记标题，黄色胶带仅作少量装饰。不要把每行正文、每个子节点都包成卡片。

## Components

按钮 hover 可轻微旋转，active 压平偏移影并缩小至约 0.98；字段、选项和键盘焦点保留清晰轮廓。颜色过渡约 180ms，姿态变化采用短步进；reduced-motion 下停用动画、过渡和平滑滚动。选中态除颜色外还保留边框或图标。表格和代码在局部区域横向滚动，页面本身不得横向溢出。

保留浅色、护眼、深色三种外观以及生成、重试、搜索、字幕显示、导出等完整路径。错误与禁用状态沿用同一纸张语言。禁止渐变、模糊软影、厚实线、大圆角和等宽字体。
