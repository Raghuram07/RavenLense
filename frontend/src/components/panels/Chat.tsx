import { useState, useRef, useEffect, useCallback } from 'react'
import type { Role, ROLE_META } from '../../App'
import type { Project, ChatSession, ChatMessage } from '../../types'
import * as api from '../../api'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  roleMeta:        RoleMeta
  selectedProject: Project | null
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtSessionDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Temporary message shape used only while waiting for API response
interface PendingMsg {
  tempId: string
  content: string
}

export default function Chat({ roleMeta, selectedProject }: Props) {
  const [sessions, setSessions]           = useState<ChatSession[]>([])
  const [currentId, setCurrentId]         = useState<string | null>(null)
  const [messages, setMessages]           = useState<ChatMessage[]>([])
  const [pendingMsg, setPendingMsg]       = useState<PendingMsg | null>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending]             = useState(false)
  const [sessionError, setSessionError]   = useState<string | null>(null)
  const [msgError, setMsgError]           = useState<string | null>(null)
  const [input, setInput]                 = useState('')
  const [deletingId, setDeletingId]       = useState<string | null>(null)
  const bottomRef                         = useRef<HTMLDivElement>(null)

  // ── load sessions ──────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    setSessionError(null)
    try {
      const data = await api.fetchChatSessions()
      setSessions(data)
      // auto-select the most-recent session if none selected yet
      if (!currentId && data.length > 0) {
        setCurrentId(data[0].id)
      }
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoadingSessions(false)
    }
  }, [currentId])

  useEffect(() => { loadSessions() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── load messages when session changes ────────────────
  useEffect(() => {
    if (!currentId) { setMessages([]); return }
    setLoadingMessages(true)
    setMsgError(null)
    api.fetchChatMessages(currentId)
      .then(setMessages)
      .catch(e => setMsgError(e instanceof Error ? e.message : 'Failed to load messages'))
      .finally(() => setLoadingMessages(false))
  }, [currentId])

  // ── scroll to bottom on new messages ──────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingMsg])

  // ── create new session ─────────────────────────────────
  const handleNewChat = async () => {
    try {
      const session = await api.createChatSession()
      setSessions(prev => [session, ...prev])
      setCurrentId(session.id)
      setMessages([])
    } catch (e) {
      setSessionError(e instanceof Error ? e.message : 'Failed to create session')
    }
  }

  // ── select session ─────────────────────────────────────
  const handleSelectSession = (id: string) => {
    if (id === currentId) return
    setCurrentId(id)
    setPendingMsg(null)
    setMsgError(null)
  }

  // ── delete session ─────────────────────────────────────
  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await api.deleteChatSession(id)
      setSessions(prev => prev.filter(s => s.id !== id))
      if (currentId === id) {
        const remaining = sessions.filter(s => s.id !== id)
        setCurrentId(remaining.length > 0 ? remaining[0].id : null)
        setMessages([])
      }
    } catch {
      // silently ignore delete errors
    } finally {
      setDeletingId(null)
    }
  }

  // ── send message ───────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    let sessionId = currentId

    // create a session on-the-fly if none exists
    if (!sessionId) {
      try {
        const session = await api.createChatSession()
        setSessions(prev => [session, ...prev])
        setCurrentId(session.id)
        sessionId = session.id
      } catch (e) {
        setMsgError(e instanceof Error ? e.message : 'Failed to create session')
        return
      }
    }

    const tempId = `pending-${Date.now()}`
    setPendingMsg({ tempId, content: text })
    setInput('')
    setSending(true)
    setMsgError(null)

    try {
      // optimistic user message (will be replaced by real messages from API)
      const userMsg: ChatMessage = {
        id:         `opt-user-${Date.now()}`,
        role:       'user',
        content:    text,
        citations:  null,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsg])
      setPendingMsg(null)

      const assistantMsg = await api.sendChatMessage(sessionId, text, selectedProject?.id)

      setMessages(prev => [...prev, assistantMsg])

      // bump the session's updated_at in the sidebar
      setSessions(prev =>
        prev.map(s =>
          s.id === sessionId
            ? { ...s, updated_at: assistantMsg.created_at, title: s.title === 'New Chat' && text ? text.slice(0, 40) : s.title }
            : s
        ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      )
    } catch (e) {
      setMsgError(e instanceof Error ? e.message : 'Failed to send message. Please retry.')
      setPendingMsg(null)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── render ─────────────────────────────────────────────
  return (
    <div className="chat-layout">

      {/* ── Sessions sidebar ── */}
      <div className="chat-sessions-pane">
        <div className="csp-head">
          <span className="csp-title">Conversations</span>
          <button className="csp-new-btn" onClick={handleNewChat} title="New chat">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="csp-list">
          {loadingSessions && (
            <div className="csp-empty">Loading…</div>
          )}
          {sessionError && !loadingSessions && (
            <div className="csp-error">
              {sessionError}
              <button className="csp-retry" onClick={loadSessions}>Retry</button>
            </div>
          )}
          {!loadingSessions && !sessionError && sessions.length === 0 && (
            <div className="csp-empty">No conversations yet.<br/>Click <strong>+</strong> to start one.</div>
          )}
          {sessions.map(s => (
            <div
              key={s.id}
              className={`csp-item${s.id === currentId ? ' active' : ''}`}
              onClick={() => handleSelectSession(s.id)}
            >
              <div className="csp-item-body">
                <div className="csp-item-title">{s.title || 'Untitled'}</div>
                <div className="csp-item-date">{fmtSessionDate(s.updated_at)}</div>
              </div>
              <button
                className="csp-del-btn"
                onClick={e => handleDeleteSession(e, s.id)}
                disabled={deletingId === s.id}
                title="Delete"
              >
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M3 4h10M6 4V2h4v2M5 4v8h6V4H5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Chat main area ── */}
      <div className="chat-wrap">

        {/* Context bar */}
        <div className="chat-ctx-bar">
          <span className="ctx-lbl">Context:</span>
          <span className="ctx-tag">Last 5 completed meetings</span>
          {selectedProject
            ? <span className="ctx-tag" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{selectedProject.name}</span>
            : <span className="ctx-tag">All projects</span>
          }
        </div>

        {/* Messages */}
        <div className="chat-msgs">
          {loadingMessages && (
            <div className="chat-state-msg">Loading messages…</div>
          )}

          {!loadingMessages && !currentId && (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="8" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="2.5"/>
                  <path d="M14 40l4-4h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p>Select a conversation or click <strong>+</strong> to start a new one.</p>
            </div>
          )}

          {!loadingMessages && currentId && messages.length === 0 && !pendingMsg && (
            <div className="chat-empty-state">
              <div className="chat-empty-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="8" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="2.5"/>
                  <path d="M14 40l4-4h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p>
                {selectedProject
                  ? `Ask anything about "${selectedProject.name}" — action items, decisions, who said what.`
                  : 'Ask anything across your completed meetings — action items, decisions, summaries.'}
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`cmsg${msg.role === 'user' ? ' user' : ''}`}>
              <div className={`cav${msg.role === 'assistant' ? ' bot' : ''}`}>
                {msg.role === 'assistant' ? 'RL' : roleMeta.initials}
              </div>
              <div>
                <div className="cbubble" style={{ whiteSpace: 'pre-line' }}>
                  {msg.content}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="ccitations">
                    {msg.citations.map((c, i) => (
                      <span key={i} className="ccite-tag" title={c.excerpt}>
                        📎 {c.meeting_title}
                      </span>
                    ))}
                  </div>
                )}
                <div className="ctime">{fmtTime(msg.created_at)}</div>
              </div>
            </div>
          ))}

          {/* Typing / loading indicator */}
          {sending && (
            <div className="cmsg">
              <div className="cav bot">RL</div>
              <div>
                <div className="cbubble chat-typing">
                  <span/><span/><span/>
                </div>
              </div>
            </div>
          )}

          {/* Inline error with retry */}
          {msgError && (
            <div className="chat-msg-error">
              <span>{msgError}</span>
              <button onClick={() => { setMsgError(null); handleSend() }}>Retry</button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-box">
            <textarea
              className="chat-inp"
              rows={1}
              placeholder={currentId ? 'Ask anything across your meetings…' : 'Start a new conversation…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || loadingMessages}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={sending || !input.trim() || loadingMessages}
            >
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M2 8L14 2.5 10.5 8 14 13.5z" fill="var(--accent-fg)"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
