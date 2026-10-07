import { scratchToolSchemas } from "./toolSchemas";
import { SYSTEM_PROMPT } from "./hooks/useChat";
import { LEGACY_AGENT_CONTAINMENT_ID, LEGACY_AGENT_MUTATION_MODE } from "./legacySafetyPolicy";

export const BRIDGE_MANIFEST_VERSION = 2;

export const createBridgeManifest = (options: { projectOverview?: unknown } = {}) => ({
  protocol: "02agent-bridge",
  manifestVersion: BRIDGE_MANIFEST_VERSION,
  agent: {
    id: "02agent",
    name: "02Agent",
    version: "0.1.0",
    runtime: "scratch-gui-addon",
  },
  capabilities: {
    dynamicTools: true,
    toolCalling: true,
    prompts: true,
    projectContext: true,
    readOnly: true,
  },
  security: {
    transport: "ws://127.0.0.1",
    requiresToken: true,
    apiKeysExposed: false,
    dangerousOperationsMayMutateProject: false,
    containmentId: LEGACY_AGENT_CONTAINMENT_ID,
    mutationMode: LEGACY_AGENT_MUTATION_MODE,
  },
  prompts: {
    system: SYSTEM_PROMPT,
    publicGuidance:
      "Legacy 02Agent is contained in read-only mode. Use exposed tools only to inspect and analyze the currently open project. Project mutation and extension installation are unavailable. Never assume API keys or model settings are available through the bridge.",
  },
  tools: scratchToolSchemas,
  projectOverview: options.projectOverview || null,
});
