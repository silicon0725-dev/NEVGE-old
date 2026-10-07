# 快速启动编辑器

适用于 Windows。

## 第一次运行

1. 解压整个 `scratch-gui-main` 文件夹。
2. 双击根目录中的 `START-EDITOR.bat`。
3. 启动器会检查 Bun。
4. 若依赖尚未安装，启动器会自动执行：

   ```powershell
   bun install
   ```

5. 安装完成后会启动开发服务器，并自动打开：

   ```text
   http://localhost:8601/
   ```

首次安装依赖需要网络连接，耗时取决于网络环境。

## 以后运行

直接双击：

```text
START-EDITOR.bat
```

依赖完整时会跳过安装，直接启动编辑器。

## 停止服务器

回到启动器窗口，按：

```text
Ctrl+C
```

## Bun 未找到

启动器会停止并提示安装 Bun。安装后请关闭旧窗口，再重新双击启动器，使新的 PATH 生效。

## 自定义端口

在命令行中先设置 `PORT`，再运行启动器。例如：

```bat
set PORT=8610
START-EDITOR.bat
```

启动地址将变为：

```text
http://localhost:8610/
```

## 常见问题

### 依赖安装失败

检查网络，然后在项目根目录运行：

```powershell
bun install
```

成功后重新双击启动器。

### 页面没有自动打开

手动访问：

```text
http://localhost:8601/
```

### 修改代码后是否需要重启

Webpack 开发服务器会自动重新编译。大多数前端代码修改不需要重启；服务器配置或依赖发生变化时再重启。

## Inspector、图层与扩展属性

启动 Task-0004 后，右侧会出现 `Inspector` 窗口。选中 Project Explorer 中的角色后，可以直接编辑：

- 名称、X、Y、方向、大小、旋转方式、可见性和可拖动。
- 图层前移、后移、置顶和置底。
- 完整的角色图层列表，按前到后排序。

在扩展库中加载以下内置适配扩展后，对应属性会自动出现在 Inspector：

```text
NGVGE Camera V2
NGVGE XY Stretch
```

Camera 区域提供绑定摄像机、摄像机 X/Y、缩放和方向；XY Stretch 区域提供水平与垂直拉伸。
