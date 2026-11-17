 import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import "./App.css";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

type SavedState = {
  chats: Chat[];
  activeChatId: string;
};

type HealthResponse = {
  status?: string;
  model?: string;
  web_search_configured?: boolean;
};

const STORAGE_KEY = "neon-ai-chats-v1";
const ACTIVE_CHAT_KEY = "neon-ai-active-chat-v1";
const API_URL = "http://127.0.0.1:8001";

const suggestions = [
  {
    icon: "⌘",
    title: "Learn Programming",
    prompt: "Teach me programming as a beginner, step by step.",
  },
  {
    icon: "🎮",
    title: "Build Projects",
    prompt: "Help me plan a game development project in Unity using C#.",
  },
  {
    icon: "✦",
    title: "Explore AI",
    prompt: "Explain how AI works in simple language.",
  },
  {
    icon: "⚡",
    title: "Debug Code",
    prompt: "Help me find and fix a bug in my game development code.",
  },
];

const welcomeMessage: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! What can I help you with today? NEON AI can help solve game development questions, explore ideas, write code, and debug projects.",
};

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createChat(): Chat {
  return {
    id: makeId(),
    title: "New conversation",
    messages: [welcomeMessage],
    updatedAt: Date.now(),
  };
}

function isMessage(value: unknown): value is Message {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<Message>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

function isChat(value: unknown): value is Chat {
  if (!value || typeof value !== "object") return false;
  const chat = value as Partial<Chat>;
  return (
    typeof chat.id === "string" &&
    typeof chat.title === "string" &&
    Array.isArray(chat.messages) &&
    chat.messages.every(isMessage) &&
    typeof chat.updatedAt === "number"
  );
}

function loadSavedState(): SavedState {
  const fallbackChat = createChat();

  try {
    const savedChats = localStorage.getItem(STORAGE_KEY);
    const savedActiveId = localStorage.getItem(ACTIVE_CHAT_KEY);
    const parsed: unknown = savedChats ? JSON.parse(savedChats) : null;

    if (Array.isArray(parsed)) {
      const validChats = parsed.filter(isChat);
      if (validChats.length > 0) {
        const activeChatId = validChats.some((chat) => chat.id === savedActiveId)
          ? savedActiveId!
          : validChats[0].id;
        return { chats: validChats, activeChatId };
      }
    }
  } catch {
    // Invalid or unavailable browser storage starts a fresh conversation.
  }

  return { chats: [fallbackChat], activeChatId: fallbackChat.id };
}

function getChatTitle(text: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  return cleaned.length > 30 ? `${cleaned.slice(0, 30)}…` : cleaned;
}

function safeExternalUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const pattern =
    /(`[^`]+`|\*\*[\s\S]+?\*\*|(?<!\*)\*[^*\n]+\*(?!\*)|\[[^\]]+\]\([^)]+\))/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${index++}`;

    if (token.startsWith("`")) {
      parts.push(
        <code className="inline-code" key={key}>
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const safeUrl = linkMatch ? safeExternalUrl(linkMatch[2]) : null;

      if (linkMatch && safeUrl) {
        parts.push(
          <a key={key} href={safeUrl} target="_blank" rel="noreferrer">
            {linkMatch[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="copy-button"
      type="button"
      onClick={() => void copyText()}
      title={copied ? "Copied" : label}
      aria-label={copied ? "Copied" : label}
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-language">{language || "CODE"}</span>
        <CopyButton text={code} label="Copy code" />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let blockIndex = 0;

  while (index < lines.length) {
    const line = lines[index];
    const key = `block-${blockIndex++}`;

    if (!line.trim()) {
      index++;
      continue;
    }

    const fenceMatch = line.match(/^\s*```([\w.+#-]*)\s*$/);
    if (fenceMatch) {
      const language = fenceMatch[1] || "code";
      const codeLines: string[] = [];
      index++;

      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index++;
      }
      if (index < lines.length) index++;

      blocks.push(
        <CodeBlock
          key={key}
          language={language}
          code={codeLines.join("\n")}
        />,
      );
      continue;
    }

    const headingMatch = line.match(/^\s{0,3}(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const contentNodes = renderInline(headingMatch[2], key);
      if (level === 1) blocks.push(<h2 key={key}>{contentNodes}</h2>);
      else if (level === 2) blocks.push(<h3 key={key}>{contentNodes}</h3>);
      else blocks.push(<h4 key={key}>{contentNodes}</h4>);
      index++;
      continue;
    }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      blocks.push(<hr key={key} />);
      index++;
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.+)$/);
    const orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const items: string[] = [];

      while (index < lines.length) {
        const itemMatch = ordered
          ? lines[index].match(/^\s*\d+[.)]\s+(.+)$/)
          : lines[index].match(/^\s*[-*+]\s+(.+)$/);
        if (!itemMatch) break;
        items.push(itemMatch[1]);
        index++;
      }

      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag key={key}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-${itemIndex}`}>
              {renderInline(item, `${key}-${itemIndex}`)}
            </li>
          ))}
        </ListTag>,
      );
      continue;
    }

    const paragraphLines = [line];
    index++;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s{0,3}#{1,3}\s+/.test(lines[index]) &&
      !/^\s*(---+|\*\*\*+|___+)\s*$/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+[.)]\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index++;
    }

    blocks.push(
      <p key={key}>
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <span key={`${key}-${paragraphIndex}`}>
            {paragraphIndex > 0 ? " " : ""}
            {renderInline(paragraphLine, `${key}-${paragraphIndex}`)}
          </span>
        ))}
      </p>,
    );
  }

  return <div className="markdown-content">{blocks}</div>;
}

function App() {
  const [initialState] = useState<SavedState>(() => loadSavedState());
  const [chats, setChats] = useState<Chat[]>(initialState.chats);
  const [activeChatId, setActiveChatId] = useState(initialState.activeChatId);
  const [input, setInput] = useState("");
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [backendOnline, setBackendOnline] = useState(false);
  const [modelName, setModelName] = useState("Qwen 2.5 · 1.5B");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const shouldFollowLatestRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const activeChat =
    chats.find((chat) => chat.id === activeChatId) ?? chats[0];
  const messages = activeChat?.messages ?? [welcomeMessage];
  const loading = loadingChatId === activeChatId;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
      localStorage.setItem(ACTIVE_CHAT_KEY, activeChatId);
    } catch (error) {
      console.warn("NEON AI could not save chat history.", error);
    }
  }, [chats, activeChatId]);

  useEffect(() => {
    let isMounted = true;

    async function checkBackend() {
      try {
        const response = await fetch(`${API_URL}/api/health`);
        if (!response.ok) throw new Error("Health request failed");
        const data = (await response.json()) as HealthResponse;
        if (!isMounted) return;

        setBackendOnline(data.status === "healthy");
        if (data.model) setModelName(data.model);
        setWebSearchEnabled(Boolean(data.web_search_configured));
      } catch {
        if (isMounted) setBackendOnline(false);
      }
    }

    void checkBackend();
    const timer = window.setInterval(() => void checkBackend(), 15000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const scroller = chatScrollRef.current;
    if (!scroller) return;

    if (activeChat?.messages.length === 1) {
      scroller.scrollTop = 0;
    } else if (shouldFollowLatestRef.current) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages, loading, activeChatId, activeChat?.messages.length]);

  function updateChat(chatId: string, update: (chat: Chat) => Chat) {
    setChats((previous) =>
      previous.map((chat) => (chat.id === chatId ? update(chat) : chat)),
    );
  }

  function stopGeneration() {
    const controller = requestControllerRef.current;
    if (!controller) return;

    controller.abort();
    requestControllerRef.current = null;
    setLoadingChatId(null);
    inputRef.current?.focus();
  }

  async function sendMessage(text = input) {
    const content = text.trim();
    if (!content || requestControllerRef.current) return;

    const chatId = activeChatId;
    const currentChat = chats.find((chat) => chat.id === chatId);
    const currentMessages = currentChat?.messages ?? [welcomeMessage];
    shouldFollowLatestRef.current = true;

    const userMessage: Message = {
      id: makeId(),
      role: "user",
      content,
    };
    const assistantMessageId = makeId();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    };
    const conversation = [...currentMessages, userMessage];
    const controller = new AbortController();
    requestControllerRef.current = controller;

    updateChat(chatId, (chat) => ({
      ...chat,
      title:
        chat.title === "New conversation"
          ? getChatTitle(content)
          : chat.title,
      messages: [...conversation, assistantPlaceholder],
      updatedAt: Date.now(),
    }));

    setInput("");
    setNotice("");
    setLoadingChatId(chatId);

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: conversation
            .filter((message) => message.id !== "welcome")
            .slice(-16)
            .map(({ role, content: messageContent }) => ({
              role,
              content: messageContent,
            })),
        }),
      });

      if (!response.ok) {
        let detail = "The AI service could not answer your message.";
        try {
          const data = await response.json();
          if (typeof data.detail === "string") detail = data.detail;
        } catch {
          // Keep the fallback error if the response is not JSON.
        }
        throw new Error(detail);
      }

      if (!response.body) {
        throw new Error("The browser could not read the AI response stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let receivedText = "";

      const appendText = (chunk: string) => {
        if (!chunk) return;
        receivedText += chunk;
        updateChat(chatId, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === assistantMessageId
              ? { ...message, content: receivedText }
              : message,
          ),
          updatedAt: Date.now(),
        }));
      };

      const processLine = (line: string) => {
        if (!line.trim()) return;
        const data = JSON.parse(line) as {
          message?: { content?: string };
          error?: string;
          done?: boolean;
        };
        if (data.error) throw new Error(data.error);
        if (typeof data.message?.content === "string") {
          appendText(data.message.content);
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }

        buffer += decoder.decode();
        if (buffer.trim()) processLine(buffer);
        if (!receivedText.trim()) {
          throw new Error("The local AI returned an empty response.");
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (
        controller.signal.aborted ||
        (error instanceof DOMException && error.name === "AbortError")
      ) {
        updateChat(chatId, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: message.content
                    ? `${message.content}\n\n[Generation stopped by you.]`
                    : "Generation stopped.",
                }
              : message,
          ),
          updatedAt: Date.now(),
        }));
      } else {
        const detail =
          error instanceof Error ? error.message : "Unknown connection error.";
        const isConnectionError = error instanceof TypeError;

        updateChat(chatId, (chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: isConnectionError
                    ? `I couldn't reach the NEON AI backend at ${API_URL}.`
                    : `The backend couldn't complete your request. Details: ${detail}`,
                }
              : message,
          ),
          updatedAt: Date.now(),
        }));
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setLoadingChatId(null);
        inputRef.current?.focus();
      }
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function startNewChat() {
    if (loadingChatId) return;
    shouldFollowLatestRef.current = true;

    const newChat = createChat();
    setChats((previous) => [newChat, ...previous]);
    setActiveChatId(newChat.id);
    setInput("");
    setNotice("");
    setMobileSidebarOpen(false);
    inputRef.current?.focus();
  }

  function openChat(chatId: string) {
    if (loadingChatId) return;
    shouldFollowLatestRef.current = true;
    setActiveChatId(chatId);
    setInput("");
    setMobileSidebarOpen(false);
  }

  async function attachTextFile(file: File) {
    if (file.size > 10000) {
      setNotice("Choose a text or code file smaller than 10 KB.");
      return;
    }

    try {
      const fileText = await file.text();
      const prefix = `\n\n[Attached file: ${file.name}]\n`;
      const availableCharacters = Math.max(
        0,
        12000 - input.length - prefix.length,
      );

      if (availableCharacters === 0) {
        setNotice("There is no room left in the message for this file.");
        return;
      }

      setInput(
        `${input}${prefix}${fileText.slice(0, availableCharacters)}`,
      );
      setNotice("File text added to your message.");
      inputRef.current?.focus();
    } catch {
      setNotice("Could not read that file. Try a text or code file.");
    }
  }

  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  const filteredChats = sortedChats.filter((chat) =>
    chat.title.toLowerCase().includes(chatSearch.trim().toLowerCase()),
  );

  return (
    <main
      className={[
        "neon-app",
        sidebarCollapsed ? "sidebar-collapsed" : "",
        mobileSidebarOpen ? "mobile-sidebar-open" : "",
      ].join(" ")}
    >
      <aside className="sidebar">
        <div className="sidebar-brand-row">
          <a className="brand" href="#home" aria-label="NEON AI home">
            <span className="brand-mark">✳</span>
            {!sidebarCollapsed && (
              <span>
                <strong>NEON AI</strong>
                <small>GAME DEV • LEARN • CREATE</small>
              </span>
            )}
          </a>
          <button
            className="icon-button collapse-button"
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <span>＋</span>
          {!sidebarCollapsed && <span>New chat</span>}
        </button>

        {!sidebarCollapsed && (
          <>
            <label className="sidebar-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={chatSearch}
                onChange={(event) => setChatSearch(event.target.value)}
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
            </label>

            <div className="sidebar-label">YOUR CONVERSATIONS</div>
            <div className="history-list">
              {filteredChats.length ? (
                filteredChats.map((chat) => (
                  <button
                    className={`history-item ${
                      chat.id === activeChatId ? "active" : ""
                    }`}
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    title={chat.title}
                    disabled={Boolean(loadingChatId)}
                  >
                    <span aria-hidden="true">◷</span>
                    <span className="history-item-title">{chat.title}</span>
                  </button>
                ))
              ) : (
                <p className="empty-history">No matching conversations.</p>
              )}
            </div>
          </>
        )}

        <div className="sidebar-bottom">
          {!sidebarCollapsed && (
            <>
              <button
                className="settings-link"
                type="button"
                onClick={() => setSettingsOpen((value) => !value)}
              >
                <span aria-hidden="true">⚙</span>
                <span>Settings</span>
              </button>
              <div className="profile-card">
                <span className="avatar">N</span>
                <span className="profile-copy">
                  <strong>NEON AI</strong>
                  <small>Game development companion</small>
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      <section className="chat-panel" id="home">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              type="button"
              onClick={() => setMobileSidebarOpen((value) => !value)}
              aria-label="Open chat sidebar"
              title="Open chat sidebar"
            >
              ☰
            </button>
            <div className="topbar-brand">
              <span className="brand-mark small-mark">✳</span>
              <strong>NEON AI</strong>
            </div>
            <span className="topbar-divider" />
            <span className="model-name">{modelName}</span>
          </div>

          <div className="topbar-actions">
            <span className={`connection-pill ${backendOnline ? "online" : ""}`}>
              <span className="connection-dot" />
              {backendOnline ? "Backend connected" : "Backend offline"}
            </span>
            <button
              className="icon-button settings-button"
              type="button"
              onClick={() => setSettingsOpen((value) => !value)}
              aria-label="Open settings"
              title="Settings"
            >
              ⚙
            </button>
            <button className="topbar-button" onClick={startNewChat}>
              ＋ <span>New chat</span>
            </button>
          </div>
        </header>

        {settingsOpen && (
          <section className="settings-panel">
            <div>
              <strong>NEON AI settings</strong>
              <p>Model: {modelName}</p>
              <p>Web search: {webSearchEnabled ? "Ready" : "Not configured"}</p>
              <p>
                Backend: {backendOnline ? "Connected" : "Not reachable"}
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
            >
              ×
            </button>
          </section>
        )}

        <div
          className="chat-scroll"
          ref={chatScrollRef}
          onScroll={(event) => {
            const element = event.currentTarget;
            const distanceFromBottom =
              element.scrollHeight - element.scrollTop - element.clientHeight;
            shouldFollowLatestRef.current = distanceFromBottom < 80;
          }}
        >
          {messages.length === 1 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">✳</div>
              <p className="welcome-eyebrow">YOUR GAME DEV & LEARNING ASSISTANT</p>
              <h1>Hello! What can I help you with today?</h1>
              <p className="welcome-description">
                Your intelligent companion for learning, coding and creativity.
                Ask game development questions, plan a project, or get help
                debugging Unity and C#.
              </p>

              <div className="suggestion-grid">
                {suggestions.map((suggestion) => (
                  <button
                    className="suggestion-card"
                    key={suggestion.title}
                    onClick={() => void sendMessage(suggestion.prompt)}
                    disabled={Boolean(loadingChatId)}
                  >
                    <span className="suggestion-icon">{suggestion.icon}</span>
                    <span className="suggestion-copy">
                      <strong>{suggestion.title}</strong>
                      <small>{suggestion.prompt}</small>
                    </span>
                    <span className="suggestion-arrow">↗</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages
                .filter((message) => message.id !== "welcome")
                .map((message) => (
                  <article
                    className={`message-row ${message.role}`}
                    key={message.id}
                  >
                    <div className="message-avatar">
                      {message.role === "assistant" ? "✳" : "Y"}
                    </div>
                    <div className="message-body">
                      <div className="message-heading">
                        <div className="message-author">
                          {message.role === "assistant" ? "NEON AI" : "YOU"}
                        </div>
                        {message.role === "assistant" && message.content && (
                          <CopyButton
                            text={message.content}
                            label="Copy response"
                          />
                        )}
                      </div>
                      {message.content ? (
                        <div className="message-content">
                          {message.role === "assistant" ? (
                            <MarkdownContent content={message.content} />
                          ) : (
                            <div className="user-message-text">
                              {message.content}
                            </div>
                          )}
                        </div>
                      ) : message.role === "assistant" && loading ? (
                        <div className="typing-indicator" aria-label="Thinking">
                          <span />
                          <span />
                          <span />
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </div>

        <footer className="composer-area">
          {notice && <div className="composer-notice">{notice}</div>}
          <form className="composer" onSubmit={handleSubmit}>
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".txt,.md,.csv,.json,.py,.cs,.js,.ts,.tsx,.html,.css,.shader"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = "";
                if (file) void attachTextFile(file);
              }}
              aria-label="Attach a text or code file"
            />
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Ask a question or search the web..."
              rows={1}
              maxLength={12000}
              aria-label="Message NEON AI"
              disabled={Boolean(loadingChatId)}
            />

            <div className="composer-bottom">
              <div className="composer-hint">
                <button
                  className="attach-button"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={Boolean(loadingChatId)}
                  title="Attach a small text or code file"
                >
                  ＋ <span>Attach</span>
                </button>
                <span className="hint-separator">·</span>
                <span>Enter to send</span>
                <span className="hint-separator">·</span>
                <span>Shift + Enter for a new line</span>
              </div>

              <button
                className={`send-button ${loading ? "stop-button" : ""}`}
                type={loading ? "button" : "submit"}
                onClick={loading ? stopGeneration : undefined}
                disabled={
                  loading ? false : !input.trim() || Boolean(loadingChatId)
                }
                aria-label={loading ? "Stop generating" : "Send message"}
                title={loading ? "Stop generating" : "Send message"}
              >
                <span>{loading ? "■" : "↑"}</span>
              </button>
            </div>
          </form>
          <p className="disclaimer">
            NEON AI can search the web. Check important information against its
            linked sources.
          </p>
        </footer>
      </section>

      {mobileSidebarOpen && (
        <button
          className="mobile-backdrop"
          type="button"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}
    </main>
  );
}

export default App;