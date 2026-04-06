import { useState, useRef, useEffect } from 'react'
import type { Role, ROLE_META } from '../../App'
import type { Project } from '../../types'
import * as api from '../../api'

type RoleMeta = typeof ROLE_META[Role]

interface Props {
  roleMeta:        RoleMeta
  selectedProject: Project | null
}

interface Message {
  id: number
  sender: 'bot' | 'user'
  text: string
  time: string
  loading?: boolean
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function Chat({ roleMeta, selectedProject }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      sender: 'bot',
      text: selectedProject
        ? `Hi! I have context from completed meetings in "${selectedProject.name}". Ask me anything about this project — action items, decisions, summaries, or who said what.`
        : 'Hi! I have context from your completed meetings. Ask me anything — action items, decisions, summaries, or who said what.',
      time: nowTime(),
    },
  ])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMsg: Message = { id: Date.now(), sender: 'user', text, time: nowTime() }
    const loadingMsg: Message = {
      id: Date.now() + 1,
      sender: 'bot',
      text: '',
      time: nowTime(),
      loading: true,
    }

    setMessages(prev => [...prev, userMsg, loadingMsg])
    setInput('')
    setSending(true)

    try {
      const response = await api.askChat(text, selectedProject?.id)
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, text: response.answer, loading: false }
            : m
        )
      )
    } catch (err: unknown) {
      const errText =
        err instanceof Error ? err.message : 'Failed to get a response. Please try again.'
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, text: errText, loading: false }
            : m
        )
      )
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

  return (
    <div className="chat-wrap">
      {/* Context bar */}
      <div className="chat-ctx-bar">
        <span className="ctx-lbl">Context:</span>
        <span className="ctx-tag">Last 5 completed meetings</span>
        {selectedProject
          ? <span className="ctx-tag" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>{selectedProject.name}</span>
          : <span className="ctx-tag">All projects</span>
        }
      </div>

      {/* Messages */}
      <div className="chat-msgs">
        {messages.map(msg => (
          <div key={msg.id} className={`cmsg${msg.sender === 'user' ? ' user' : ''}`}>
            <div className={`cav${msg.sender === 'bot' ? ' bot' : ''}`}>
              {msg.sender === 'bot' ? 'RL' : roleMeta.initials}
            </div>
            <div>
              <div className="cbubble" style={{ whiteSpace: 'pre-line' }}>
                {msg.loading ? (
                  <span style={{ opacity: 0.5, fontStyle: 'italic' }}>Thinking…</span>
                ) : (
                  msg.text
                )}
              </div>
              <div className="ctime">{msg.time}</div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <div className="chat-input-box">
          <textarea
            className="chat-inp"
            rows={1}
            placeholder="Ask anything across your meetings…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
          />
          <button className="send-btn" onClick={handleSend} disabled={sending}>
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M2 8L14 2.5 10.5 8 14 13.5z" fill="var(--accent-fg)"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
