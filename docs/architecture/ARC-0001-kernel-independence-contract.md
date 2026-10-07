---
arc: ARC-0001
title: Kernel Independence Contract
status: Architecture Frozen
parent: null
owners:
  - NGVGE Architecture
appliesTo:
  - Runtime
  - Editor
  - Module
  - Protocol
  - Serialization
  - Compatibility
  - Backend
  - Future Native Kernel
createdAt: 2026-08-05
updatedAt: 2026-08-10
supersedes: []
supersededBy: null
authority: Highest Architecture Constraint
formalFreezeEvidence: docs/freeze-repair/0008.9.7-R10-FINAL-FREEZE-CERTIFICATION.md
---

# ARC-0001｜Kernel Independence Contract

## Status

**Accepted / Architecture Frozen**

ARC-0001 is the highest architecture constraint for NGVGE. It applies to `0008 Runtime Scene Graph` and all subsequent Runtime、Editor、Module、Protocol、Serialization、Compatibility and Backend systems.

This repository file formalizes the ARC-0001 normative content already frozen in the ARC Master Plan. C001.0-A changes repository placement and execution status only; it does not expand or weaken ARC-0001 semantics.

## Core principle

> **NGVGE owns semantic identity, schemas, protocols, lifecycle, authority and compatibility semantics. External systems may only act as replaceable backends or adapters.**

中文规范表述：

> **NGVGE 拥有语义身份、Schema、协议、生命周期、状态权威和兼容语义；任何外部系统都只能作为可替换 Backend 或 Adapter 存在。**

## 1. Stable Identity

所有持久语义对象必须具有稳定身份：

```text
NodeId
SceneId
ResourceId
ModuleId
ComponentTypeId
BindingId
TransactionId
```

不得由以下执行身份替代：

```text
Scratch target.id
Scratch Drawable ID
ECS Entity
GPU Handle
Physics Body ID
DOM Reference
Native Pointer
JavaScript Object Reference
```

稳定身份必须：

- 存盘后不变；
- 项目重开后仍可定位；
- 可被动画轨道、积木、撤销记录和跨场景引用使用；
- 后端重建、设备丢失、Runtime 实体重建后保持不变；
- 不携带具体后端的 generation、index 或内部句柄语义。

## 2. Versioned Schema

所有持久组件、资源记录和模块声明必须由版本化 Schema 描述。

Schema 至少包括：

- `typeId`；
- `version`；
- 字段类型；
- 默认值；
- 可空性；
- 数值范围；
- 单位；
- 资源引用类型；
- Persistent / Runtime-only 属性；
- 校验规则；
- 迁移路径。

示例：

```json
{
  "typeId": "ngvge.transform2d",
  "version": 2,
  "properties": {
    "position": {
      "type": "vec2",
      "default": [0, 0]
    },
    "rotation": {
      "type": "angle",
      "unit": "degrees",
      "default": 0
    },
    "scale": {
      "type": "vec2",
      "default": [1, 1]
    }
  }
}
```

## 3. Unique Authority

每个 State Domain 在任意时刻只能存在一个可写 Authority。

```text
Transform2D
当前 Authority: Scratch
Projection: Scratch → NGVGE
未来 Authority: NGVGE
Projection: NGVGE → Scratch
```

Projection 可以有多个，Observer 可以有多个，但 Writer Authority 必须唯一。

任何写入都必须携带 Mutation Context，至少包含：

```text
origin
transactionId
projectionId
```

同一 `projectionId` 产生的变化不得重新进入原投影器，避免同步回路。

## 4. Explicit Protocol

系统之间通过稳定协议交流：

```text
Commands
Queries
Events
Transactions
Capabilities
Schemas
```

禁止共享可变内部对象。

编辑器不得直接执行：

```js
runtime.internalScene.nodes.get(id).transform.x = 100;
```

必须表达为协议命令：

```json
{
  "type": "PatchComponent",
  "nodeId": "node-player",
  "componentTypeId": "ngvge.transform2d",
  "patch": [
    {
      "op": "replace",
      "path": "/position/x",
      "value": 100
    }
  ]
}
```

## 5. Controlled Lifecycle

所有模块、场景、资源、设备、Adapter 和 Capability 都必须具有明确生命周期。

统一模块状态机：

```text
Uninstalled
→ Installed
→ Registered
→ Initialized
→ Enabled
→ Runtime Active
→ Disabled
→ Shutdown
→ Uninstalled
```

正交生命周期事件：

```text
Project Open / Close
Scene Load / Unload
Runtime Start / Stop
Device Lost / Restore
Hot Reload Begin / Commit / Rollback
```

每个系统必须声明不适用事件为空操作或显式不支持，不能依赖隐式行为。

## 6. No Backend Leakage

> **Backend-specific representation MUST NOT cross the Runtime Boundary.**

以下对象禁止进入 Project Model、Runtime Semantic Model、Engine Protocol 与 Module Public API：

```text
Scratch Target
Drawable ID
GPU Texture Handle
VkImage
ID3D12Resource
MTLTexture
Box2D Body Pointer
Jolt BodyID
SDL_Window Pointer
DOM Element
JavaScript Object Reference
ECS Entity ID
```

它们只能存在于 Backend Layer 或 Compatibility Adapter 内部。

正确关系：

```text
ResourceId
↓
Resource Database Entry
↓
Runtime Resource Handle
↓
Backend Resource Cache
↓
GPU / Audio / Physics Native Handle
```

## 7. Editor Is a Client

编辑器在架构上是 Kernel 的客户端，即使当前与 Runtime 运行在同一 JavaScript 进程中。

当前：

```text
React Editor
→ In-Process Protocol Adapter
→ JavaScript Runtime Kernel
```

未来：

```text
React Editor
→ IPC / WebSocket / WASM Bridge
→ Native Kernel
```

Editor 可以：

```text
CreateNode
DestroyNode
ModifyComponent
RequestPreview
QueryState
```

Editor 不可以直接修改 Runtime 内部对象。

## 8. Transactional Mutation

以下操作必须支持原子提交或回滚：

- Node Tree Paste；
- 多选编辑；
- Scene Import；
- Schema Migration；
- Module Install / Upgrade；
- Hot Reload；
- Authority Switch；
- Resource Reimport；
- 大型编辑器批处理。

事件只应在 Commit 后发布。失败不得留下部分状态，也不得通过创建新稳定身份代替旧身份完成“伪回滚”。

## 9. Project Source、Import Cache 与 Runtime Package 分离

```text
Project Source
├── project.ngvproject
├── scenes/
├── scripts/
├── assets/
└── modules/

Import Cache
├── dependency database
├── intermediate meshes
├── transcoded textures
├── decoded audio metadata
└── generated thumbnails

Runtime Package
├── scene binary
├── resource table
├── optimized mesh data
├── KTX2 textures
├── animation clips
├── shader variants
└── platform manifest
```

约束：

- Project Source 是唯一创作源；
- Import Cache 可删除并重建；
- Runtime Package 可重新构建；
- 缓存句柄和平台句柄不得进入 Project Source；
- 运行包不要求人类可读；
- Import Cache 不能被错误地视为项目源文件。

## 10. Hot Reload Compatibility

热更新必须依赖：

```text
Stable Identity
+
Versioned Schema
+
Migration
+
Transaction
```

流程：

```text
Detect Change
→ Pause Affected Domain
→ Validate New Schema
→ Prepare Temporary State
→ Run Migration
→ Commit Semantic State
→ Publish Reload Events
→ Dispose Old State
```

失败：

```text
Rollback
→ 保留旧模块、旧数据与旧稳定身份
```

## 11. Deterministic Runtime Option

NGVGE 应支持可选确定性 Profile。

最低要求为 Scheduling Determinism：

- Fixed Tick；
- 固定系统执行顺序；
- 固定命令提交顺序；
- 固定事件排序；
- 固定随机种子；
- 规范化 Entity 查询顺序。

默认长期承诺应为 Semantic Determinism，而非跨平台 Bitwise Determinism。

```text
Deterministic Profile: Semantic
相同 Kernel 版本
相同 Backend 版本
相同项目数据
相同输入 Trace
→ 等价 Canonical Trace
```

## 12. Four-layer model boundary

ARC-0001 正式要求区分：

```text
Persistent Project Model
├── NodeId
├── ResourceId
├── Parent / Children
├── Component Records
├── Scene Records
└── Serialization Versions
│
▼
Runtime Semantic Model
├── Runtime Scene Graph
├── Component Instances
├── Authority State
├── Lifecycle State
└── Capability Bindings
│
▼
Runtime Execution Storage
├── ECS Entity
├── Dense Component Storage
├── Queries
├── System Scheduling
└── Runtime Generations
│
▼
Backend Native Objects
├── Scratch Target / Drawable
├── Dawn Buffer / Texture
├── Box2D Body
├── Jolt Body
├── miniaudio Voice
└── Platform Handles
```

### 12.1 Node 与 ECS

```text
Node 是语义身份。
Entity 是执行身份。
```

```cpp
using NodeId = StableUuid;
struct RuntimeEntityRef {
    NodeId node_id;
    EntityHandle entity;
    uint32_t runtime_generation;
};
```

不得将 ECS Entity 持久化或作为协议身份。

### 12.2 Resource 双身份

```text
Persistent ResourceId
→ Runtime Resource Entry
→ Backend Resource Handle
→ Native Resource
```

GPU Device Lost、资源热重载和场景重建只允许改变 Backend Handle，不允许改变 ResourceId。

## 13. Backend 的长期定位

下面的库选择是推荐主路线，不是 Project Model 的组成部分：

```text
Platform       SDL3
Rendering      Dawn / Browser WebGPU
Physics2D      Box2D
Physics3D      Jolt
Audio          miniaudio
Model Import   fastgltf
Mesh Process   meshoptimizer
Texture        KTX2 / Basis Universal
Scripts        Block VM / QuickJS-ng / Lua
```

所有库只能实现 NGVGE 自己定义的接口：

```text
Platform API
Render API
Physics2D API
Physics3D API
Audio API
Resource API
Script Host API
Job API
```

一个系统只能有一个权威设备生命周期所有者：

```text
Window / Display / Input → SDL3
GPU Device               → Dawn
Audio Device             → miniaudio
PhysicsWorld2D           → Box2D
PhysicsWorld3D           → Jolt
```

## 14. Scratch 的最终位置

```text
Scratch Compatibility Suite
├── SB3 Importer
├── SB3 Exporter
├── Scratch Semantic Profile
├── Scratch Block Frontend
├── Sprite / Stage Adapters
├── Legacy Extension Host
└── Compatibility Test Corpus
```

Scratch 兼容层可以持有：

```text
Scratch Target
Scratch VM Events
target.id
Scratch Renderer Binding
```

核心层只能看到：

```text
Stable NodeId
BindingId
Source Descriptor
Binding Status
Component Schema
Capability Calls
```

QuickJS-ng 不自动兼容 TurboWarp 扩展。Legacy Scratch Extension 必须经过独立 Compatibility Host 与 Capability Bridge。

## 15. Migration route

### Stage 0｜Scratch-hosted Engine

```text
权威场景状态：Scratch VM
权威渲染状态：Scratch Renderer
权威脚本执行：Scratch Threads
NGVGE：建立语义模型、模块、项目结构与编辑器增强
```

### Stage 1｜NGVGE Semantic Layer

建立：

- Stable Identity；
- Runtime Node；
- Component Schema；
- Engine Protocol；
- Authority Registry；
- Lifecycle；
- Capability Boundary。

### Stage 2｜Hybrid Runtime

```text
权威项目状态：NGVGE Project Model
兼容执行：Scratch Runtime
原生执行：逐步迁移 Transform / Resource / Renderer / Physics
```

每个 Domain 必须具有唯一 Authority，不允许 Scratch 与 NGVGE 双向互相覆盖。

### Stage 3｜NGVGE Native Kernel

```text
权威场景状态：NGVGE Kernel
权威脚本执行：Block VM / Script Hosts
权威渲染：NGVGE Renderer
权威物理：NGVGE Physics APIs
Scratch：Importer + Compatibility Runtime
```

## Governance

- ARC-0001 高于其他 Architecture Records、Conformance Specifications、Subsystem Specifications、Task Designs 与 Implementation。
- `Architecture Frozen` 表示核心原则停止扩写；新的技术细节进入从属 ARC，执行细节进入 ARC-C001。
- 永久改变 ARC-0001 只能通过正式 Superseding ARC；不得通过 Task、注释或 Waiver 绕过。
