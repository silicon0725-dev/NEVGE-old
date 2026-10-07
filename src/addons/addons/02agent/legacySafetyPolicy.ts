export const LEGACY_AGENT_CONTAINMENT_ID = "ngvge.legacy-agent-containment@1";
export const LEGACY_AGENT_MUTATION_MODE = "read-only" as const;
export const LEGACY_AGENT_MUTATION_BLOCKED_CODE = "NGVGE_LEGACY_AGENT_MUTATION_BLOCKED";

export const LEGACY_AGENT_MUTATING_TOOL_NAMES = Object.freeze([
  "applyPatch",
  "createSpriteWithSvg",
  "updateSpriteProperties",
  "addCostumeWithSvg",
  "batchAddCostumesWithSvg",
  "deleteCostume",
  "batchDeleteCostumes",
  "reorderCostume",
  "setCostumeOrder",
  "deleteSprite",
  "installExtension",
  "replaceBlocksRangeByUCF",
  "replaceScriptByUCF",
  "generateCodeFromUCF",
] as const);

const LEGACY_AGENT_MUTATING_TOOLS = new Set<string>(LEGACY_AGENT_MUTATING_TOOL_NAMES);

export const isLegacyAgentMutationTool = (toolName: string) => LEGACY_AGENT_MUTATING_TOOLS.has(toolName);

export const createLegacyAgentMutationBlockedError = (toolName: string) => {
  const error = new Error(
    `Legacy 02Agent containment blocks mutating tool "${toolName}". ` +
      "Project edits must go through the future NGVGE ChangeSet/Authority path.",
  ) as Error & { code?: string; containmentId?: string; toolName?: string };
  error.code = LEGACY_AGENT_MUTATION_BLOCKED_CODE;
  error.containmentId = LEGACY_AGENT_CONTAINMENT_ID;
  error.toolName = toolName;
  return error;
};
