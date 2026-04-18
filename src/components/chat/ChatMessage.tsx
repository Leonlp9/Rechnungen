import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/store/chatStore';
import { Bot, User } from 'lucide-react';
import { useAppStore } from '@/store';

interface Props {
  message: ChatMessageType;
  onFollowUp?: (q: string) => void;
}

export function ChatMessage({ message, onFollowUp }: Props) {
  const navigate = useNavigate();
  const theme = useAppStore((s) => s.theme);
  const darkMode = useAppStore((s) => s.darkMode);
  const isUser = message.role === 'user';
  const isGlass = theme === 'liquid-glass';

  const glassFollowUpStyle = isGlass ? {
    backdropFilter: 'blur(10px) saturate(140%)',
    WebkitBackdropFilter: 'blur(10px) saturate(140%)',
    background: darkMode ? 'oklch(1 0 0 / 12%)' : 'oklch(1 0 0 / 55%)',
    border: darkMode ? '1px solid rgba(255,255,255,0.16)' : '1px solid rgba(255,255,255,0.60)',
    boxShadow: darkMode
      ? 'inset 1px 1px 0 rgba(255,255,255,0.12)'
      : 'inset 1px 1px 0 rgba(255,255,255,0.80)',
    color: darkMode ? 'rgba(255,255,255,0.88)' : 'rgba(30,30,80,0.85)',
  } : {};

  return (
    <div className={cn('flex gap-2 text-sm', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      {/* Content */}
      <div className={cn('flex flex-col gap-1.5 max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
        <div className={cn(
          'rounded-2xl px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown
                components={{
                  a({ href, children }) {
                    // nav: prefix OR any relative path → in-app navigation
                    const route = href?.startsWith('nav:')
                      ? href.slice(4)
                      : href?.startsWith('/')
                        ? href
                        : null;
                    if (route) {
                      return (
                        <button
                          onClick={() => navigate(route)}
                          className="text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer font-medium inline"
                        >
                          {children}
                        </button>
                      );
                    }
                    // External links: open in default browser via Tauri opener, NOT window.open
                    return (
                      <button
                        onClick={() => {
                          if (href) {
                            import('@tauri-apps/plugin-opener')
                              .then(({ openUrl }) => openUrl(href))
                              .catch(() => {});
                          }
                        }}
                        className="text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer inline"
                      >
                        {children}
                      </button>
                    );
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>;
                  },
                  ul({ children }) {
                    return <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>;
                  },
                  code({ children }) {
                    return <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
                  },
                  strong({ children }) {
                    return <strong className="font-semibold">{children}</strong>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Follow-up suggestions */}
        {!isUser && message.followUps && message.followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.followUps.map((q, i) => (
              <button
                key={i}
                onClick={() => onFollowUp?.(q)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors text-left',
                  isGlass
                    ? 'border-transparent hover:brightness-110'
                    : 'border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground'
                )}
                style={glassFollowUpStyle}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}






