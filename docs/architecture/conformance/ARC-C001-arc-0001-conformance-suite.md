---
conformance: ARC-C001
title: ARC-0001 Conformance Suite
status: Approved / Active
parent: ARC-0001
implementationPhase: ARC-C001.1-H-complete-minimum-baseline-certified-0009-unlocked
mergePolicyAfterActivation: Blocking
requiredBefore:
  - 0009 Transform System
createdAt: 2026-08-05
updatedAt: 2026-08-11
---

# ARC-C001｜ARC-0001 Conformance Suite

## Position

> 功能测试判断代码能否工作；Conformance Suite 判断代码是否仍然属于 NGVGE。

ARC-C001 是 NGVGE 的 **Architecture Compiler**。它把 ARC-0001 的文档约束转化为机器可执行的架构门禁。

当前状态为 **Approved / Active**。ARC-C001.0 已完成；C001.1-A 已通过浏览器重新验证，B–G 的七项最低基础均已完成，C001.1-H Minimum Baseline Certification 已通过。`0009 Transform System` 已解锁进入施工。Blocking Merge Policy 尚未激活，仍属于后续 ARC-C001.6。

## Planned repository model

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
│   ├── identity/
│   ├── persistent/
│   ├── schema/
│   ├── authority/
│   ├── protocol/
│   ├── lifecycle/
│   └── capabilities/
├── runtime/
├── editor/
├── compatibility/
│   └── scratch/
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

`src/core` 定义为 **NGVGE Semantic Ownership Zone**。其中禁止出现：

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

## Phases

### ARC-C001.0｜Documentation Freeze and Baseline

目标：

- 将 ARC-0001 从讨论文本整理成正式冻结文件；
- 建立 Master Plan；
- 建立 Conformance 规则目录；
- 记录 0008 当前已知技术债；
- 建立 ARC 索引和状态矩阵。

Repository execution decomposition：

```text
C001.0-A Architecture Repository Baseline       COMPLETE
C001.0-B Existing Gate Inventory               COMPLETE
C001.0-C Legacy Waiver / Debt Baseline         COMPLETE
C001.0-D Conformance Status Matrix Completion  COMPLETE
```


### C001.0-C repository baseline result

The active Architecture Waiver registry starts at **0**. Technical debt and external evidence holds are not architecture exceptions. `ARC-DEBT-0001` was recorded as non-waivable and is resolved by C001.1-B through NGVGE-owned NodeId creation and transactional legacy alias migration across project sections. See `../LEGACY-WAIVERS.md` and `../TECHNICAL-DEBT-BASELINE.md`.


### C001.0-D repository baseline result

The formal seven-domain coverage matrix is frozen in `CONFORMANCE-STATUS-MATRIX.md` / `.json`. All seven ARC-C001 domains are `partial`: existing 0008 evidence is substantial, but generic repository-wide foundations and merge authority are incomplete. `ARC-DEBT-0001` is resolved. Persistent DTO structural authority is now active/manual; Protocol DTO Foundation and the Scratch Adapter Boundary Gate are now active/manual. All seven C001.1 minimum implementation requirements are covered and C001.1-H certifies them as one 0009 entry baseline. Whole-domain Compatibility remains partial because semantic trace/native comparison is later work. 0009 is unlocked for entry; Blocking Merge Policy remains later C001.6 work.

### C001.1-A repository execution result

`src/core` is now established as the NGVGE Semantic Ownership Zone. `tools/conformance/check-import-boundaries.js` provides the first active C001 foundation gate with these fail-closed rules:

- Core relative dependencies must remain inside `src/core`;
- bare/external imports default to deny unless explicitly allowlisted;
- computed `require()` / dynamic `import()` are forbidden;
- re-exports are treated as dependencies;
- symlink/realpath escapes are forbidden;
- configured ambient Scratch/React/DOM/browser globals are forbidden when unbound.

The package allowlist is empty in C001.1-A. The gate is active/manual and intentionally not yet wired into aggregate test or Blocking CI.

### C001.1-D repository execution result

`src/core/schema` now owns the generic versioned Schema Registry foundation. `ngvge-schema-descriptor/v1` validates type/version/property/default/nullability/range/unit/resource/persistence/portable-validation metadata through Core Persistent DTO authority. `(typeId, version)` registration is append-only, duplicate versions fail closed, batch registration is atomic, and query snapshots are immutable. Runtime Component schema/migration machinery remains Runtime-specific evidence rather than the generic Core authority. Full migration graph and schema-aware record validation remain deferred.

### C001.1-E repository execution result

`src/core/authority` now owns the generic State Domain Authority Registry foundation. `ngvge-authority-registration/v1` makes writer/projection/observer roles explicit, projection registrations declare direction, and a second active writer for one State Domain fails closed. Registration batches reject conflicts before commit and snapshots are immutable. Existing Module Capability ownership remains Runtime/Module-specific evidence rather than the generic Core Authority model. Projection loop prevention, Mutation Context and transactional Authority Switch remain deferred to C001.3 / ARC-0003.

### C001.1-F repository execution result

`src/core/protocol` now owns `ngvge.engine-protocol` version 1 and the generic Engine Command / Query / Event / ProtocolError DTO vocabulary. Payloads are validated as portable data-only values and Query snapshots are detached and deeply frozen. Runtime/native object wrappers, functions, Promises, Symbols, BigInt handle representations, accessors, cycles and non-finite values fail closed. Existing Runtime Node and Scene controller protocols remain subsystem-specific evidence. Editor mutation mapping, transactions, pagination, version negotiation and transport semantics remain deferred to C001.3 / ARC-0002.


### C001.1-G repository execution result

`tools/conformance/check-scratch-adapter-boundary.js` now owns the durable Scratch compatibility boundary gate. It independently scans Core / Runtime Node semantic / generic persistence zones for Scratch adapter or volatile target identity leakage and verifies stable BindingId/NodeId persistence, target-free immutable public binding views, fail-closed `targetRuntimeId` persistence rejection and semantic-owner tree projection. The historical 0008.7.3 validator plus Scratch adapter service/lifecycle/tree-projection unit suites remain supporting behavior corpus. `scratch-adapter-boundary` is now a permanent regression and `GOV-DEBT-0002` is resolved.

All seven C001.1 minimum implementation requirements are covered. C001.1-H has certified the combined baseline and unlocked 0009 for entry.


### C001.1-H repository execution result

`tools/conformance/check-c0011-minimum-baseline.js` now owns the minimum-baseline certification contract. `test:conformance:c001.1-h` first executes the cumulative A→G gates, then validates a machine-readable certificate against package entrypoints, Architecture Waiver state, debt blockers, ARC status and Conformance status. The certificate records 7/7 coverage, zero active Architecture Waivers, zero unresolved C001.1/0009 blockers and an explicit `unlocked-for-entry` decision for 0009.

H intentionally does not activate Blocking Merge Policy or claim global domain completion. `GOV-DEBT-0001` remains assigned to C001.6; whole Identity/Schema/Authority/Protocol/Lifecycle/Serialization/Compatibility domains remain partial as scheduled.

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

- 完整 Lifecycle Harness；
- 多轮安装卸载泄漏检测；
- Timer、Listener、Worker、DOM、Capability、Resource 清理；
- Capability Manifest 声明；
- Provider 卸载自动失效；
- Capability 版本协商；
- Schema Migration Graph；
- 不可逆迁移恢复点。

### ARC-C001.5｜Semantic Trace and Determinism Foundation

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

## Gate specifications

### Import Boundary Gate

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

第一阶段使用 ESLint `no-restricted-imports`，随后增加完整依赖图扫描，防止重新导出隐藏来源。

### Persistent DTO Gate

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

### Identity Gate

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

### Authority Conflict Gate

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

### Protocol Conformance Gate

每一个 Editor Mutation Action 必须存在对应 Engine Command 编码。

```text
拖动节点 → PatchComponent
修改父级 → ReparentNode
粘贴节点树 → Transaction<CreateNode...>
删除场景 → DeleteSceneRecord / UnloadScene
```

Query 必须：

- 返回冻结快照；
- 无函数和 Native Handle；
- 具有协议版本；
- 大集合支持分页或增量读取；
- 不暴露内部 Service。

### Transaction Gate

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

### Lifecycle Conformance Gate

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

### Schema Migration Gate

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

### Capability Boundary Gate

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

### Semantic Trace Gate

三层 Trace：

```text
Kernel Scheduling Trace
Scratch Compatibility Trace
Backend Semantic Trace
```

比较内容：Tick、Phase、系统顺序、Broadcast 顺序、Script Resume 顺序、Clone 创建与删除、Variable / List 修改、Node Transform、Collision Event、Draw Order、Scene Lifecycle。

## Waiver governance

**C001.0-C baseline:** Active Architecture Waivers = 0. The registry authority is `../LEGACY-WAIVERS.json`. Project Model / Persistent DTO / public protocol findings are non-waivable and must be remediated. Expiry automation remains deferred to C001.6.

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


### C001.1-B repository execution result

C001.1-B establishes canonical NGVGE Stable Identity semantics, Host-injected identity creation, Project Node persistence v4 and transactional legacy target-derived NodeId alias migration across NGVGE project sections. C001.1-C promotes Persistent DTO structural semantics into `src/core/persistent` and makes Project Persistence validate before cloning. C001.1-D establishes the generic versioned `src/core/schema` Registry with Persistent DTO-constrained metadata. C001.1-E establishes the generic State Domain Authority Registry with fail-closed single-writer enforcement. C001.1-F establishes the Core Protocol DTO vocabulary. C001.1-G promotes Scratch Adapter boundary semantics into an independent active/manual gate, bringing minimum implementation readiness to 7/7. C001.1-H then certifies that seven-gate composition, records zero active Architecture Waivers / zero blockers, and unlocks 0009 for entry without activating C001.6 Blocking CI.
