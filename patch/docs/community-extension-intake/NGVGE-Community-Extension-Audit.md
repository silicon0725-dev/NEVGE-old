# NGVGE 社区扩展审计与吸收计划

版本：EXT-0001  
审计对象：`拓展.zip`  
审计方式：全量静态扫描 + 重点族群人工审阅 + 独立重写验证

## 一、总体结论

压缩包中共发现 **695 个文件**，其中 **577 个 JavaScript 扩展/脚本**。自动语法检查通过 **574 个**，3 个存在明确语法损坏。

这批扩展的价值很高，但不适合整包直接并入 NGVGE。主要原因是：大量代码缺少明确许可证、直接访问 Scratch VM 私有字段、修改 Renderer 原型、依赖远程接口、使用 DOM 全局状态，或包含动态执行代码。

本轮采用策略：

1. 不直接复制来源不明或强 Copyleft 代码。
2. 对高价值能力进行 clean-room 独立重写。
3. 与 NGVGE 既定模块边界冲突的能力延后，避免抢跑 Transform、Renderer、Physics 和 UI System。
4. 所有新第一方扩展均使用 MIT 许可证、固定 ID、无远程依赖，并补充生命周期与错误边界。

## 二、扫描数据

- 注册为 Scratch 扩展的脚本：**481**
- 要求 unsandboxed：**179**
- 访问 VM/Runtime 内部：**324**
- 访问或修改 Renderer/WebGL：**150**
- 包含网络访问：**110**
- 包含动态代码执行（`eval` / `Function`）：**48**
- 精确重复内容：**19 组，20 个额外副本**
- Header 中无明确许可证：**431**；其中 SharkPools 仓库内 34 个由仓库 README 的默认 MIT/LGPL-3.0 双许可覆盖，仍有约 **397 个**需单独确认授权。

分类规模：

- `ui-window`：117
- `math-motion`：85
- `data-codec`：75
- `input-ui`：67
- `world-grid-camera`：55
- `file-storage`：37
- `audio-midi`：34
- `renderer-effects`：30
- `editor-tools`：30
- `events-control`：17
- `misc`：12
- `network-ai`：11
- `physics-collision`：7

## 三、本轮正式吸收的三项能力

### 1. NGVGE Motion Toolkit

参考能力族：补间、Animations、贝塞尔曲线、弹簧动画。

独立重写后提供：

- Clamp、Normalize、Wrap、Ping-Pong；
- 数值与最短角度插值；
- 29 种确定性缓动；
- CSS 风格三次贝塞尔求值；
- 欠阻尼、临界阻尼和过阻尼弹簧模型。

定位：Transform System 的数学基础，同时可独立作为 Scratch 扩展使用。

### 2. NGVGE Input Core

参考能力族：Gamepad Expanded、keyboardplus、高级鼠标、滚轮检测、输入扩展。

独立重写后提供：

- 键盘按住、按下沿和释放沿；
- 鼠标按键、舞台坐标和滚轮增量；
- Gamepad 按键、轴、死区和边沿检测；
- `key:Space`、`mouse:left`、`gamepad:any:button:0` 等动作映射；
- 编辑器输入框焦点保护；
- 项目停止、窗口失焦和 Runtime 销毁时的清理；
- 冻结的 Runtime 查询服务 `runtime.ngvgeInputCore`。

定位：后续 Input System 模块的兼容扩展层。

### 3. NGVGE Data Toolkit

参考能力族：JSON Array、Compress、Unicode、Checksum。

独立重写后提供：

- JSON Path 读取、写入和删除；
- 稳定键排序序列化；
- Unicode 安全 Base64 与 URL-safe Base64；
- CRC32、Adler-32、FNV-1a；
- 基于浏览器原生 Streams 的 GZIP 压缩与解压；
- 不引入第三方压缩库和远程依赖。

定位：Save System、网络协议和资源 Sidecar 的基础工具。

## 四、下一批候选

### 建议升级为第一方模块

- **Runtime Events / Events+ / Advanced Messages**：重构为统一 Event Bus，避免多处 monkey patch。
- **Tile Grids**：等 Transform2D 稳定后升级为 Grid/Tilemap 基础模块。
- **Camera / Renderer Control**：并入正式 Camera2D 与 Renderer2D，不继续维持私有 Renderer Patch。
- **Lazy Collisions / extraPhysics / Rigidbodies**：只吸收 API 设计，不复用实现，等待 Physics2D。

### 建议升级为第一方扩展

- **Files Expanded**：保留文件选择、下载和持久句柄，但重做权限模型与大小限制。
- **Image Editor / Image Effects**：拆成纯数据图像工具与 Renderer FX 两层。
- **Sound Waves / MIDI Tools / FFT**：形成 Audio Analysis 扩展，统一 AudioContext 生命周期。

### 暂缓

- Blur、Shader Library、Post Process：等待 Renderer2D 的 Render Pass 接口。
- DOM 输入框、弹窗、窗口系统：等待 UI System，避免直接向 `document.body` 注入长期对象。
- 3D 大型扩展：依赖体积过大，且与当前 2D Runtime 路线不一致。

## 五、拒绝或隔离规则

以下扩展不会直接进入第一方仓库：

- 运行任意 JS、`eval`、网页爬虫和远程脚本加载；
- 硬编码 AI/API 服务、Token 或不透明代理；
- 作品锁、登录器、账号验证和远程控制；
- 混淆/打包后无法审计的脚本；
- 无法确定许可证且需要复制实现的代码；
- 无清理机制的全局 DOM、Renderer 或 VM 原型修改；
- 语法已经损坏的脚本。

## 六、决策统计

- `reference-only-license-review`：360
- `quarantine`：67
- `archive`：55
- `candidate-backlog`：53
- `candidate-next-phase`：23
- `adopted-as-clean-room-reference`：14
- `duplicate-review`：5


完整逐文件结果见 `NGVGE-Community-Extension-Inventory.csv`。其中评分只用于初筛，不等于安全认证；正式吸收仍需人工审阅和独立测试。
