# Paper Pi - 墨水屏智能应用

## 项目简介

Paper Pi 是一个基于 Flask 开发的墨水屏智能应用系统，支持多种显示单元类型，包括空单元、图片单元、文生图单元和天气单元。系统集成了阿里云 DashScope API，使用先进的 LLM 技术优化用户提示词并生成高质量图片，为墨水屏提供丰富的内容展示能力。

## 核心功能

### 1. 显示单元 (Display Unit)

- **空单元**：生成白色图片用于刷新墨水屏幕
- **图片单元**：从图片库选择静态图片显示，支持颜色扩散算法
- **文生图单元**：使用 LLM 优化用户提示词，生成图片并显示
- **天气单元**：根据地理位置获取今日天气，生成新海诚风格背景并叠加天气信息（当天首次生成并缓存）

### 2. 播放列表管理

- 支持创建多个播放列表
- 可将多个显示单元组合为一个播放列表
- 支持编辑和删除播放列表

### 3. 图片库

- 支持上传任意图片并自动转换为 800x480 BMP
- 支持批量管理（批量选择与删除）
- 支持图片详情页查看存储路径与时间
- 支持风格化生成（油画/水彩/宫崎骏）并保存副本

### 4. 后台管理系统

- 科技感十足的前端界面
- 支持显示单元的创建、编辑、删除
- 支持播放列表的管理

### 5. 数据持久化

- 将显示单元和播放列表数据保存到本地 JSON 文件
- 应用重启后数据不丢失

## 技术栈

- **后端**：Python 3.13, Flask 2.0.1
- **前端**：HTML5, CSS3, JavaScript
- **图像处理**：Pillow
- **API 集成**：OpenAI SDK (阿里云 DashScope 兼容模式)
- **数据存储**：JSON 文件
- **环境管理**：venv

## 目录结构

```
paper-pi/
├── run.py              # 应用入口文件
├── README.md           # 项目说明文档
├── requirements.txt    # 依赖配置文件
├── .env                # 环境变量配置
├── venv/               # 虚拟环境
├── storage/            # 数据存储目录
├── lib/                # 第三方库
│   └── waveshare_epd/  # 墨水屏驱动库
└── app/
    ├── config.py        # 统一配置
    ├── __init__.py
    ├── controllers/    # 控制器
    │   └── api_controller.py
    ├── models/         # 数据模型
    │   ├── display_unit.py
    │   ├── empty_du.py
    │   ├── image_du.py
    │   ├── text_to_image_du.py
    │   └── playlist.py
    ├── routes/         # 路由
    │   ├── main_routes.py
    │   └── api_routes.py
    ├── services/       # 服务
    │   ├── llm_service.py
    │   ├── image_gen_service.py
    │   ├── image_gen_queue_service.py
    │   ├── image_library_service.py
    │   ├── image_processing_service.py
    │   ├── weather_service.py
    │   ├── weather_cache_service.py
    │   └── storage_service.py
    ├── static/         # 静态文件
    │   ├── css/
    │   └── js/
    └── templates/      # HTML模板
        ├── index.html
        └── admin.html
```

## 安装与配置

### 1. 克隆项目

```bash
git clone <repository-url>
cd paper-pi
```

### 2. 创建虚拟环境

```bash
python3 -m venv venv
```

### 3. 激活虚拟环境

```bash
# Linux/Mac
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 4. 安装依赖

```bash
pip install -r requirements.txt
```

### 5. 配置环境变量

编辑 `.env` 文件，添加阿里云 DashScope API 密钥：

```env
# LLM API配置 (阿里云DashScope)
LLM_API_KEY=${DASHSCOPE_API_KEY}

# 图片生成API配置 (阿里云DashScope)
DASHSCOPE_API_KEY=your_dashscope_api_key_here

# 应用配置
SECRET_KEY=your_secret_key_here
DEBUG=True
# 运行模式: debug (使用plt显示) 或 production (使用墨水屏驱动)
RUN_MODE=debug
# 屏幕尺寸配置
SCREEN_WIDTH=800
SCREEN_HEIGHT=480

# 天气API配置
WEATHER_API_HOST=your_weather_api_host
WEATHER_PEM_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WEATHER_SUB_ID=your_sub_id
WEATHER_KID_ID=your_kid_id
```

> **注意**：请将 `your_dashscope_api_key_here` 替换为您的实际阿里云 DashScope API 密钥。

## 运行应用

### 启动开发服务器

```bash
source venv/bin/activate && python run.py
```

应用将在 `http://127.0.0.1:5000/` 启动。

### 运行模式

应用支持两种运行模式：

- **debug 模式**：使用 matplotlib 显示图像，适合开发和测试
- **production 模式**：使用墨水屏驱动显示图像，适合实际部署

#### 切换运行模式

编辑 `.env` 文件，修改 `RUN_MODE` 设置：

```env
# 运行模式: debug (使用plt显示) 或 production (使用墨水屏驱动)
RUN_MODE=debug  # 或 production
```

#### 测试显示功能

在 debug 模式下，可以使用以下 API 端点测试显示功能：

```bash
# 测试空单元
curl -X POST http://127.0.0.1:5000/api/test-display \
  -H "Content-Type: application/json" \
  -d '{"type": "EmptyDisplayUnit"}'

# 测试文生图单元
curl -X POST http://127.0.0.1:5000/api/test-display \
  -H "Content-Type: application/json" \
  -d '{"type": "TextToImageDisplayUnit", "user_prompt": "A beautiful cat"}'
```

### 访问应用

- **首页**：`http://127.0.0.1:5000/`
- **后台管理**：`http://127.0.0.1:5000/admin`
- **图片库**：`http://127.0.0.1:5000/library`
- **文生图**：`http://127.0.0.1:5000/text2image`

## 使用指南

### 1. 管理显示单元

1. 访问后台管理页面：`http://127.0.0.1:5000/admin`
2. 点击"显示单元管理"标签
3. 点击"添加显示单元"按钮
4. 选择显示单元类型并填写相关信息
5. 点击"保存"按钮

### 2. 管理播放列表

1. 访问后台管理页面：`http://127.0.0.1:5000/admin`
2. 点击"播放列表管理"标签
3. 点击"添加播放列表"按钮
4. 填写播放列表名称
5. 点击"保存"按钮
6. 可在播放列表详情中添加显示单元

### 3. 文生图功能

1. 创建文生图显示单元
2. 输入用户提示词，例如："一间有着精致窗户的花店，漂亮的木质门，摆放着花朵"
3. 系统会使用 LLM 优化提示词，然后调用阿里云文生图 API 生成图片
4. 生成的图片会在墨水屏上显示

### 4. 天气单元

1. 创建天气显示单元
2. 填写地理位置（location code，例如 `101010100`）
3. 当日首次调用会生成背景图并缓存，后续调用直接复用

## API 端点

### 显示单元 API

- `GET /api/display-units`：获取所有显示单元
- `POST /api/display-units`：创建新的显示单元
- `PUT /api/display-units/<du_id>`：更新显示单元
- `DELETE /api/display-units/<du_id>`：删除显示单元
- `GET /api/display-units/<du_id>/preview`：预览显示单元

### 播放列表 API

- `GET /api/playlists`：获取所有播放列表
- `POST /api/playlists`：创建新的播放列表
- `PUT /api/playlists/<playlist_id>`：更新播放列表
- `DELETE /api/playlists/<playlist_id>`：删除播放列表

### 测试显示 API

- `POST /api/test-display`：测试显示功能（根据类型显示并返回结果）

### 图片库 API

- `GET /api/image-library`：获取图片库列表
- `GET /api/image-library/<image_id>`：获取图片详情
- `GET /api/image-library/<image_id>/file`：获取图片文件
- `POST /api/image-library/upload`：上传图片到图片库
- `POST /api/image-library/batch-delete`：批量删除图片
- `POST /api/image-library/<image_id>/stylize`：风格化图片（异步）

### 预览 API

- `POST /api/image-preview`：根据图片库ID生成预览（支持颜色扩散）

## 技术细节

### 1. 墨水屏驱动

系统使用 `.env` 中的 `SCREEN_WIDTH` 和 `SCREEN_HEIGHT` 来确定图像尺寸，默认适配 7.3 英寸墨水屏分辨率（800x480）。

### 2. LLM 优化提示词

使用阿里云 DashScope API 的 `qwen-plus` 模型优化用户提示词，提高图片生成的质量和准确性。

### 3. 文生图生成

使用阿里云 DashScope API 的 `qwen-image-max` 模型生成图片，支持中英文提示词，生成高质量的图像。

### 4. 文生图队列

文生图请求通过队列统一排队执行，避免并发冲突。

### 4. 配置加载

所有环境变量通过 `app/config.py` 统一加载并提供给各模块使用，避免重复读取配置。

### 5. 日志

外部 API 调用会记录到 `LOG/api.log`。

## 故障排除

### 1. 依赖安装失败

- 确保使用 Python 3.13 版本
- 尝试使用 `pip install --upgrade pip` 更新 pip
- 对于 Pillow 安装失败，尝试使用 `pip install Pillow --no-binary :all:`

### 2. API 调用失败

- 确保 `DASHSCOPE_API_KEY` 配置正确
- 确保 API 密钥有足够的权限调用相应的模型
- 检查网络连接是否正常
- 检查 `WEATHER_PEM_KEY/WEATHER_SUB_ID/WEATHER_KID_ID` 是否正确配置

### 3. 应用启动失败

- 检查 `.env` 中 `SECRET_KEY`、`DASHSCOPE_API_KEY`、`RUN_MODE` 等配置
- 确保所有依赖都已正确安装
- 查看终端输出的错误信息，根据错误提示进行排查

## 示例

### 创建文生图显示单元

1. 访问后台管理页面
2. 点击"添加显示单元"
3. 选择"文生图单元"
4. 填写名称，例如："花店"
5. 输入提示词："一间有着精致窗户的花店，漂亮的木质门，摆放着花朵"
6. 点击"保存"
7. 系统会自动生成图片并显示在墨水屏上

## 许可证

本项目采用 MIT 许可证，详见 LICENSE 文件。

## 致谢

- [Flask](https://flask.palletsprojects.com/) - Python Web 框架
- [Pillow](https://pillow.readthedocs.io/) - Python 图像处理库
- [OpenAI](https://openai.com/) - API 客户端库
- [阿里云 DashScope](https://dashscope.aliyun.com/) - 大模型服务平台
- [Waveshare](https://www.waveshare.com/) - 墨水屏硬件及驱动库

---

**Paper Pi** - 为墨水屏带来智能显示体验
