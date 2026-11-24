import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  FileText,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { streamConciergeChat, type StreamCitation } from '../../lib/api.ts';
import type { SharingType } from '../../types/pg.ts';
import { Button, Input } from '../ui/primitives.tsx';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  citations?: StreamCitation[];
  toolCalls?: string[];
  tourAction?: {
    suggestedSharingType?: SharingType;
    suggestedTourMode?: 'physical' | 'virtual';
    preferredRoomNumber?: string;
    reason?: string;
  };
  error?: string;
}

const STARTER_PROMPTS = [
  'Which AC rooms have vacant beds right now?',
  'Explain the security deposit & 30-day notice refund policy.',
  'What is served for Wednesday dinner?',
  'Schedule a virtual video tour for a double room.',
];

const SOURCE_FILTERS = [
  { label: 'All Sources', value: '' },
  { label: 'Rooms', value: 'room_inventory' },
  { label: 'Menu', value: 'weekly_menu' },
  { label: 'Policies', value: 'policy' },
  { label: 'Rules', value: 'house_rules' },
];

export function ConciergeDrawer() {
  const { openTourModal } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Hello! I am the HavenStay PG Concierge. Ask me about live room availability, deposit terms, weekly food menus, curfew policies, or say "schedule a tour" to book a visit.',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const assistantId = `m_${Date.now() + 1}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'model',
      text: '',
      citations: [],
      toolCalls: [],
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome' && !m.error && m.text.trim().length > 0)
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamConciergeChat(
        {
          message: trimmed,
          history: historyForApi,
          filter: sourceFilter ? { sourceType: sourceFilter } : undefined,
        },
        {
          onSources: ({ citations }) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, citations } : m))
            );
          },
          onToolCall: ({ name }) => {
            const label =
              name === 'checkLiveBedAvailability'
                ? 'Checked live room & bed inventory'
                : name === 'openTourBookingModal'
                ? 'Prepared 1-click tour booking'
                : `Ran ${name}`;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, toolCalls: Array.from(new Set([...(m.toolCalls ?? []), label])) }
                  : m
              )
            );
          },
          onUiAction: ({ type, payload }) => {
            if (type === 'OPEN_TOUR_MODAL') {
              const sharing: SharingType | undefined =
                payload.suggestedSharingType === 'single' ||
                payload.suggestedSharingType === 'double' ||
                payload.suggestedSharingType === 'triple'
                  ? payload.suggestedSharingType
                  : undefined;
              const mode: 'physical' | 'virtual' =
                payload.suggestedTourMode === 'virtual' ? 'virtual' : 'physical';
              const actionData: NonNullable<ChatMessage['tourAction']> = {
                suggestedSharingType: sharing,
                suggestedTourMode: mode,
                preferredRoomNumber:
                  typeof payload.preferredRoomNumber === 'string'
                    ? payload.preferredRoomNumber
                    : undefined,
                reason: typeof payload.reason === 'string' ? payload.reason : undefined,
              };
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, tourAction: actionData } : m
                )
              );
              openTourModal({
                sharingPreference: actionData.suggestedSharingType,
                tourMode: actionData.suggestedTourMode,
                roomNumber: actionData.preferredRoomNumber,
                notes: actionData.reason,
              });
            }
          },
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, text: m.text + chunk } : m
              )
            );
          },
          onError: (error) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, error } : m
              )
            );
          },
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  error:
                    err instanceof Error ? err.message : 'Connection interrupted.',
                }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const resetChat = () => {
    abortRef.current?.abort();
    setStreaming(false);
    setMessages([
      {
        id: 'welcome',
        role: 'model',
        text: 'Hello! I am the HavenStay PG Concierge. Ask me about live room availability, deposit terms, weekly food menus, curfew policies, or say "schedule a tour" to book a visit.',
      },
    ]);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform duration-150 hover:-translate-y-0.5 hover:bg-[#115e59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e] focus-visible:ring-offset-2 cursor-pointer"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">PG Concierge</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/35 backdrop-blur-[1px]">
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl"
            aria-label="PG Concierge AI Assistant"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  PG Concierge
                </h2>
                <p className="text-xs text-slate-500">
                  Grounded in live rooms, menus & house rules
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={resetChat}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  aria-label="Reset conversation"
                  title="Reset conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
                  aria-label="Close PG Concierge"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Metadata Retrieval Filter */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50 px-4 py-2">
              {SOURCE_FILTERS.map((f) => (
                <button
                  key={f.value || 'all'}
                  type="button"
                  onClick={() => setSourceFilter(f.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    sourceFilter === f.value
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#0f766e] text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mb-2 space-y-1 border-b border-slate-200 pb-2 text-xs text-slate-600">
                        {msg.toolCalls.map((tool, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <Wrench className="h-3 w-3 text-[#0f766e]" />
                            <span>{tool}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {msg.error ? (
                      <p className="text-xs text-red-700">{msg.error}</p>
                    ) : msg.text ? (
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Retrieving verified PG records...</span>
                      </div>
                    )}

                    {msg.tourAction && (
                      <div className="mt-3 border-t border-slate-200 pt-2.5">
                        <Button
                          size="sm"
                          onClick={() =>
                            openTourModal({
                              sharingPreference: msg.tourAction?.suggestedSharingType,
                              tourMode: msg.tourAction?.suggestedTourMode,
                              roomNumber: msg.tourAction?.preferredRoomNumber,
                              notes: msg.tourAction?.reason,
                            })
                          }
                          className="w-full"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Open Tour Scheduler
                        </Button>
                      </div>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1 font-medium text-slate-600">
                          <FileText className="h-3 w-3" />
                          <span>Retrieved Sources</span>
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {msg.citations.slice(0, 3).map((cit, idx) => (
                            <li key={idx} className="truncate">
                              {cit.sourceSection}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {messages.length === 1 && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-slate-500">Suggested questions</p>
                  <div className="flex flex-col gap-1.5">
                    {STARTER_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendMessage(prompt)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs text-slate-700 transition-colors hover:border-[#0f766e] hover:text-[#0f766e] cursor-pointer"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
              className="flex items-center gap-2 border-t border-slate-200 bg-white p-4"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about rent, beds, menu, curfew..."
                disabled={streaming}
              />
              <Button type="submit" disabled={streaming || !input.trim()}>
                {streaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
