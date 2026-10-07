import { useCallback, useEffect, useMemo, useState } from "react";
import { Agent, FlattenedAgent } from "../types";
import { PROVIDER_DEFAULT_URLS } from "../constants";
import legacyCredentialVault from "../../../../lib/credentials/legacy-credential-vault";
import { LEGACY_AGENT_STORAGE_KEY, LEGACY_AGENT_CREDENTIAL_NAMESPACE } from "../../../../lib/credentials/legacy-credential-contract";

interface ExportedAgentFile {
  version: 2;
  exportedAt: string;
  credentialsIncluded: false;
  agent: Agent;
}

const AGENT_STORAGE_KEY = LEGACY_AGENT_STORAGE_KEY;
const CURRENT_MODEL_STORAGE_KEY = "AI_ASSISTANT_CURRENT_AGENT_ID";
const AGENT_CREDENTIAL_NAMESPACE = LEGACY_AGENT_CREDENTIAL_NAMESPACE;

const DEFAULT_AGENTS: Agent[] = [
  {
    id: "default-1",
    name: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    models: [
      {
        id: "default-1-model-1",
        name: "Default GPT-3.5",
        modelId: "gpt-3.5-turbo",
      }
    ],
  },
];

const safeReadLocalStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeWriteLocalStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ephemeral state still remains usable when browser storage is unavailable.
  }
};

const normalizeAgentModels = (agent: Agent): Agent => {
  if (Array.isArray(agent.models) && agent.models.length > 0) return agent;
  return {
    ...agent,
    models: [
      {
        id: `${agent.id}-model`,
        name: (agent as any).displayName || agent.name || "Default Model",
        modelId: (agent as any).modelName || "gpt-3.5-turbo",
        maxTokens: (agent as any).maxTokens,
      },
    ],
  };
};

const stripAgentCredentials = (agent: Agent): Agent => ({
  ...agent,
  apiKey: "",
  models: Array.isArray(agent.models) ? agent.models.map((model) => ({ ...model })) : [],
});

const hydrateAgentCredential = (agent: Agent): Agent => {
  const normalized = normalizeAgentModels(agent);
  const legacyApiKey = typeof normalized.apiKey === "string" ? normalized.apiKey : "";
  if (legacyApiKey) {
    legacyCredentialVault.set(AGENT_CREDENTIAL_NAMESPACE, normalized.id, legacyApiKey);
  }
  return {
    ...normalized,
    apiKey: legacyCredentialVault.get(AGENT_CREDENTIAL_NAMESPACE, normalized.id),
  };
};

const readStoredAgents = (): Agent[] => {
  const raw = safeReadLocalStorage(AGENT_STORAGE_KEY);
  if (!raw) return DEFAULT_AGENTS.map((agent) => ({ ...agent, models: agent.models.map((model) => ({ ...model })) }));

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Stored Agent data is not an array");
    const hydrated = parsed.map((item) => hydrateAgentCredential(item as Agent));

    // LSC-0 migration: immediately remove any legacy plaintext API keys from durable storage.
    safeWriteLocalStorage(AGENT_STORAGE_KEY, JSON.stringify(hydrated.map(stripAgentCredentials)));
    return hydrated;
  } catch {
    return DEFAULT_AGENTS.map((agent) => ({ ...agent, models: agent.models.map((model) => ({ ...model })) }));
  }
};

const readStoredModelId = () => safeReadLocalStorage(CURRENT_MODEL_STORAGE_KEY) || "default-1-model-1";

export function useAgents() {
  const [agents, setAgentsState] = useState<Agent[]>(readStoredAgents);
  const [currentModelId, setCurrentModelIdState] = useState<string>(readStoredModelId);
  const [showSettings, setShowSettings] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);

  const setCurrentModelId = useCallback((modelId: string) => {
    setCurrentModelIdState(modelId);
    safeWriteLocalStorage(CURRENT_MODEL_STORAGE_KEY, modelId);
  }, []);

  const setAgents = useCallback((nextAgents: Agent[]) => {
    const hydrated = nextAgents.map((agent) => {
      const normalized = normalizeAgentModels(agent);
      legacyCredentialVault.set(AGENT_CREDENTIAL_NAMESPACE, normalized.id, normalized.apiKey || "");
      return {
        ...normalized,
        apiKey: legacyCredentialVault.get(AGENT_CREDENTIAL_NAMESPACE, normalized.id),
      };
    });
    setAgentsState(hydrated);
    safeWriteLocalStorage(AGENT_STORAGE_KEY, JSON.stringify(hydrated.map(stripAgentCredentials)));
  }, []);

  const flattenedModels = useMemo<FlattenedAgent[]>(() => {
    return agents.flatMap((agent) => {
      const models = normalizeAgentModels(agent).models;
      return models.map((model) => ({
        id: model.id,
        agentId: agent.id,
        provider: agent.provider,
        baseUrl: agent.baseUrl,
        apiKey: agent.apiKey,
        modelName: model.modelId,
        displayName: model.name,
        maxTokens: model.maxTokens,
      }));
    });
  }, [agents]);

  const currentAgent = useMemo(() => {
    return flattenedModels.find((model) => model.id === currentModelId) || flattenedModels[0] || null;
  }, [flattenedModels, currentModelId]);

  useEffect(() => {
    if (!agents.length) {
      setAgents(DEFAULT_AGENTS);
      setCurrentModelId(DEFAULT_AGENTS[0].models[0].id);
      return;
    }

    if (!flattenedModels.some((model) => model.id === currentModelId)) {
      setCurrentModelId(flattenedModels[0]?.id || "");
    }
  }, [agents, currentModelId, setAgents, setCurrentModelId, flattenedModels]);

  const handleSaveAgent = (newAgent: Agent) => {
    const nextAgents = editingAgent
      ? agents.map((agent) => (agent.id === editingAgent.id ? newAgent : agent))
      : [...agents, newAgent];

    setAgents(nextAgents);

    if (!currentModelId || editingAgent?.id === newAgent.id) {
      setCurrentModelId(newAgent.models[0]?.id || "");
    }
    setEditingAgent(null);
  };

  const handleDeleteAgent = (id: string) => {
    if (agents.length <= 1) return;

    legacyCredentialVault.delete(AGENT_CREDENTIAL_NAMESPACE, id);
    const nextAgents = agents.filter((agent) => agent.id !== id);
    setAgents(nextAgents);

    const isCurrentModelDeleted = agents.find((agent) => agent.id === id)?.models.some((model) => model.id === currentModelId);
    if (isCurrentModelDeleted) {
      const firstAgent = nextAgents[0];
      setCurrentModelId(firstAgent?.models[0]?.id || "");
    }

    if (editingAgent?.id === id) setEditingAgent(null);
  };

  const handleExportAgent = (agentId: string) => {
    const agent = agents.find((item) => item.id === agentId);
    if (!agent) return;

    const exportAgent = stripAgentCredentials(normalizeAgentModels(agent));
    const fileData: ExportedAgentFile = {
      version: 2,
      exportedAt: new Date().toISOString(),
      credentialsIncluded: false,
      agent: exportAgent,
    };

    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-agent-${(exportAgent.name || "agent").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase() || exportAgent.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportAgents = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    let importedAgent = (parsed.agent && typeof parsed.agent === "object" ? parsed.agent : parsed) as Record<string, unknown>;

    if (!importedAgent || typeof importedAgent.provider !== "string" || typeof importedAgent.baseUrl !== "string") {
      throw new Error("导入失败：文件内容不是有效的 Agent 配置");
    }

    if (!importedAgent.models) {
      importedAgent = {
        ...importedAgent,
        name: importedAgent.displayName || importedAgent.name || "Imported Agent",
        models: [
          {
            id: `${Date.now()}-model`,
            name: importedAgent.displayName || "Imported Model",
            modelId: importedAgent.modelName || "gpt-3.5-turbo",
            maxTokens: importedAgent.maxTokens,
          }
        ]
      };
    }

    const nextAgent: Agent = {
      ...importedAgent,
      apiKey: typeof importedAgent.apiKey === "string" ? importedAgent.apiKey : "",
      id: Date.now().toString(),
    } as Agent;

    nextAgent.models = nextAgent.models.map((model) => ({
      ...model,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    }));

    const nextAgents = [...agents, nextAgent];
    setAgents(nextAgents);
    setCurrentModelId(nextAgent.models[0]?.id || "");
    setEditingAgent({
      ...nextAgent,
      apiKey: legacyCredentialVault.get(AGENT_CREDENTIAL_NAMESPACE, nextAgent.id),
    });
  };

  return {
    agents,
    flattenedModels,
    currentModelId,
    setCurrentModelId,
    currentAgent,
    showSettings,
    setShowSettings,
    editingAgent,
    setEditingAgent,
    handleSaveAgent,
    handleDeleteAgent,
    handleExportAgent,
    handleImportAgents,
  };
}
