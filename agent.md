# Paper Pi 设计与实现细节记录

> 本文为工程当前状态的设计与实现概要（服务、数据流、接口、关键逻辑、已知约束）。

## 总体架构

- **后端**：Flask（`run.py` + `app/__init__.py` app factory）
- **前端**：原生 HTML/CSS/JS（`app/templates` + `app/static`）
- **显示**：`DisplayService` 根据 `RUN_MODE` 决定 matplotlib 预览或墨水屏驱动
- **数据存储**：JSON 文件（`storage/`）
- **图像生成**：DashScope API（`ImageGenService`），通过队列串行化
- **图片库**：本地 BMP 库（`pic/library`）+ 元数据（`storage/image_library.json`）

## 运行与配置

- 入口：`run.py`
  - 捕获 `SIGINT/SIGTERM`，退出时刷白图
- 配置集中：`app/config.py`
  - `RUN_MODE`, `SCREEN_WIDTH`, `SCREEN_HEIGHT`
  - DashScope：`DASHSCOPE_API_KEY`
  - 天气：`WEATHER_API_HOST`, `WEATHER_PEM_KEY`, `WEATHER_SUB_ID`, `WEATHER_KID_ID`
  - 中文字体可指定：`WEATHER_FONT_PATH`

## 主要服务与职责

### 1) DisplayService（`app/services/display_service.py`）

- `RUN_MODE=debug`：使用 matplotlib 预览
- `RUN_MODE=production`：使用墨水屏驱动（`lib/waveshare_epd/epd7in3e.py`）
- **不回退**：生产模式下驱动异常会抛错，不再自动切回 debug
- **内存优化**：实现 buffer 复用
  - 复用调色板 `P` 图像
  - 复用 `bytearray` 缓冲区
  - `_getbuffer_reuse()` 替代 `epd.getbuffer()`，降低 Zero 内存峰值

### 2) 播放服务 PlaybackService（`app/services/playback_service.py`）

- 服务器端循环播放 Playlist
- 通过 `display_time` 控制每个单元显示时长（`time.sleep(display_time)`）
- 播放状态持久化：`storage/playback_state.json`
- 异常打印：`Playback error for DU <id>: <error>`

### 3) ImageGenService + 队列（`app/services/image_gen_service.py`）

- 通过 `ImageGenQueueService` 串行化所有文生图请求
- API 行为保持同步返回，但内部排队执行

### 4) 图片库 ImageLibraryService（`app/services/image_library_service.py`）

- 上传任意图片并强制转换为 `800x480 BMP`
- 维护 `storage/image_library.json`
- 支持批量删除
- 支持占位图（生成中）与状态字段（`processing/ready/failed`）
- 支持 `update_item()` 用于异步更新生成结果

### 5) 天气服务 WeatherService（`app/services/weather_service.py`）

- `WEATHER_API_HOST` 自动补 schema（`https://`）
- JWT 认证：`WEATHER_PEM_KEY` + `WEATHER_SUB_ID` + `WEATHER_KID_ID`
- 外部 API 调用日志记录（`LOG/api.log`）

### 6) UPS 电量（INA219）

- Lib：`lib/ina219.py`
- Service：`app/services/ina219_service.py`
- debug 模式返回 100%

### 7) 日志 LoggingService（`app/services/logging_service.py`）

- 统一记录外部 API 调用结果：天气、文生图、风格化
- 日志文件：`LOG/api.log`

## 显示单元（Display Units）

### 1) EmptyDisplayUnit（空单元）

- 生成白图（屏幕尺寸）

### 2) ImageDisplayUnit（图片单元）

- 从图片库 ID 或本地路径加载图片
- 可选启用**颜色扩散算法**（Floyd-Steinberg + 6 色调色板）

### 3) TextToImageDisplayUnit（“每日一图”）

- 创建时设置提示词
- **每日仅生成一次**，当天复用缓存
- 修改提示词时强制重新生成
- 缓存记录在 `storage/weather_cache.json`（复用存储服务）
- 生成结果保存到图片库

### 4) WeatherDisplayUnit（天气单元）

- 使用天气 API 获取当日天气
- **每日首次调用**：生成新海诚风格背景 + 绘制天气信息，保存到图片库
- 当日再次调用：直接取缓存图片
- 生成过程异步：先创建“生成中”占位图，后台线程生成并更新
- 天气文字绘制：
  - 玻璃卡片 UI（半透明底）
  - 日期 / 天气描述 / 温湿度 / 风向风力 / 能见度
  - 中文字体支持（可指定 `WEATHER_FONT_PATH`）
  - 可选绘制 UPS 电量

### 5) PoetryDisplayUnit（唐诗绝句）

- 每次播放时调用 LLM 生成七言绝句（四句）
- 白底黑字，居中，一句一行
- 支持可选 `mood_prompt`（情绪/主题）

## 前端与交互

### 管理页 `/admin`

- Playlist 时间轴式 UI
  - 单元宽度按 `display_time` 比例映射（上限限制）
  - 支持拖拽排序
  - 当前播放高亮 + 发光动效
  - 右侧播放/删除图标按钮
- 单元详情编辑器
  - 点击单元可编辑名称/时长/提示词等
  - 预览图支持颜色扩散切换

### 图片库 `/library`

- 批量管理（选择/删除）
- 拖拽上传
- 详情页（路径、时间、风格化）
- 生成中/失败状态显示

### 图片预览

- 前端改为使用 `image_id` 请求后端文件流
- 预览接口：
  - `GET /api/image-preview/file?image_id=...&enable_color_diffusion=true|false`
- 所有图片 `src` 加 `?t=时间戳` 规避缓存
- 加载动画：`img-loading`（旋转指示器），失败显示占位样式
- 预览为“异步体验”：先显示原图，再覆盖扩散图

## API 接口概览（非完整）

### 显示单元

- `GET /api/display-units`
- `POST /api/display-units`
- `PUT /api/display-units/<du_id>`
- `GET /api/display-units/<du_id>/preview`

### 播放

- `POST /api/playlists/<id>/play`
- `POST /api/playlists/pause`
- `POST /api/playlists/stop`
- `GET /api/playlists/status`

### 图片库

- `GET /api/image-library`
- `GET /api/image-library/<image_id>`
- `GET /api/image-library/<image_id>/file`
- `POST /api/image-library/upload`
- `POST /api/image-library/batch-delete`
- `POST /api/image-library/<image_id>/stylize`（异步）

### 图片预览

- `GET /api/image-preview/file`

### 天气

- 通过 WeatherDisplayUnit 调用 Weather API（JWT）

## 已知约束/注意事项

- 生产模式下 EPD 初始化失败会抛错，不自动回退 debug
- 文生图/风格化走队列或后台线程，耗时长
- Zero 内存小：使用 buffer 复用减少峰值
- 图片缓存：所有图片 URL 加 `?t=` 防止浏览器缓存旧图
