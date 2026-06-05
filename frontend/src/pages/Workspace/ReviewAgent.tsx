import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { streamReviewChat } from "../../lib/api";
import type { ChatMessage, Finding } from "../../types";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";
import { cn } from "../../lib/cn";

const PROMPTS = ["解释当前风险", "给出修改条款", "列出高危项"];

export function ReviewAgent({ taskId, currentFinding }: { taskId: number; currentFinding: Finding | null }) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "我可以基于当前审查结果继续解释风险、整理修改建议，或围绕选中的意见生成更具体的处理口径。",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [modelAvailable, setModelAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, sending]);

  async function send(text = input) {
    const message = text.trim();
    if (!message || sending) return;
    const history = messages;
    const assistantIndex = history.length + 1;
    setMessages([...history, { role: "user", content: message }, { role: "assistant", content: "" }]);
    setInput("");
    setSending(true);
    try {
      await streamReviewChat(
        taskId,
        {
          message,
          history,
          finding_id: currentFinding?.id ?? null,
        },
        (delta) => {
          setMessages((prev) =>
            prev.map((item, index) => (index === assistantIndex ? { ...item, content: item.content + delta } : item))
          );
        },
        (status) => setModelAvailable(status.model_available)
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((item, index) =>
          index === assistantIndex ? { ...item, content: String(e instanceof Error ? e.message : e) } : item
        )
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="border-b border-line bg-panel px-3 py-2">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-brand" />
          <div className="text-sm font-semibold text-ink">对话 Agent</div>
          {modelAvailable === false && <Badge tone="neutral" className="ml-auto">规则兜底</Badge>}
          {modelAvailable === true && <Badge tone="brand" className="ml-auto">模型增强</Badge>}
        </div>
        {currentFinding && (
          <div className="mt-1 truncate text-xs text-muted">当前上下文：{currentFinding.title}</div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
        <div className="grid gap-2">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
            >
              {message.role === "assistant" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Sparkles size={14} />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[86%] rounded-control px-3 py-1.5 text-sm leading-6",
                  message.role === "user" ? "bg-brand text-white" : "border border-line bg-surface text-ink2"
                )}
              >
                {message.role === "assistant" ? (
                  message.content ? <MarkdownMessage content={message.content} /> : <span className="text-faint">正在输出...</span>
                ) : (
                  <span className="whitespace-pre-wrap">{message.content}</span>
                )}
              </div>
              {message.role === "user" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-line text-muted">
                  <User size={14} />
                </span>
              )}
            </div>
          ))}
          {sending && <div className="text-xs text-faint">Agent 正在流式输出...</div>}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-line bg-surface p-2">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => send(prompt)}
              disabled={sending}
              className="rounded-full border border-line bg-panel px-2.5 py-0.5 text-xs text-muted transition-colors hover:bg-line/60 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="继续追问、让它解释风险或生成修改建议"
            className="min-h-9 flex-1 resize-none rounded-control border border-line bg-panel px-3 py-2 text-sm leading-5 text-ink2 outline-none focus:border-brand/50"
          />
          <Button size="icon" onClick={() => send()} disabled={!input.trim() || sending} title="发送">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
        code: ({ children }) => <code className="rounded bg-line px-1 py-0.5 font-mono text-[12px] text-ink">{children}</code>,
        pre: ({ children }) => <pre className="mb-2 overflow-auto rounded-control bg-ink p-3 text-xs leading-5 text-white">{children}</pre>,
        table: ({ children }) => <table className="mb-2 w-full border-collapse text-xs">{children}</table>,
        th: ({ children }) => <th className="border border-line bg-panel px-2 py-1 text-left font-medium">{children}</th>,
        td: ({ children }) => <td className="border border-line px-2 py-1">{children}</td>,
        blockquote: ({ children }) => <blockquote className="mb-2 border-l-2 border-brand pl-3 text-muted">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
