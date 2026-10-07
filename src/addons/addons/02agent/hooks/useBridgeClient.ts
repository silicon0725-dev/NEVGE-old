import { useCallback, useEffect, useRef, useState } from "react";
import { AITools } from "../tools";
import { callAITool } from "../toolRuntime";
import { createBridgeManifest } from "../bridgeManifest";
import { BridgeConfig, BridgeStatus } from "../types";
import legacyCredentialVault from "../../../../lib/credentials/legacy-credential-vault";
import createLegacyBridgeToken from "../../../../lib/credentials/legacy-bridge-token";
import {
  LEGACY_BRIDGE_STORAGE_KEY,
  LEGACY_BRIDGE_CREDENTIAL_NAMESPACE,
  LEGACY_BRIDGE_CREDENTIAL_KEY,
} from "../../../../lib/credentials/legacy-credential-contract";

type BridgeMessage = {
  id?: string;
  type?: string;
  method?: string;
  params?: Record<string, any>;
  result?: unknown;
  error?: { message: string };
};

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  enabled: false,
  port: 40202,
  token: "",
};
const MAX_BRIDGE_MESSAGE_CHARS = 2 * 1024 * 1024;
const BRIDGE_STORAGE_KEY = LEGACY_BRIDGE_STORAGE_KEY;
const BRIDGE_CREDENTIAL_NAMESPACE = LEGACY_BRIDGE_CREDENTIAL_NAMESPACE;
const BRIDGE_CREDENTIAL_KEY = LEGACY_BRIDGE_CREDENTIAL_KEY;

const safeStringifyBridgeMessage = (message: BridgeMessage) => {
  try {
    const text = JSON.stringify(message);
    if (text.length > MAX_BRIDGE_MESSAGE_CHARS) {
      return JSON.stringify({
        id: message.id,
        error: {
          message: `02Agent bridge response exceeded ${MAX_BRIDGE_MESSAGE_CHARS} characters; retry with a narrower tool call.`,
        },
      });
    }
    return text;
  } catch (error) {
    return JSON.stringify({
      id: message.id,
      error: { message: error instanceof Error ? error.message : String(error) },
    });
  }
};

const persistBridgeMetadata = (config: Pick<BridgeConfig, "enabled" | "port">) => {
  try {
    window.localStorage.setItem(
      BRIDGE_STORAGE_KEY,
      JSON.stringify({ enabled: Boolean(config.enabled), port: Number(config.port) || DEFAULT_BRIDGE_CONFIG.port }),
    );
  } catch {
    // The bridge remains usable for this page session when durable metadata storage is unavailable.
  }
};

const loadBridgeConfig = (): BridgeConfig => {
  let enabled = DEFAULT_BRIDGE_CONFIG.enabled;
  let port = DEFAULT_BRIDGE_CONFIG.port;
  let legacyToken = "";

  try {
    const raw = window.localStorage.getItem(BRIDGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      enabled = Boolean(parsed.enabled);
      port = Number(parsed.port) || DEFAULT_BRIDGE_CONFIG.port;
      legacyToken = typeof parsed.token === "string" ? parsed.token : "";
    }
  } catch {
    // Use defaults and an ephemeral token.
  }

  if (legacyToken) {
    legacyCredentialVault.set(BRIDGE_CREDENTIAL_NAMESPACE, BRIDGE_CREDENTIAL_KEY, legacyToken);
  }
  const token = legacyCredentialVault.get(BRIDGE_CREDENTIAL_NAMESPACE, BRIDGE_CREDENTIAL_KEY) || createLegacyBridgeToken();
  legacyCredentialVault.set(BRIDGE_CREDENTIAL_NAMESPACE, BRIDGE_CREDENTIAL_KEY, token);

  // LSC-0 migration: rewrite legacy bridge config without its plaintext token.
  persistBridgeMetadata({ enabled, port });
  return { enabled, port, token };
};

const saveBridgeConfig = (config: BridgeConfig) => {
  legacyCredentialVault.set(BRIDGE_CREDENTIAL_NAMESPACE, BRIDGE_CREDENTIAL_KEY, config.token || "");
  persistBridgeMetadata(config);
};

export const useBridgeClient = (vm: any) => {
  const [config, setConfig] = useState<BridgeConfig>(() => loadBridgeConfig());
  const [status, setStatus] = useState<BridgeStatus>(config.enabled ? "connecting" : "disabled");
  const [lastError, setLastError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(false);
  const aiToolsRef = useRef<AITools | null>(null);

  useEffect(() => {
    if (vm && !aiToolsRef.current) {
      aiToolsRef.current = new AITools(vm);
    }
  }, [vm]);

  const buildManifest = useCallback(() => {
    let projectOverview: unknown = null;
    try {
      projectOverview = aiToolsRef.current?.getProjectOverview?.() || null;
    } catch {
      projectOverview = null;
    }
    return createBridgeManifest({ projectOverview });
  }, []);

  const send = useCallback((message: BridgeMessage) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(safeStringifyBridgeMessage(message));
    return true;
  }, []);

  const handleRequest = useCallback(
    async (message: BridgeMessage) => {
      if (!message.id) return;

      try {
        if (message.method === "getManifest") {
          send({ id: message.id, result: buildManifest() });
          return;
        }

        if (message.method === "callTool") {
          const toolName = String(message.params?.name || "");
          const args = (message.params?.arguments && typeof message.params.arguments === "object"
            ? message.params.arguments
            : {}) as Record<string, any>;
          const result = await callAITool(aiToolsRef.current as Record<string, any> | null, toolName, args);
          send({ id: message.id, result });
          return;
        }

        send({ id: message.id, error: { message: `Unsupported bridge method: ${message.method || "unknown"}` } });
      } catch (error) {
        send({ id: message.id, error: { message: error instanceof Error ? error.message : String(error) } });
      }
    },
    [buildManifest, send],
  );

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    socketRef.current?.close();
    socketRef.current = null;
    setStatus("disabled");
  }, []);

  const connect = useCallback(() => {
    if (!config.enabled) {
      setStatus("disabled");
      return;
    }
    if (!vm) {
      setLastError("Scratch VM is not ready");
      setStatus("error");
      return;
    }

    shouldReconnectRef.current = true;
    setStatus("connecting");
    setLastError("");
    socketRef.current?.close();

    const socket = new WebSocket(`ws://127.0.0.1:${config.port}/agent?token=${encodeURIComponent(config.token)}`);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      setLastError("");
      send({ type: "register", result: buildManifest() });
    });

    socket.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(String(event.data)) as BridgeMessage;
        void handleRequest(message);
      } catch (error) {
        setLastError(error instanceof Error ? error.message : String(error));
      }
    });

    socket.addEventListener("close", () => {
      if (socketRef.current === socket) socketRef.current = null;
      if (!shouldReconnectRef.current) return;
      setStatus("connecting");
      reconnectTimerRef.current = window.setTimeout(connect, 1500);
    });

    socket.addEventListener("error", () => {
      setLastError(`等待 AI/Skill 启动 127.0.0.1:${config.port} 桥接服务。启动后会自动连接。`);
      setStatus("error");
    });
  }, [buildManifest, config.enabled, config.port, config.token, handleRequest, send, vm]);

  useEffect(() => {
    saveBridgeConfig(config);
    if (config.enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
      socketRef.current?.close();
    };
  }, [config, connect, disconnect]);

  const toggleBridge = useCallback(() => {
    setConfig((previous) => ({
      ...previous,
      enabled: !previous.enabled,
      token: previous.token || createLegacyBridgeToken(),
    }));
  }, []);

  const resetToken = useCallback(() => {
    setConfig((previous) => ({ ...previous, token: createLegacyBridgeToken() }));
  }, []);

  return {
    bridgeConfig: config,
    bridgeStatus: status,
    bridgeLastError: lastError,
    toggleBridge,
    resetToken,
  };
};
