import { useEffect, useRef, useState } from "react";
import { FlattenedAgent, Attachment, ChatMessage } from "../types";
import { AITools } from "../tools";
import { scratchToolSchemas } from "../toolSchemas";
import { getProviderAdapter, isProviderImplemented } from "../providerAdapters";
import { callAITool } from "../toolRuntime";

interface UseChatOptions {
  messages: ChatMessage[];
  currentAgent: FlattenedAgent | null;
  updateSessionMessages: (newMessages: ChatMessage[], targetSessionId?: string) => string;
  enableReasoning: boolean;
  vm: any;
}

const createMessageId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const STREAM_UPDATE_INTERVAL_MS = 50;

const hasValidToolCallShape = (toolCall: NonNullable<ChatMessage["tool_calls"]>[number]) =>
  Boolean(toolCall?.id && toolCall?.function?.name && typeof toolCall?.function?.arguments === "string");

const stripToolCalls = (message: ChatMessage): ChatMessage => {
  const { tool_calls, anthropic_content_blocks, ...rest } = message;
  const safeAnthropicBlocks = anthropic_content_blocks?.filter((block) => block.type !== "tool_use");
  if (safeAnthropicBlocks?.length) {
    return { ...rest, anthropic_content_blocks: safeAnthropicBlocks };
  }
  return rest;
};

const sanitizeMessagesForProvider = (messages: ChatMessage[]) => {
  const sanitized: ChatMessage[] = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];

    if (message.role === "tool") {
      continue;
    }

    const hasAnthropicToolUseBlocks = message.anthropic_content_blocks?.some((block) => block.type === "tool_use");

    if (message.role !== "assistant") {
      sanitized.push(message);
      continue;
    }

    if (!message.tool_calls?.length && hasAnthropicToolUseBlocks) {
      const strippedMessage = stripToolCalls(message);
      if (strippedMessage.content || strippedMessage.reasoning || strippedMessage.anthropic_content_blocks?.length) {
        sanitized.push(strippedMessage);
      }
      continue;
    }

    if (!message.tool_calls?.length) {
      sanitized.push(message);
      continue;
    }

    const validToolCalls = message.tool_calls.filter(hasValidToolCallShape);
    const toolResults: ChatMessage[] = [];
    let cursor = index + 1;
    while (cursor < messages.length && messages[cursor].role === "tool") {
      toolResults.push(messages[cursor]);
      cursor++;
    }

    const resultIds = new Set(toolResults.map((toolMessage) => toolMessage.tool_call_id).filter(Boolean));
    const answeredToolCalls = validToolCalls.filter((toolCall) => resultIds.has(toolCall.id));
    const hasCompleteToolExchange = validToolCalls.length > 0 && answeredToolCalls.length === validToolCalls.length;

    if (hasCompleteToolExchange) {
      sanitized.push({
        ...message,
        tool_calls: answeredToolCalls,
      });
      answeredToolCalls.forEach((toolCall) => {
        const toolResult = toolResults.find((item) => item.tool_call_id === toolCall.id);
        if (toolResult) {
          sanitized.push(toolResult);
        }
      });
      index = cursor - 1;
      continue;
    }

    const strippedMessage = stripToolCalls(message);
    if (strippedMessage.content || strippedMessage.reasoning) {
      sanitized.push(strippedMessage);
    }
    index = cursor - 1;
  }

  return sanitized;
};

const ANTHROPIC_PROVIDERS = new Set<FlattenedAgent["provider"]>(["anthropic", "custom_anthropic"]);

const toProviderMessage = (
  message: ChatMessage,
  content: string,
  options: { includeAssistantMetadata?: boolean; provider?: FlattenedAgent["provider"] } = {},
) => {
  const validToolCalls = message.tool_calls?.filter(hasValidToolCallShape) || [];

  return {
    role: message.role,
    content,
    ...(options.includeAssistantMetadata && message.reasoning && ANTHROPIC_PROVIDERS.has(options.provider || "openai")
      ? {
          reasoning: message.reasoning,
        }
      : {}),
    ...(options.includeAssistantMetadata && message.reasoning && !ANTHROPIC_PROVIDERS.has(options.provider || "openai")
      ? {
          reasoning_content: message.reasoning,
        }
      : {}),
    ...(options.includeAssistantMetadata && message.anthropic_content_blocks?.length && ANTHROPIC_PROVIDERS.has(options.provider || "openai")
      ? {
          anthropic_content_blocks: message.anthropic_content_blocks,
        }
      : {}),
    ...(validToolCalls.length
      ? {
          tool_calls: validToolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: toolCall.type || "function",
            function: toolCall.function,
          })),
        }
      : {}),
    ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
    ...(message.name ? { name: message.name } : {}),
  };
};

const buildRequestMessages = (
  messages: ChatMessage[],
  options: { includeAssistantMetadata?: boolean; provider?: FlattenedAgent["provider"] } = {},
) =>
  sanitizeMessagesForProvider(messages).map((message) => {
    if (message.role !== "user" || !message.attachments?.length) {
      return toProviderMessage(message, message.content, options);
    }

    const attachmentText = message.attachments
      .map(
        (attachment, index) =>
          `[Attachment ${index + 1}] ${attachment.name} (${attachment.kind})${
            attachment.kind === "workspace-ucf-range" && attachment.meta?.startBlockId && attachment.meta?.endBlockId
              ? ` [editable-range startBlockId=${attachment.meta.startBlockId}, endBlockId=${attachment.meta.endBlockId}]`
              : ""
          }:\n${attachment.content}`,
      )
      .join("\n\n");

    const content = message.content
      ? `${message.content}\n\n=== Attachments ===\n${attachmentText}`
      : `=== Attachments ===\n${attachmentText}`;

    return toProviderMessage(message, content, options);
  });

export const SYSTEM_PROMPT = `You are Legacy 02Agent running inside NGVGE under LSC-0 containment.

Language:
- Use the same language as the user's latest message. If unclear, use zh-CN.

Containment contract:
- This legacy Agent is READ-ONLY. Do not modify the project, install extensions, create/delete/reorder sprites or costumes, patch scripts, or change runtime state.
- Mutating tools are intentionally unavailable and runtime-blocked. Do not ask the user to bypass this restriction.
- If the user requests a project edit, analyze the requested change and describe what should be changed, but do not claim it was applied.
- Never request, reveal, or infer API keys, bridge tokens, Git credentials, or other secrets.

Available tools:
- getProjectOverview: inspect project structure and compact runtime/project metadata.
- listFiles: list virtual Scratch project files.
- readFile: read virtual project files and documentation.
- readVariable / readListSlice / searchList / getDataSummary: inspect project data with bounded reads.
- searchFiles: search project text and docs.
- searchBlocks / getBlockHelp / getScratchGuide: inspect Scratch block and DSL documentation.
- searchExtensions: inspect known extension metadata only; installation is unavailable.
- listCostumes: inspect sprite/backdrop assets and order.
- getDiagnostics: analyze current virtual JS/SVG diagnostics.

Workflow:
1) Prefer getProjectOverview first, then use narrower read/search tools.
2) Keep reads bounded for large variables, lists, scripts, or assets.
3) Clearly distinguish observed project state from recommendations.
4) When an edit is requested, produce a proposed change plan suitable for the future NGVGE ChangeSet/Authority path.
5) Do not claim that any mutation was performed in this legacy containment mode.`

export function useChat({
  messages,
  currentAgent,
  updateSessionMessages,
  enableReasoning,
  vm,
}: UseChatOptions) {
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const aiToolsRef = useRef<AITools | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const callTool = async (functionName: string, args: Record<string, any>) =>
    callAITool(aiToolsRef.current as Record<string, any> | null, functionName, args);

  useEffect(() => {
    if (!aiToolsRef.current && vm) {
      aiToolsRef.current = new AITools(vm);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [vm]);

  const handleSend = async () => {
    if (isGenerating) return;
    if (!inputText.trim() && attachments.length === 0) return;

    if (!currentAgent) {
      updateSessionMessages([
        ...messages,
        {
          id: createMessageId(),
          role: "assistant",
          content: "Error: 当前没有可用的 AI Agent，请先在设置中添加或恢复一个 Agent。",
        },
      ]);
      return;
    }

    if (!isProviderImplemented(currentAgent.provider)) {
      updateSessionMessages([
        ...messages,
        {
          id: createMessageId(),
          role: "assistant",
          content: `Error: 当前 Provider '${currentAgent.provider}' 暂未接入。请改用 OpenAI、智谱、DeepSeek 或 Custom(OpenAI-compatible)。`,
        },
      ]);
      return;
    }

    const newMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: inputText,
      attachments,
    };
    const cleanedPreviousMessages = sanitizeMessagesForProvider(messages);
    const newMessages = [...cleanedPreviousMessages, newMessage];
    let sessionId = "";

    sessionId = updateSessionMessages(newMessages);
    setInputText("");
    setAttachments([]);
    setIsGenerating(true);
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    let currentMessages = newMessages;
    let pendingStreamMessages: ChatMessage[] | null = null;
    let streamUpdateTimer: number | null = null;

    const flushStreamMessages = () => {
      if (streamUpdateTimer !== null) {
        window.clearTimeout(streamUpdateTimer);
        streamUpdateTimer = null;
      }
      if (!pendingStreamMessages) return;
      updateSessionMessages(pendingStreamMessages, sessionId);
      pendingStreamMessages = null;
    };

    const scheduleStreamMessagesUpdate = () => {
      pendingStreamMessages = currentMessages;
      if (streamUpdateTimer !== null) return;
      streamUpdateTimer = window.setTimeout(() => {
        streamUpdateTimer = null;
        if (!pendingStreamMessages) return;
        updateSessionMessages(pendingStreamMessages, sessionId);
        pendingStreamMessages = null;
      }, STREAM_UPDATE_INTERVAL_MS);
    };

    try {
      const providerAdapter = getProviderAdapter(currentAgent.provider);
      let shouldContinue = true;
      while (shouldContinue) {
        const requestMessages = sanitizeMessagesForProvider(currentMessages);
        const assistantMessageIndex = currentMessages.length;
        currentMessages = [
          ...currentMessages,
          {
            id: createMessageId(),
            role: "assistant",
            content: "",
            reasoning: "",
            reasoningStartedAt: enableReasoning ? Date.now() : undefined,
          },
        ];
        updateSessionMessages(currentMessages, sessionId);

        const data = await providerAdapter.sendChatCompletion({
          agent: currentAgent,
          messages: [
            { id: createMessageId(), role: "system", content: SYSTEM_PROMPT },
            ...buildRequestMessages(sanitizeMessagesForProvider(requestMessages), {
              includeAssistantMetadata: enableReasoning,
              provider: currentAgent.provider,
            }),
          ],
          tools: scratchToolSchemas,
          toolChoice: "auto",
          enableReasoning,
          signal: abortControllerRef.current.signal,
          onReasoningDelta: (delta) => {
            currentMessages = currentMessages.map((message, index) =>
              index === assistantMessageIndex
                ? {
                    ...message,
                    reasoning: `${message.reasoning || ""}${delta}`,
                    reasoningStartedAt: message.reasoningStartedAt || Date.now(),
                  }
                : message,
            );
            scheduleStreamMessagesUpdate();
          },
          onTextDelta: (delta) => {
            currentMessages = currentMessages.map((message, index) =>
              index === assistantMessageIndex
                ? {
                    ...message,
                    content: `${message.content}${delta}`,
                  }
                : message,
            );
            scheduleStreamMessagesUpdate();
          },
          onToolCallsDelta: (toolCalls) => {
            currentMessages = currentMessages.map((message, index) =>
              index === assistantMessageIndex
                ? {
                    ...message,
                    tool_calls: toolCalls,
                  }
                : message,
            );
            scheduleStreamMessagesUpdate();
          },
        });
        flushStreamMessages();
        const responseMessage = data.choices[0].message as ChatMessage;
        const responseToolCalls = responseMessage.tool_calls?.filter(
          (toolCall) => toolCall?.id || toolCall?.function?.name,
        );

        currentMessages = currentMessages.map((message, index) =>
          index === assistantMessageIndex
            ? {
                ...message,
                ...responseMessage,
                content: responseMessage.content || message.content,
                reasoning: responseMessage.reasoning || message.reasoning,
                ...(responseToolCalls?.length ? { tool_calls: responseToolCalls } : { tool_calls: undefined }),
                reasoningStartedAt: message.reasoningStartedAt,
                reasoningEndedAt:
                  message.reasoningStartedAt && (responseMessage.reasoning || message.reasoning)
                    ? Date.now()
                    : message.reasoningEndedAt,
              }
            : message,
        );
        updateSessionMessages(currentMessages, sessionId);

        if (responseToolCalls && responseToolCalls.length > 0) {
          for (const toolCall of responseToolCalls) {
            const functionName = toolCall.function.name;
            let toolResult = "";

            currentMessages = [
              ...currentMessages,
              {
                id: createMessageId(),
                role: "tool",
                tool_call_id: toolCall.id,
                name: functionName,
                content: "",
              },
            ];
            updateSessionMessages(currentMessages, sessionId);

            try {
              let args: Record<string, any> = {};
              try {
                const parsedArgs = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
                if (!parsedArgs || typeof parsedArgs !== "object" || Array.isArray(parsedArgs)) {
                  throw new Error("Tool arguments must be a JSON object");
                }
                args = parsedArgs;
              } catch (parseError: any) {
                throw new Error(`Invalid tool arguments: ${parseError.message}`);
              }

              const result = await callTool(functionName, args);
              try {
                toolResult = typeof result === "object" ? JSON.stringify(result) : String(result);
              } catch (stringifyError: any) {
                toolResult = `Error: Tool result could not be serialized: ${stringifyError.message}`;
              }
            } catch (err: any) {
              toolResult = `Error: ${err.message}`;
            }

            currentMessages = [
              ...currentMessages.slice(0, -1),
              {
                id: createMessageId(),
                role: "tool",
                tool_call_id: toolCall.id,
                name: functionName,
                content: toolResult,
              },
            ];
            updateSessionMessages(currentMessages, sessionId);
          }
        } else {
          shouldContinue = false;
        }
      }
    } catch (err: any) {
      flushStreamMessages();
      if (err?.name === "AbortError") {
        const trimmedMessages = currentMessages.filter(
          (message, index) =>
            !(
              index === currentMessages.length - 1 &&
              message.role === "assistant" &&
              !message.content &&
              !message.reasoning &&
              !message.tool_calls?.length
            ),
        );
        updateSessionMessages(sanitizeMessagesForProvider(trimmedMessages), sessionId);
        return;
      }
      updateSessionMessages(
        [...sanitizeMessagesForProvider(currentMessages), { id: createMessageId(), role: "assistant", content: `Error: ${err.message}` }],
        sessionId,
      );
    } finally {
      flushStreamMessages();
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleStopGenerating = () => {
    abortControllerRef.current?.abort();
  };

  return {
    inputText,
    setInputText,
    isGenerating,
    attachments,
    setAttachments,
    handleSend,
    handleStopGenerating,
  };
}
