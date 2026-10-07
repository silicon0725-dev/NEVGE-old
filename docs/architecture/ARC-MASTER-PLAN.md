# NGVGE ARC Master Plan

> **Document ID:** ARC-MASTER-PLAN
> **Title:** NGVGE Architecture Records, Freeze Governance and Conformance Roadmap
> **Version:** 1.17
> **Status:** Planning Frozen / Conformance Execution Active
> **Prepared:** 2026-08-05
> **Repository baseline updated:** 2026-08-12
> **Applies to:** NGVGE Runtime、Editor、Module、Protocol、Serialization、Compatibility、Backend 与未来 Native Kernel
> **Current execution order:** ARC-C001.1 Minimum Baseline CERTIFIED → 0009-A/B/C/D COMPLETE → 0009-E COMPLETE / CERTIFIED → Runtime / Editor Integration
> **Freeze authority:** ARC-0001 / NGVGE 0008.9.7 R10 Final Freeze Certification

> Repository status note: Version 1.17 records `0009-E` machine DoD certification at 12/12 PASS plus a real Windows Chrome Browser Verify PASS. The earlier managed-Chromium navigation-policy evidence hold is resolved. `0009 Transform System` is COMPLETE / CERTIFIED. C001.1-H remains the certified 7/7 entry baseline, and Blocking Merge Policy remains deferred to ARC-C001.6.

---

## 0. 文档目的

本文件不是某一个子系统的实现文档，而是 NGVGE 全部 Architecture Record（ARC）的总规划、
治理入口和未来启动索引。

它需要解决四个问题：

1. 哪些架构原则已经冻结，后续实现不得削弱；
2. 哪些从属 ARC 需要继续拆分并独立定义；
3. ARC-0001 如何从文档约束转化为机器可执行的架构门禁；
4. 当前 `0008 Runtime Scene Graph`、后续 `0009 Transform System` 与长期 Native Kernel 之
间如何保持连续演化。

本文件应在未来启动 ARC 工作时首先读取。任何新的 Runtime、Editor、Module、Protocol、
Serialization、Compatibility 或 Backend 任务，都应先检查其是否与本规划、ARC-0001 及已生效
的从属 ARC 冲突。

---

## 1. 当前决策摘要

### 1.1 当前优先顺序

```text
0008 Runtime Scene Graph / Final Architecture Review
    COMPLETE / ARCHITECTURE FROZEN
    ↓
ARC-0001 Formal Freeze Announcement
    COMPLETE
    ↓
ARC-C001.0 Documentation Freeze and Baseline
    COMPLETE / A+B+C+D COMPLETE
    ↓
ARC-C001.1-A Semantic Ownership Zone / Import Boundary
    BROWSER VALIDATED / COMPLETE
    ↓
ARC-C001.1-B Stable Identity Foundation
    COMPLETE
    ↓
ARC-C001.1-C Persistent DTO Foundation
    COMPLETE
    ↓
ARC-C001.1-D Schema Registry Foundation
    COMPLETE
    ↓
ARC-C001.1-E Authority Registry Foundation
    COMPLETE
    ↓
ARC-C001.1-F Protocol DTO Foundation
    COMPLETE
    ↓
ARC-C001.1-G Scratch Adapter Boundary Gate
    COMPLETE
    ↓
ARC-C001.1-H Minimum Baseline Certification
    COMPLETE / CERTIFIED
    ↓
0009 Transform System
    COMPLETE / CERTIFIED
    ↓
0009-A Transform2D Semantic Contract Foundation
    COMPLETE
    ↓
0009-B Runtime / Persistent Component Wiring
    COMPLETE
    ↓
0009-C Scratch Compatibility Projection
    COMPLETE
    ↓
0009-D Editor PatchComponent Compatibility Bridge
    COMPLETE
    ↓
0009-E Transform DoD Certification / Browser Verify
    COMPLETE / CERTIFIED — MACHINE 12/12 + BROWSER PASS
```

### 1.2 当前状态

| Record / Task | Status | Execution |
|---|---|---|
| ARC-0001 Kernel Independence Contract | Accepted / Architecture Frozen | R10 已完成正式冻结；作为最高架构约束进入强制执行 |
| ARC-C001 ARC-0001 Conformance Suite | Approved / Active | C001.1 minimum baseline certified；Blocking Merge Policy remains later C001.6 work |
| 0008 Runtime Scene Graph | Completed / Architecture Frozen | R10 Final Freeze Certification 已通过 |
| Scene System V2.1 | Browser Validated / Freeze Baseline | 已纳入 0008.9.7 冻结候选与 R10 证书 |
| 0009 Transform System | Complete / Certified | 0009-A–D complete；0009-E machine DoD 12/12 PASS；Windows Chrome Browser Verify PASS |

C001.1-A browser revalidation 已通过。C001.1-B 已建立 Stable Identity Foundation 并解决 `ARC-DEBT-0001`；C001.1-C 已建立 Core Persistent DTO Authority；C001.1-D 已建立通用 Core Schema Registry Foundation；C001.1-E 已建立通用 Core Authority Registry Foundation，并强制同一 State Domain 单 Writer；C001.1-F 已建立通用 Engine Protocol DTO Foundation；C001.1-G 已将 Scratch Adapter Boundary 升级为独立主动门禁并解决 `GOV-DEBT-0002`。七项最低实现条件为 7/7；C001.1-H 已完成机器认证，Active Architecture Waivers 为 0，且不存在未解决的 C001.1 / 0009 blocker。0009-A、0009-B、0009-C 与 0009-D 已完成；0009-E 的 12 项 Transform DoD 已完成机器认证，并在 Windows Chrome 中取得 Browser Verify PASS。Scratch Compatibility Authority 通过单向 Scratch → NGVGE Projection 驱动 Runtime Transform；高频投影不会逐帧写回项目源。Editor Transform 修改通过 `PatchComponent` 进入 backend-independent command capability，再由 Scratch Compatibility Bridge 写入当前 Writer Authority、回投 Runtime 并显式提交 Persistent Transform。`0009 Transform System` 因此正式 COMPLETE / CERTIFIED，下一实现重点进入 Runtime / Editor Integration。

### 1.3 核心长期准则

> **NGVGE 拥有语义身份、Schema、协议、生命周期、状态权威和兼容语义；Scratch 与所有开
源库只能作为受控 Backend 或 Adapter 存在。**

这一原则意味着：

- Scratch 不是 NGVGE 的永久内核；
- Dawn、SDL3、Box2D、Jolt、miniaudio 等库也不定义 NGVGE；
- 后期更换运行时或后端，应表现为替换 Authority Adapter 或 Backend Implementation；
- Project Model、Editor Contract、Module Ecosystem 和稳定身份不得因此推翻。

---

# Part I｜ARC 治理体系

## 2. 架构文档层级

NGVGE 架构文档采用以下优先级：

```text
ARC-0001
最高架构约束
     ↓
其他 Architecture Records
     ↓
Conformance Specifications
     ↓
Subsystem Specifications
     ↓
Task Designs
     ↓
Implementation
```

冲突裁决规则：

1. 实现与 Task Design 冲突：以 Task Design 为准；
2. Task Design 与 Subsystem Specification 冲突：以 Subsystem Specification 为准；
3. Subsystem Specification 与 ARC 冲突：以 ARC 为准；
4. 任意内容与 ARC-0001 冲突：ARC-0001 优先；
5. 永久改变 ARC-0001 只能通过正式 Superseding ARC，不得通过任务文档、注释或 Waiver 绕
过。

## 3. ARC 状态模型

每份 ARC 至少具有以下状态之一：

```text
Draft
讨论中，尚不具备约束力

Proposed
方案已形成，等待正式批准

Accepted
正式生效，后续工作必须遵守

Architecture Frozen
核心原则停止扩写，只允许澄清勘误或由从属 ARC 细化

Superseded
已被新 ARC 正式取代
Rejected
不进入 NGVGE 架构
```

### 3.1 Architecture Frozen 的含义

冻结不等于文档永远不能修正，而是：

- 不再通过持续增加理念扩大 ARC-0001；
- 新的技术细节进入从属 ARC；
- 执行细节进入 ARC-C001；
- 文字勘误不得改变规范语义；
- 任何规范性变化必须建立新的 ARC，并注明与 ARC-0001 的关系。

## 4. ARC 文件命名与元数据

建议正式仓库路径：

```text
docs/architecture/
├── ARC-0001-kernel-independence-contract.md
├── ARC-0002-engine-protocol-model.md
├── ARC-0003-authority-and-projection-model.md
├── ARC-0004-component-schema-and-migration-contract.md
├── ARC-0005-module-lifecycle-contract.md
├── ARC-0006-deterministic-runtime-profile.md
├── ARC-0007-persistent-identity-contract.md
├── ARC-0008-scratch-compatibility-boundary.md
└── conformance/
    └── ARC-C001-arc-0001-conformance-suite.md
```

每份 ARC 的头部必须包含：

```yaml
arc: ARC-XXXX
title: ...
status: Draft | Proposed | Accepted | Architecture Frozen | Superseded | Rejected
parent: ARC-0001 | null
owners: [...]
appliesTo: [...]
createdAt: YYYY-MM-DD
updatedAt: YYYY-MM-DD
supersedes: [...]
supersededBy: null
```

---

# Part II｜ARC-0001 Kernel Independence Contract

## 5. 正式登记

```text
ARC-0001｜Kernel Independence Contract

Status:
Accepted / Architecture Frozen

Authority:
Highest Architecture Constraint

Applies To:
0008 Runtime Scene Graph
以及所有后续 Runtime、Editor、Module、Protocol、Serialization、Compatibility 与 Backend 系统
```

## 6. 核心原则

> **NGVGE owns semantic identity, schemas, protocols, lifecycle, authority and compatibility
semantics. External systems may only act as replaceable backends or adapters.**

中文规范表述：

> **NGVGE 拥有语义身份、Schema、协议、生命周期、状态权威和兼容语义；任何外部系统都只
能作为可替换 Backend 或 Adapter 存在。**

## 7. ARC-0001 的不可破坏不变量

### 7.1 Stable Identity

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

### 7.2 Versioned Schema

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

### 7.3 Unique Authority

每个 State Domain 在任意时刻只能存在一个可写 Authority。

示例：

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

### 7.4 Explicit Protocol

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

### 7.5 Controlled Lifecycle

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

### 7.6 No Backend Leakage

正式原则：

> **Backend-specific representation MUST NOT cross the Runtime Boundary.**

以下对象禁止进入 Project Model、Runtime Semantic Model、Engine Protocol 与 Module Public
API：

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

### 7.7 Editor Is a Client

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

### 7.8 Transactional Mutation

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

事件只应在 Commit 后发布。失败不得留下部分状态，也不得通过创建新稳定身份代替旧身份完
成“伪回滚”。

### 7.9 Project Source、Import Cache 与 Runtime Package 分离

正式数据层次：
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

### 7.10 Hot Reload Compatibility

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

### 7.11 Deterministic Runtime Option

NGVGE 应支持可选确定性 Profile。

最低要求为 Scheduling Determinism：

- Fixed Tick；
- 固定系统执行顺序；
- 固定命令提交顺序；
- 固定事件排序；
- 固定随机种子；
- 规范化 Entity 查询顺序。

默认长期承诺应为 Semantic Determinism，而非跨平台 Bitwise Determinism。

推荐定义：

```text
Deterministic Profile: Semantic

相同 Kernel 版本
相同 Backend 版本
相同项目数据
相同输入 Trace
→ 等价 Canonical Trace
```

## 8. 四层模型边界

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

### 8.1 Node 与 ECS

```text
Node 是语义身份。
Entity 是执行身份。
```

推荐：

```cpp
using NodeId = StableUuid;

struct RuntimeEntityRef {
    NodeId node_id;
    EntityHandle entity;
    uint32_t runtime_generation;
};
```

不得将 ECS Entity 持久化或作为协议身份。

### 8.2 Resource 双身份

```text
Persistent ResourceId
→ Runtime Resource Entry
→ Backend Resource Handle
→ Native Resource
```

GPU Device Lost、资源热重载和场景重建只允许改变 Backend Handle，不允许改变 ResourceId
。

## 9. Backend 的长期定位

下面的库选择是推荐主路线，不是 Project Model 的组成部分：

```text
Platform   SDL3
Rendering    Dawn / Browser WebGPU
Physics2D    Box2D
Physics3D    Jolt
Audio     miniaudio
Model Import fastgltf
Mesh Process meshoptimizer
Texture    KTX2 / Basis Universal
Scripts   Block VM / QuickJS-ng / Lua
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
GPU Device            → Dawn
Audio Device          → miniaudio
PhysicsWorld2D          → Box2D
PhysicsWorld3D          → Jolt
```

## 10. Scratch 的最终位置

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

QuickJS-ng 不自动兼容 TurboWarp 扩展。Legacy Scratch Extension 必须经过独立
Compatibility Host 与 Capability Bridge。

## 11. 三阶段迁移路线

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

---

# Part III｜从属 ARC 总路线

## 12. ARC-0002｜Engine Protocol Model

**Parent:** ARC-0001
**Planned Status:** Proposed after ARC-C001 Phase 1

定义：

- Commands；
- Queries；
- Events；
- Transactions；
- Capability Negotiation；
- Protocol Versioning；
- Frozen Snapshot DTO；
- Pagination 与增量读取；
- Structured Error Model；
- In-process、IPC、WASM Bridge 的等价语义。

最低验收：

- Editor Mutation 均可编码为 Command；
- Query 不返回内部可变对象；
- DTO 不包含 Backend Handle；
- 事务事件只在 Commit 后发布；
- 旧 Editor 与裁剪 Kernel 可进行 Capability Negotiation。

## 13. ARC-0003｜Authority and Projection Model

定义：

- StateDomainId；
- AuthorityRegistration；
- Writer / Projection / Observer；
- Projection Direction；
- Mutation Context；
- Projection Loop Prevention；
- Authority Switch Transaction；
- Compatibility Authority；
- Runtime Ownership Diagnostics。

最低验收：

- 同一 Domain 两个 Active Writer 注册失败；
- 投影回写循环被拒绝；
- Authority 切换不改变 ComponentTypeId 与 NodeId；
- 0009 Transform2D 初始 Authority 明确为 Scratch Compatibility Authority。

## 14. ARC-0004｜Component Schema and Migration Contract

定义：

- Schema Registry；
- Property Type System；
- Default Value；
- Validation；
- Runtime-only / Persistent；
- Version Graph；
- Migration Chain；
- Irreversible Migration；
- Custom Inspector / Gizmo / Validator 注册；
- Serialization Codec。

最低验收：

- 持久版本可连续迁移到 Current；
- 缺少中间迁移时 Registry 拒绝启用；
- 迁移后重新序列化与加载语义等价；
- Migration 不允许修改稳定身份。

## 15. ARC-0005｜Module Lifecycle Contract

定义：

```text
Install
Register
Initialize
Enable
Runtime Active
Disable
Shutdown
Uninstall
```

以及：

```text
Project Open / Close
Scene Load / Unload
Runtime Start / Stop
Device Lost / Restore
Hot Reload Begin / Commit / Rollback
```

最低验收：

- 多轮安装卸载无 Listener、Timer、Worker、DOM 和 Capability 泄漏；
- Provider 卸载后 Capability 自动失效；
- 异步任务不得在 Uninstall 后回调；
- 设备恢复不改变稳定资源身份。

## 16. ARC-0006｜Deterministic Runtime Profile

定义：

- Fixed Tick；
- Scheduler Phases；
- Stable Event Ordering；
- Command Ordering；
- Random Seed；
- Canonical Trace；
- Semantic Determinism；
- Replay；
- Debug Record；
- Multiplayer Profile 的额外约束。

不默认承诺：

- 跨 CPU、编译器、物理库、GPU 后端的位级一致。

## 17. ARC-0007｜Persistent Identity and Resource Identity

定义：

- NodeId；
- SceneId；
- ResourceId；
- ModuleId；
- ComponentTypeId；
- BindingId；
- Runtime Entity Mapping；
- Backend Generation；
- Resource Handle Invalidation；
- Duplicate / Import / Merge Identity Policy。

最低验收：

- Runtime Entity 重建后 NodeId 不变；
- Backend 重建后 ResourceId 不变；
- 旧 generation Handle 被拒绝；
- 同一稳定 ID 不同时映射到两个活动语义对象。
## 18. ARC-0008｜Scratch Compatibility Boundary

定义：

- SB3 Import / Export；
- Scratch Semantic Profile；
- Target / Stage / Clone Mapping；
- Binding Sidecar；
- Scratch Adapter Lifecycle；
- Legacy Extension Host；
- Browser API Permission；
- Scratch Trace Normalizer；
- Scratch → NGVGE 和 NGVGE → Scratch 投影规则。

明确禁止：

- Scratch Target 进入核心组件；
- target.id 作为 NodeId；
- Scratch Renderer 私有对象进入 Protocol；
- Legacy Extension 获得 Native Backend 对象。

## 19. 建议追加的长期 ARC

### ARC-0009｜Project Source, Import Cache and Runtime Packaging

管理资源管线、依赖图、构建产物、平台包与缓存可重建性。

### ARC-0010｜Backend Capability Negotiation

定义 RenderCapabilities、PhysicsCapabilities、AudioCapabilities 与模块降级策略。

### ARC-0011｜Native Module ABI

定义版本化 C ABI、结构大小、内存边界、异常边界、模块卸载和 C++ SDK 包装。

### ARC-0012｜Transactional Hot Reload and Runtime Replacement

定义 Prepare / Validate / Commit / Rollback、旧实例保留、Authority 切换与稳定身份恢复。

这些 ARC 均必须声明：

```text
Parent Constraint: ARC-0001
```

---

# Part IV｜ARC-C001 Conformance Suite

## 20. 正式登记

```text
ARC-C001｜ARC-0001 Conformance Suite

Status:
Approved / Active / ARC-C001.0 Baseline Execution

Type:
Architecture Enforcement Specification

Parent:
ARC-0001 Kernel Independence Contract

Merge Policy after activation:
Blocking

Required before:
0009 Transform System
```

ARC-C001 的定位：

> 功能测试判断代码能否工作；Conformance Suite 判断代码是否仍然属于 NGVGE。

它是 NGVGE 的 Architecture Compiler。

## 21. 建议仓库结构

```text
docs/
└── architecture/
   ├── ARC-0001-kernel-independence-contract.md
   └── conformance/
      ├── identity.md
      ├── schema.md
    ├── authority.md
    ├── protocol.md
    ├── lifecycle.md
    ├── serialization.md
    └── compatibility.md

src/
├── core/
│ ├── identity/
│ ├── schema/
│ ├── authority/
│ ├── protocol/
│ ├── lifecycle/
│ └── capabilities/
├── runtime/
├── editor/
├── compatibility/
│ └── scratch/
└── backends/

tests/
└── architecture/
   ├── import-boundaries.test.ts
   ├── persistent-dto.test.ts
   ├── authority-conflicts.test.ts
   ├── protocol-conformance.test.ts
   ├── lifecycle-conformance.test.ts
   ├── schema-migrations.test.ts
   ├── capability-boundaries.test.ts
   └── semantic-trace.test.ts

tools/
└── conformance/
    ├── check-import-graph.ts
    ├── validate-persistent-dto.ts
    ├── validate-schema-registry.ts
    └── compare-semantic-traces.ts
```

`src/core` 定义为 **NGVGE Semantic Ownership Zone**。

其中禁止出现：
```text
Scratch
React
DOM
Three.js
Dawn
SDL
Box2D
Jolt
Flecs / EnTT Entity
任何具体 Backend 类型
```

## 22. ARC-C001 分阶段施工计划

### ARC-C001.0｜Documentation Freeze and Baseline

目标：

- 将 ARC-0001 从讨论文本整理成正式冻结文件；
- 建立本 Master Plan；
- 建立 Conformance 规则目录；
- 记录 0008 当前已知技术债；
- 建立 ARC 索引和状态矩阵。

交付：

```text
docs/architecture/ARC-0001-kernel-independence-contract.md
docs/architecture/ARC-MASTER-PLAN.md
docs/architecture/conformance/README.md
```

启动时机：0008 Final Architecture Review 后。

#### Repository execution decomposition (2026-08-10)

```text
ARC-C001.0-A Architecture Repository Baseline       COMPLETE
ARC-C001.0-B Existing Gate Inventory               COMPLETE
ARC-C001.0-C Legacy Waiver / Debt Baseline         COMPLETE
ARC-C001.0-D Conformance Status Matrix Completion  COMPLETE
```

该拆分是 ARC-C001.0 的工程执行细化，不修改 ARC-C001 原始规范范围。

### ARC-C001.1｜Core Boundary Foundation

必须完成：

1. 建立 `src/core` 边界；
2. Stable Identity 品牌类型；
3. Schema Registry 基础；
4. Authority Registry 基础；
5. Engine Command / Query / Event 基础 DTO；
6. 第一批 Import Boundary Gate；
7. Scratch Adapter Boundary Test。

这是进入 0009 前的最低完成阶段。

### ARC-C001.2｜Persistent Data and Identity Enforcement

实现：

- `validatePersistentDTO()`；
- Plain Data Validation；
- Schema Validation；
- Runtime Brand Detection；
- `PersistentDTO<T>` 品牌类型；
- 非有限数值与循环引用检测；
- Class Instance、Promise、Function、DOM、Scratch Target、Backend Handle 拒绝；
- Identity Registry 冲突检测；
- Runtime Generation 失效检测。

持久化入口必须只接受经过验证的 PersistentDTO。

### ARC-C001.3｜Authority, Protocol and Transaction Gates

实现：

- 单 Writer Authority 注册；
- Projection Loop Prevention；
- Mutation Context；
- Editor Mutation → Engine Command 映射检查；
- Frozen Query Snapshot；
- Transaction Begin / Apply / Commit / Rollback；
- Commit 后事件发布；
- Shadow State / Prepare-Commit 模式；
- Undo 的协议级反向操作。

### ARC-C001.4｜Lifecycle, Capability and Schema Migration Gates

实现：

- 完整 Lifecycle Harness；
- 多轮安装卸载泄漏检测；
- Timer、Listener、Worker、DOM、Capability、Resource 清理；
- Capability Manifest 声明；
- Provider 卸载自动失效；
- Capability 版本协商；
- Schema Migration Graph；
- 不可逆迁移恢复点。

### ARC-C001.5｜Semantic Trace and Determinism Foundation

实现：

- Canonical Trace Schema；
- Kernel Scheduling Trace；
- Scratch Compatibility Trace；
- Backend Semantic Trace；
- Semantic Normalizer；
- Trace Comparator；
- Fixed Tick 测试；
- Stable Event Ordering；
- Replay 输入格式。

Canonical Trace 禁止携带：

```text
Target ID
Thread Object
ECS Entity
GPU Handle
Memory Address
Non-stable Timestamp
```

### ARC-C001.6｜Blocking CI and Waiver Governance

正式 CI 顺序：

```text
1. Typecheck
2. Lint
3. Import Boundary
4. Protocol DTO Validation
5. Persistent DTO Validation
6. Identity Invariants
7. Authority Conflict Tests
8. Schema Migration Graph
9. Lifecycle Harness
10. Capability Boundary Tests
11. Semantic Trace Tests
12. Unit / Integration Tests
13. Build
```

任何 ARC-0001 Gate 失败，Merge 必须阻断。

## 23. 各 Gate 的详细规范

### 23.1 Import Boundary Gate

允许依赖方向：

```text
Editor
  ↓
Protocol

Compatibility Adapter
 ↓
Capabilities / Runtime Semantic API

Runtime Systems
 ↓
Core Contracts

Backend Implementation
  ↓
Backend Interfaces
```

禁止：

```text
Core → Scratch
Core → Backend
Core → Editor
Runtime Semantic Model → React
Protocol DTO → Native Handle
Project Model → ECS
```

第一阶段使用 ESLint `no-restricted-imports`，随后增加完整依赖图扫描，防止重新导出隐藏来
源。

### 23.2 Persistent DTO Gate

接口：

```ts
export interface PersistentValidationResult {
  readonly valid: boolean;
  readonly issues: readonly PersistentValidationIssue[];
}

export function validatePersistentDTO(
  value: unknown,
  schema?: SchemaRef
): PersistentValidationResult;
```

拒绝：

```text
Function
Promise
Symbol
WeakMap / WeakSet
DOM Object
Scratch Target
ECS Entity
Backend Handle
Custom Class Instance
Circular Reference
Unknown Component Type
Non-finite Number
Runtime-only Field without Schema
```

### 23.3 Identity Gate

基础品牌类型：
```ts
export type NodeId = string & { readonly __brand: "NodeId" };
export type SceneId = string & { readonly __brand: "SceneId" };
export type ResourceId = string & { readonly __brand: "ResourceId" };
export type ModuleId = string & { readonly __brand: "ModuleId" };
export type ComponentTypeId = string & { readonly __brand: "ComponentTypeId" };

export type EntityHandle = number & { readonly __brand: "EntityHandle" };
export type BackendHandle = bigint & { readonly __brand: "BackendHandle" };
```

测试：

- Persistent DTO 只出现稳定身份；
- Runtime Entity 重建后 NodeId 不变；
- Backend 重建后 ResourceId 不变；
- Scratch Target 更换后引用仍有效；
- 同一稳定 ID 不映射到两个活动语义对象；
- generation 失效后旧 Handle 被拒绝。

### 23.4 Authority Conflict Gate

```ts
export interface AuthorityRegistration {
  readonly domain: StateDomainId;
  readonly authorityId: string;
  readonly mode: "writer" | "projection" | "observer";
  readonly projectionDirection?:
    | "authority-to-projection"
    | "projection-to-authority";
}
```

必须拒绝：

- 同一 Domain 两个 Active Writer；
- Scratch → NGVGE 与 NGVGE → Scratch 的无来源循环；
- 非 Authority 来源的直接写入；
- Authority 切换过程中的双 Writer 窗口。

### 23.5 Protocol Conformance Gate

每一个 Editor Mutation Action 必须存在对应 Engine Command 编码。
示例：

```text
拖动节点    → PatchComponent
修改父级    → ReparentNode
粘贴节点树 → Transaction<CreateNode...>
删除场景    → DeleteSceneRecord / UnloadScene
```

Query 必须：

- 返回冻结快照；
- 无函数和 Native Handle；
- 具有协议版本；
- 大集合支持分页或增量读取；
- 不暴露内部 Service。

### 23.6 Transaction Gate

事务覆盖：

```text
Schema Migration
Hot Reload
Scene Import
Module Install / Upgrade
Node Tree Paste
Authority Switch
Resource Reimport
Editor Batch Mutation
```

验证：

- 任一 Command 失败不提交部分状态；
- 事件只在 Commit 后发布；
- Rollback 不重新分配稳定身份；
- Undo 不恢复过期 Backend Handle；
- 热重载失败后旧 Runtime 实例继续有效。

### 23.7 Lifecycle Conformance Gate
Harness 连续运行多轮：

```text
install
→ initialize
→ enable
→ runtime-start
→ scene-load
→ scene-unload
→ runtime-stop
→ disable
→ shutdown
→ uninstall
```

检查：

- Listener 数量回到初始值；
- Timer 清除；
- Worker 终止；
- Capability 撤销；
- Resource 引用释放；
- Adapter Binding 断开；
- DOM 节点清除；
- 异步任务不再回调。

### 23.8 Schema Migration Gate

迁移路径必须连续：

```text
v1 → v2 → v3 → current
```

Registry 拒绝：

- 缺少中间版本；
- 冲突迁移路径；
- 迁移后不符合目标 Schema；
- 迁移修改稳定 ID；
- 引入 Runtime-only 数据；
- 未标注不可逆破坏。
### 23.9 Capability Boundary Gate

```ts
interface CapabilityDescriptor {
  readonly capabilityId: string;
  readonly version: string;
  readonly providerModuleId: ModuleId;
  readonly lifetime: "project" | "scene" | "runtime" | "device";
}
```

验证：

- 模块只能访问 Manifest 声明的能力；
- Capability 不返回 Native Backend Object；
- Provider 卸载后自动失效；
- 调用失效 Capability 返回结构化错误；
- 版本不兼容时模块拒绝启用；
- 可选能力缺失时进入已声明降级状态。

### 23.10 Semantic Trace Gate

三层 Trace：

```text
Kernel Scheduling Trace
Scratch Compatibility Trace
Backend Semantic Trace
```

比较内容：

- Tick；
- Phase；
- 系统顺序；
- Broadcast 顺序；
- Script Resume 顺序；
- Clone 创建与删除；
- Variable / List 修改；
- Node Transform；
- Collision Event；
- Draw Order；
- Scene Lifecycle。
## 24. Waiver 治理

临时豁免必须显式登记：

```yaml
waiverId: ARC-0001-WAIVER-0003
rule: no-backend-import-in-runtime-semantic
scope:
  - src/legacy/temporary-adapter.ts
reason: Legacy Scratch migration bridge
owner: runtime-team
expiresAt: 2026-10-01
removalTask: TASK-0124
```

规则：

- 文件范围必须有限；
- 必须说明原因；
- 必须有负责人；
- 必须有到期日期；
- 必须关联清理任务；
- 不得用于 Project Model、Persistent DTO 或公共协议；
- 到期后 CI 自动失败；
- 永久例外只能通过新 ARC 修改规范。

---

# Part V｜0008 收尾与 ARC 启动条件

## 25. 0008 仍需完成的任务

### 25.1 0008.7.3｜Scratch Adapter Boundary Stabilization

目标：

- Scratch Binding 不再作为独立用户可见 Runtime Node；
- 用户可见 SpriteNode 与隐藏 Binding Component 分离；
- BindingId、NodeId、Scratch Target ID 明确分层；
- 所有绑定查询具有 Scene Scope；
- 删除节点时 Binding、Sidecar 和兼容子树一致清理；
- Project Explorer 只消费稳定 Tree Projection；
- 不再出现跨场景子节点串台、重复节点、空展开箭头和遍历崩溃。

正确模型：

```text
SpriteNode
└── ScratchBindingComponent（隐藏）
```

而不是：

```text
Sprite
scratch sprite.native
```

### 25.2 0008.8｜Scene Graph Persistence Review

检查：

- Runtime-only 状态是否进入持久 DTO；
- SceneId、NodeId、BindingId 是否稳定；
- Sidecar 是否具有版本；
- 非活动场景是否可从持久记录恢复；
- Scene Load / Unload 是否保持 Scope；
- Import / Restore 失败是否回滚；
- Scratch target.id 是否完全排除于持久模型。

### 25.3 0008.9｜Runtime Node Model Freeze

冻结内容：

- NodeId；
- Parent / Children；
- Component Records；
- Scene Root；
- Mutation API；
- Revision / Transaction；
- Snapshot Query；
- Registry Ownership；
- Error Model；
- Adapter Boundary。
不得冻结：

- Scratch Target 的内部结构；
- Renderer 私有字段；
- 临时后端句柄；
- 尚未定义的 Transform2D 语义。

### 25.4 0008 Final Architecture Review

最终审核问题：

1. Runtime Node 是否能在没有 Scratch Target 的情况下存在？
2. 项目文件是否完全不含 Scratch 对象引用？
3. Editor 是否通过 Mutation / Query 边界操作 Node？
4. 多场景 Scope 是否稳定？
5. 删除、复制、导入、恢复是否保持稳定身份？
6. Compatibility Adapter 是否可以被移除而不破坏核心 Scene Graph？
7. 0009 是否可以只依赖 NodeId、Schema、Authority 和 Protocol 进入施工？

全部通过后，发布 ARC-0001 Formal Freeze Announcement。

## 26. ARC 工作正式启动条件

ARC-C001 Phase 1 只有在以下条件满足后启动：

```text
[x] 0008.7 Adapter Boundary 稳定
[x] 0008.8 Persistence Review 完成
[x] 0008.9 Runtime Node Model Freeze
[x] 0008 Final Architecture Review 通过
[x] ARC-0001 文档完成正式仓库落盘
[x] 已知 Legacy Waiver 清单建立
```

## 27. 进入 0009 前的最低完成条件

必须完成：

```text
[x] Import Boundary Gate
[x] Persistent DTO Validator
[x] Stable Identity Types
[x] Authority Registry
[x] Protocol Command 基础模型
[x] Schema Registry 基础模型
[x] Scratch Adapter Boundary Test
```

可以后续扩展：

```text
[ ] 完整 Lifecycle Harness
[ ] Hot Reload Transaction
[ ] 跨运行时 Semantic Trace
[ ] Native Backend Capability Tests
[ ] Deterministic Profile
```

## 28. 0009 Transform System 的 Definition of Done

```text
[x] Transform2D 具有版本化 Schema
[x] Transform2D 使用稳定 NodeId
[x] Scratch Target 不进入组件记录
[x] Authority 注册为 Scratch Compatibility Authority
[x] Projection Direction 为 Scratch → NGVGE
[x] Editor 修改可表达为 PatchComponent
[x] Persistent DTO 通过序列化门禁
[x] Scratch Adapter 通过 Boundary Test
[x] 无 Scratch Renderer 私有对象导入
[x] 为未来 Authority 反转保留单向投影接口
[x] Runtime Transform 与 Persistent Transform 分离
[x] 高频 Runtime 更新不逐帧写回项目文件
```

### 28.1 0009 当前执行拆分

```text
[x] 0009-A Transform2D Semantic Contract Foundation
[x] 0009-B Runtime / Persistent Component Wiring
[x] 0009-C Scratch Compatibility Projection
[x] 0009-D Editor PatchComponent Compatibility Bridge
[x] 0009-E Transform DoD Certification / Browser Verify — COMPLETE / CERTIFIED / BROWSER PASS
```

0009-A / B / C / D 已完成；0009-E 综合机器门禁对上述 12 项 DoD 给出 12/12 PASS，并已在真实 Windows Chrome 环境通过 `test:browser:0009-e`。此前的 managed Chromium browser-policy block 保留为历史 evidence hold，但已被 Browser PASS 证据解除，不构成 Architecture Waiver。0009 Transform System 正式 COMPLETE / CERTIFIED。

---

# Part VI｜长期 Kernel 路线

## 29. Native Kernel 目标结构

```text
NGVGE Editor
React / Scratch Blocks / Scene Tree / Inspector
               │
               ▼
NGVGE Engine Protocol
Commands / Queries / Events / Transactions / Schemas
               │
               ▼
NGVGE Runtime Kernel
├── Identity Registry
├── Runtime Scene Graph
├── ECS Storage
├── Component Registry
├── Authority Registry
├── Scene Lifecycle
├── Scheduler
├── Event Bus
├── Resource Manager
├── Script Host
├── Animation
├── Physics APIs
├── Rendering APIs
├── Audio API
├── Job API
└── Module Host
               │
               ▼
Backend Implementations
├── Platform      SDL3
├── Rendering      Dawn
├── Physics2D      Box2D
├── Physics3D      Jolt
├── Audio        miniaudio
├── Model Import fastgltf
├── Mesh Process meshoptimizer
├── Texture      KTX2 / Basis Universal
└── Scripts      Block VM / QuickJS-ng / Lua
```

## 30. 第三方原生模块 ABI

长期建议使用版本化 C ABI：

```c
typedef struct NgvgeHostApi {
   uint32_t struct_size;
   uint32_t api_version;
   /* function pointers */
} NgvgeHostApi;

typedef struct NgvgeModuleApi {
   uint32_t struct_size;
   uint32_t api_version;
   /* callbacks and descriptors */
} NgvgeModuleApi;

NGVGE_EXPORT int ngvge_module_load(
    const NgvgeHostApi *host,
    NgvgeModuleApi *module
);
```

约束：

- 异常不能穿越 ABI；
- 内存由分配方释放；
- 字符串编码固定；
- 结构体携带 `struct_size`；
- 函数表按版本扩展；
- 模块卸载前清理任务、事件和资源；
- C++ SDK 只作为 C ABI 的便利包装。

## 31. 双运行时对照验证

未来兼容模式：

```text
Compatibility Mode → Scratch Runtime
Native Preview Mode → NGVGE Native Kernel
```

比较：

```text
Scratch Runtime Trace
        │
        ▼
Semantic Normalizer
        │
        ▼
Canonical NGVGE Trace
      ▲
      │
Native Runtime Trace
```

比较时间轴而非仅比较最终状态。

---

# Part VII｜架构评审清单

## 32. 新系统进入设计前必须回答

### Identity

- 对象的稳定身份是什么？
- Runtime Identity 与 Backend Identity 是什么？
- 重建后哪些身份必须保持不变？

### Schema

- 哪些字段持久化？
- 当前版本是什么？
- 默认值和迁移路径是什么？

### Authority

- 谁是唯一 Writer？
- Projection 方向是什么？
- 如何防止同步回路？

### Protocol

- Editor 如何发出 Command？
- Query 返回什么冻结 DTO？
- Event 在何时发布？

### Lifecycle

- Install / Enable / Disable / Uninstall 如何处理？
- Scene、Runtime、Project 和 Device 生命周期如何处理？
### Transaction

- 哪些操作必须原子化？
- 失败如何恢复旧状态与旧稳定身份？

### Capability

- 模块声明哪些 Required / Optional Capability？
- Provider 卸载后如何失效？

### Backend Isolation

- 是否有任何后端类型进入核心 DTO、Schema、Protocol 或公共 API？
- 后端替换是否需要修改 Project Model？

### Compatibility

- Scratch 行为如何规范化？
- 是否存在 Semantic Trace 或 Adapter Test？

## 33. 最终判定标准

以后衡量一个架构设计，不再只问“是否足够现代”或“是否短期实现更快”，而应问：

> **这项实现能否在不修改 Project Model、Editor Contract 和 Module Ecosystem 的前提下，被
另一个 Authority Adapter 或 Backend Implementation 替换？**

能够替换：它属于 NGVGE 架构。

不能替换：它仍然是某个具体后端对核心的侵入。

---

# Part VIII｜启动与维护说明

## 34. 后续启动 ARC 计划时的读取顺序

未来正式启动 ARC 工作时，应按以下顺序读取：

1. 本文档 `NGVGE ARC Master Plan`；
2. `ARC-0001 Kernel Independence Contract`；
3. 当前 0008 Final Architecture Review；
4. ARC-C001 当前阶段设计；
5. 与具体任务相关的从属 ARC；
6. 当前仓库的 Legacy Waiver 清单。

## 35. 本文档的维护规则

本文件是规划索引，不替代各正式 ARC。

允许更新：

- ARC 状态；
- 实施阶段；
- 文档链接；
- 已完成验收项；
- 新增从属 ARC 索引；
- 明确不改变 ARC-0001 语义的勘误。

禁止直接在本文件中：

- 削弱 ARC-0001；
- 建立永久 Backend Leakage 例外；
- 用计划变更绕过正式 ARC；
- 将临时 Waiver 转为永久架构规则。

## 36. 最终冻结声明

```text
ARC-0001:
Architecture Frozen / Formal Freeze Complete

0008 Runtime Scene Graph:
Completed / Architecture Frozen

ARC-C001:
Approved / Active

Current Engineering Priority:
0009 Transform System

ARC-C001.1 Minimum Conformance Baseline:
CERTIFIED / COMPLETE

Next Runtime Milestone:
0009 Transform System — READY / UNLOCKED FOR ENTRY
```

> NGVGE 不拥有 SDL、Dawn、Box2D、Jolt 或 miniaudio 的实现，但必须拥有它们之间的边界。
> 后期迁移不应表现为重写整个 NGVGE，而应表现为逐个替换 Authority Adapter 和 Backend
Implementation。

> 只要 Identity、Schema、Authority、Protocol、Lifecycle、Serialization、Capability 与
Compatibility 属于 NGVGE，今天在 Scratch-hosted 阶段形成的核心生态资产就不会因未来更换
内核而失效。


## 36.1 ARC-C001.1-B execution update

```text
C001.1-A Browser Revalidation: PASS
C001.1-B Stable Identity Foundation: COMPLETE
ARC-DEBT-0001: RESOLVED
C001.1 minimum requirements satisfied: 2 / 7
Next: C001.1-C Persistent DTO Foundation
0009 Transform System: BLOCKED
```

This execution update changes implementation/conformance status only and does not alter ARC-0001 normative semantics.


## 36.2 ARC-C001.1-C/D execution update

```text
C001.1-C Persistent DTO Foundation: COMPLETE
C001.1-D Schema Registry Foundation: COMPLETE
Schema Registry enforcement: ACTIVE / MANUAL
C001.1 minimum requirements satisfied: 4 / 7
Next: C001.1-E Authority Registry Foundation
0009 Transform System: BLOCKED
```

This execution update changes implementation/conformance status only and does not alter ARC-0001 normative semantics.

## 36.3 ARC-C001.1-E execution update

```text
C001.1-E Authority Registry Foundation: COMPLETE
Authority Registry enforcement: ACTIVE / MANUAL
Single Writer per State Domain: ENFORCED
C001.1 minimum requirements satisfied: 5 / 7
Next: C001.1-F Protocol DTO Foundation
0009 Transform System: BLOCKED
```

This execution update changes implementation/conformance status only and does not alter ARC-0001 normative semantics. Projection Loop Prevention, Mutation Context and Authority Switch remain assigned to later C001.3 / ARC-0003 work.


## 36.4 ARC-C001.1-F execution update

ARC-C001.1-F is complete. `src/core/protocol` now defines `ngvge.engine-protocol` version 1, generic Engine Command / Query / Event / ProtocolError DTOs, portable protocol value validation and detached/deep-frozen Query snapshots. The Protocol DTO Gate is active/manual and protected by `protocol-dto-boundary`.

C001.1 minimum readiness is now **6 / 7**. Scratch Adapter Boundary evidence remains historical until C001.1-G activates the gate; 0009 remains blocked.


## 36.5 ARC-C001.1-G execution update

ARC-C001.1-G is complete. The Scratch Adapter boundary is no longer historical-only evidence: `tools/conformance/check-scratch-adapter-boundary.js` is an independent active/manual ARC-C001 gate with a self-test, retained 0008.7.3 behavior corpus and `scratch-adapter-boundary` permanent regression. Stable BindingId/NodeId persistence is separated from volatile Scratch `targetRuntimeId`, and Core / Runtime Node semantic / generic persistence zones are checked for compatibility-representation leakage.

```text
C001.1-G Scratch Adapter Boundary Gate: COMPLETE
Scratch Adapter enforcement: ACTIVE / MANUAL
GOV-DEBT-0002: RESOLVED
C001.1 minimum implementation requirements satisfied: 7 / 7
Next: C001.1-H Minimum Baseline Certification
0009 Transform System: BLOCKED PENDING CERTIFICATION
```

This execution update changes conformance implementation status only and does not alter ARC-0001 normative semantics. Compatibility remains a partial domain because semantic trace and native comparison are later work.


## 36.6 ARC-C001.1-H certification update

ARC-C001.1-H is complete. The seven minimum C001.1 requirements are machine-certified as one entry baseline through `test:conformance:c001.1-h` and `ARC-C001.1-H-MINIMUM-BASELINE-CERTIFICATE.json`. Active Architecture Waivers are zero and no unresolved debt item blocks C001.1 or 0009.

```text
C001.1 minimum implementation requirements: 7 / 7 COVERED
Minimum Baseline Certification: PASS
Active Architecture Waivers: 0
Unresolved C001.1 / 0009 blockers: 0
Blocking Merge Policy: NOT YET ACTIVE (C001.6)
0009 Transform System: READY / UNLOCKED FOR ENTRY
```

This certification changes execution readiness only. It does not promote any whole ARC-C001 domain to globally Covered and does not claim C001.6 Blocking CI authority.
