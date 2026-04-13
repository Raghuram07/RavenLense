import { useState, useEffect, useRef, useCallback } from 'react'
import type { Role } from '../../App'
import type { KnowledgeFolder, KnowledgeFile, Project } from '../../types'
import * as api from '../../api'

interface Props {
  role:            Role
  selectedProject: Project | null
}

// ── Badge helpers ─────────────────────────────────────────

function badgeClass(b: string) {
  if (b === 'approved') return 'fb-approved'
  if (b === 'rejected') return 'fb-rejected'
  return 'fb-pending'
}

function badgeLabel(b: string) {
  if (b === 'approved') return '✓'
  if (b === 'rejected') return '✗'
  return '⏳'
}

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Reject modal ─────────────────────────────────────────

interface RejectModalProps {
  file:     KnowledgeFile
  onReject: (reason: string) => void
  onClose:  () => void
}

function RejectModal({ file, onReject, onClose }: RejectModalProps) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onReject(reason.trim())
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">Reject document</div>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Rejecting <strong>{file.name}</strong>. The uploader will see your reason.
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Reason (optional)</label>
            <textarea
              className="form-input"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Incorrect format, duplicate content…"
              rows={3}
              style={{ resize: 'vertical' }}
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn sm" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn sm danger" disabled={loading}>
              {loading ? 'Rejecting…' : 'Reject document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New-folder modal ──────────────────────────────────────

interface NewFolderModalProps {
  projectId: string | null
  onCreated: (f: KnowledgeFolder) => void
  onClose:   () => void
}

function NewFolderModal({ projectId, onCreated, onClose }: NewFolderModalProps) {
  const [name, setName]   = useState('')
  const [emoji, setEmoji] = useState('📁')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Folder name is required.'); return }
    setSaving(true)
    try {
      const f = await api.createFolder({ name, emoji, project_id: projectId ?? undefined })
      onCreated(f)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create folder.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">New folder</div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Folder name *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Sprint 5" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Emoji</label>
            <input className="form-input" value={emoji} onChange={e => setEmoji(e.target.value)} style={{ width: 60 }} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn pri sm" disabled={saving}>{saving ? 'Creating…' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Admin view ────────────────────────────────────────────

interface AdminViewProps {
  folders: KnowledgeFolder[]
  selectedFolderId: string | null
  onFolderDeleted: (id: string) => void
}

function AdminView({ folders, selectedFolderId, onFolderDeleted }: AdminViewProps) {
  const [files, setFiles]               = useState<KnowledgeFile[]>([])
  const [loading, setLoading]           = useState(false)
  const [uploading, setUploading]       = useState(false)
  const [uploadError, setUploadError]   = useState('')
  const [rejectingFile, setRejectingFile] = useState<KnowledgeFile | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFiles = useCallback((folderId: string) => {
    setLoading(true)
    api.fetchFiles({ folder_id: folderId })
      .then(data => setFiles(data))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedFolderId) { setFiles([]); return }
    loadFiles(selectedFolderId)
  }, [selectedFolderId, loadFiles])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedFolderId) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('folder_id', selectedFolderId)
      const uploaded = await api.uploadKnowledgeFile(form)
      setFiles(prev => [uploaded, ...prev])
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleApprove = async (file: KnowledgeFile) => {
    setActionPending(file.id)
    try {
      const updated = await api.approveFile(file.id, 'Admin')
      setFiles(prev => prev.map(f => f.id === file.id ? updated : f))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Approval failed.')
    } finally {
      setActionPending(null)
    }
  }

  const handleReject = async (file: KnowledgeFile, reason: string) => {
    setActionPending(file.id)
    try {
      const updated = await api.rejectFile(file.id, reason || undefined)
      setFiles(prev => prev.map(f => f.id === file.id ? updated : f))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Rejection failed.')
    } finally {
      setActionPending(null)
      setRejectingFile(null)
    }
  }

  const handleDeleteFile = async (file: KnowledgeFile) => {
    if (!confirm(`Delete "${file.name}"?`)) return
    await api.deleteKnowledgeFile(file.id)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  const handleDeleteFolder = async () => {
    if (!selectedFolderId) return
    const folder = folders.find(f => f.id === selectedFolderId)
    if (!confirm(`Delete folder "${folder?.name}"? All files inside will be deleted.`)) return
    await api.deleteFolder(selectedFolderId)
    onFolderDeleted(selectedFolderId)
  }

  if (!selectedFolderId) {
    return (
      <div className="rag-main" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex', flex: 1 }}>
        <div style={{ fontSize: 13, color: 'var(--text3)' }}>Select a folder to view its files.</div>
      </div>
    )
  }

  const folder = folders.find(f => f.id === selectedFolderId)
  const pendingCount = files.filter(f => f.status === 'pending').length

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="rag-toolbar">
          <span className="rag-ftitle">{folder?.emoji} {folder?.name}</span>
          <span className="rag-fmeta">· {files.length} file{files.length !== 1 ? 's' : ''}</span>
          {pendingCount > 0 && (
            <span className="status st-pend" style={{ marginLeft: 4 }}>
              {pendingCount} pending review
            </span>
          )}
          <div className="rag-acts">
            <button
              className="btn sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? '⏳ Uploading…' : '⬆ Upload file'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.vtt,.txt,.docx,.md"
              style={{ display: 'none' }}
              onChange={handleUpload}
            />
            <button className="btn sm danger" onClick={handleDeleteFolder}>Delete folder</button>
          </div>
        </div>

        <div className="rag-content">
          {uploadError && (
            <div className="error-msg" style={{ marginBottom: 12 }}>{uploadError}</div>
          )}
          {loading && (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: '24px 0' }}>Loading…</div>
          )}
          {!loading && files.length === 0 && (
            <div className="drop-zone" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer' }}>
              <div className="dz-icon">⬆</div>
              <div className="dz-title">Upload the first file to this folder</div>
              <div className="dz-sub">Supports .pdf, .vtt, .txt, .docx, .md</div>
            </div>
          )}
          <div className="file-list">
            {files.map(f => (
              <div key={f.id} className={`file-item ${f.status}`}>
                <div className="fi-icon">📄</div>
                <div className="fi-info">
                  <div className="fi-name">{f.name}</div>
                  <div className="fi-meta">{fmtSize(f.size_bytes)} · Uploaded {fmtDate(f.created_at)}</div>
                  {f.uploaded_by_name && (
                    <div className="fi-uploaded-by">
                      <div className="fi-av">{f.uploaded_by_name.slice(0, 2).toUpperCase()}</div>
                      Uploaded by {f.uploaded_by_name}
                    </div>
                  )}
                  {f.rejection_reason && (
                    <div className="fi-meta" style={{ color: 'var(--red)', marginTop: 3 }}>
                      Rejected — {f.rejection_reason}
                    </div>
                  )}
                </div>
                <div className="fi-status">
                  <span
                    className={`status ${f.status === 'approved' ? 'st-done' : f.status === 'rejected' ? '' : 'st-pend'}`}
                    style={f.status === 'rejected' ? { background: 'var(--red-bg)', color: 'var(--red)' } : undefined}
                  >
                    {f.status === 'pending' ? 'Pending' : f.status === 'approved' ? 'Approved' : 'Rejected'}
                  </span>
                </div>
                <div className="fi-actions">
                  {f.status === 'pending' && (
                    <>
                      <button
                        className="btn sm success"
                        disabled={actionPending === f.id}
                        onClick={() => handleApprove(f)}
                      >
                        {actionPending === f.id ? '…' : 'Approve'}
                      </button>
                      <button
                        className="btn sm danger"
                        disabled={actionPending === f.id}
                        onClick={() => setRejectingFile(f)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {f.status === 'approved' && (
                    <button
                      className="btn sm danger"
                      disabled={actionPending === f.id}
                      onClick={() => setRejectingFile(f)}
                    >
                      Reject
                    </button>
                  )}
                  <button className="btn sm" onClick={() => handleDeleteFile(f)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {rejectingFile && (
        <RejectModal
          file={rejectingFile}
          onReject={reason => handleReject(rejectingFile, reason)}
          onClose={() => setRejectingFile(null)}
        />
      )}
    </>
  )
}

// ── Manager view ──────────────────────────────────────────

function ManagerView() {
  const [queue, setQueue]       = useState<KnowledgeFile[]>([])
  const [reviewed, setReviewed] = useState<KnowledgeFile[]>([])
  const [loading, setLoading]   = useState(true)
  const [rejectingFile, setRejectingFile] = useState<KnowledgeFile | null>(null)
  const [actionPending, setActionPending] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.fetchReviewQueue(),
      api.fetchFiles({ status: 'approved' }),
      api.fetchFiles({ status: 'rejected' }),
    ])
      .then(([pending, approved, rejected]) => {
        setQueue(pending)
        setReviewed([...approved, ...rejected].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 10))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (file: KnowledgeFile) => {
    setActionPending(file.id)
    try {
      await api.approveFile(file.id, 'Manager')
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Approval failed.')
    } finally {
      setActionPending(null)
    }
  }

  const handleReject = async (file: KnowledgeFile, reason: string) => {
    setActionPending(file.id)
    try {
      await api.rejectFile(file.id, reason || undefined)
      load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Rejection failed.')
    } finally {
      setActionPending(null)
      setRejectingFile(null)
    }
  }

  const handleDelete = async (file: KnowledgeFile) => {
    if (!confirm(`Delete "${file.name}"?`)) return
    await api.deleteKnowledgeFile(file.id)
    load()
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div className="rag-toolbar">
          <span className="rag-ftitle">Review queue</span>
          <span className="rag-fmeta">· {queue.length} pending</span>
          {queue.length > 0 && (
            <span className="status st-pend" style={{ marginLeft: 4 }}>
              {queue.length} awaiting review
            </span>
          )}
        </div>
        <div className="rag-content">
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>Loading…</div>
          ) : (
            <>
              <div className="sec-divider">Pending review</div>
              <div className="file-list">
                {queue.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>
                    All caught up — no files pending review.
                  </div>
                ) : queue.map(f => (
                  <div key={f.id} className="file-item pending">
                    <div className="fi-icon">📄</div>
                    <div className="fi-info">
                      <div className="fi-name">{f.name}</div>
                      <div className="fi-meta">{fmtSize(f.size_bytes)} · Uploaded {fmtDate(f.created_at)}</div>
                      {f.uploaded_by_name && (
                        <div className="fi-uploaded-by">
                          <div className="fi-av">{f.uploaded_by_name.slice(0, 2).toUpperCase()}</div>
                          Uploaded by {f.uploaded_by_name}
                        </div>
                      )}
                    </div>
                    <div className="fi-status"><span className="status st-pend">Pending</span></div>
                    <div className="fi-actions">
                      <button
                        className="btn sm success"
                        disabled={actionPending === f.id}
                        onClick={() => handleApprove(f)}
                      >
                        {actionPending === f.id ? '…' : 'Approve'}
                      </button>
                      <button
                        className="btn sm danger"
                        disabled={actionPending === f.id}
                        onClick={() => setRejectingFile(f)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="sec-divider">Recently reviewed</div>
              <div className="file-list">
                {reviewed.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>No reviewed files yet.</div>
                ) : reviewed.map(f => (
                  <div key={f.id} className={`file-item ${f.status}`}>
                    <div className="fi-icon">📄</div>
                    <div className="fi-info">
                      <div className="fi-name">{f.name}</div>
                      <div className="fi-meta">{fmtSize(f.size_bytes)} · {fmtDate(f.created_at)}</div>
                      {f.uploaded_by_name && (
                        <div className="fi-uploaded-by">
                          <div className="fi-av">{f.uploaded_by_name.slice(0, 2).toUpperCase()}</div>
                          {f.uploaded_by_name}
                        </div>
                      )}
                      {f.rejection_reason && (
                        <div className="fi-meta" style={{ color: 'var(--red)', marginTop: 3 }}>
                          Rejected — {f.rejection_reason}
                        </div>
                      )}
                    </div>
                    <div className="fi-status">
                      <span
                        className={`status ${f.status === 'approved' ? 'st-done' : ''}`}
                        style={f.status === 'rejected' ? { background: 'var(--red-bg)', color: 'var(--red)' } : undefined}
                      >
                        {f.status === 'approved' ? 'Approved' : 'Rejected'}
                      </span>
                    </div>
                    <div className="fi-actions">
                      {f.status === 'approved' && (
                        <button
                          className="btn sm danger"
                          disabled={actionPending === f.id}
                          onClick={() => setRejectingFile(f)}
                        >
                          Reject
                        </button>
                      )}
                      <button className="btn sm" onClick={() => handleDelete(f)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {rejectingFile && (
        <RejectModal
          file={rejectingFile}
          onReject={reason => handleReject(rejectingFile, reason)}
          onClose={() => setRejectingFile(null)}
        />
      )}
    </>
  )
}

// ── Employee view ─────────────────────────────────────────

interface EmployeeViewProps {
  folders:        KnowledgeFolder[]
  projectId:      string | null
  triggerUpload?: boolean
  onUploadTriggered?: () => void
}

function EmployeeView({ folders, projectId, triggerUpload, onUploadTriggered }: EmployeeViewProps) {
  const [myFiles, setMyFiles]       = useState<KnowledgeFile[]>([])
  const [loading, setLoading]       = useState(true)
  const [uploading, setUploading]   = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState('')
  const [uploaderName, setUploaderName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (triggerUpload) {
      fileRef.current?.click()
      onUploadTriggered?.()
    }
  }, [triggerUpload, onUploadTriggered])

  const loadMyFiles = () => {
    setLoading(true)
    api.fetchFiles()
      .then(setMyFiles)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadMyFiles() }, [])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      if (selectedFolderId) form.append('folder_id', selectedFolderId)
      if (projectId)        form.append('project_id', projectId)
      if (uploaderName)     form.append('uploaded_by_name', uploaderName)
      await api.uploadKnowledgeFile(form)
      loadMyFiles()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleDelete = async (file: KnowledgeFile) => {
    if (!confirm(`Remove "${file.name}"?`)) return
    await api.deleteKnowledgeFile(file.id)
    setMyFiles(prev => prev.filter(f => f.id !== file.id))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="rag-toolbar">
        <span className="rag-ftitle">My uploads</span>
      </div>
      <div className="rag-content">
        <div className="drop-zone" onClick={() => fileRef.current?.click()} style={{ cursor: 'pointer' }}>
          <div className="dz-icon">{uploading ? '⏳' : '⬆'}</div>
          <div className="dz-title">{uploading ? 'Uploading…' : 'Upload a file to the knowledge base'}</div>
          <div className="dz-sub">
            Supports .pdf, .vtt, .txt, .docx — max 50 MB<br />
            Files are sent to your project manager for review before going live
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.vtt,.txt,.docx,.md"
            style={{ display: 'none' }}
            onChange={handleUpload}
          />
        </div>

        {/* Optional metadata inputs */}
        <div style={{ display: 'flex', gap: 10, margin: '12px 0' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Your name (shown as uploader)</label>
            <input className="form-input" value={uploaderName} onChange={e => setUploaderName(e.target.value)} placeholder="Sneha K." />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label">Folder</label>
            <select
              className="form-input"
              value={selectedFolderId}
              onChange={e => setSelectedFolderId(e.target.value)}
            >
              <option value="">— No folder —</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="sec-divider">My uploaded files</div>
        <div className="file-list">
          {loading ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: 12 }}>Loading…</div>
          ) : myFiles.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', padding: 12 }}>No files uploaded yet.</div>
          ) : myFiles.map(f => (
            <div key={f.id} className={`file-item ${f.status}`}>
              <div className="fi-icon">📄</div>
              <div className="fi-info">
                <div className="fi-name">{f.name}</div>
                <div className="fi-meta">{fmtSize(f.size_bytes)} · Uploaded {fmtDate(f.created_at)}</div>
                {f.rejection_reason && (
                  <div className="fi-meta" style={{ color: 'var(--red)', marginTop: 3 }}>
                    Rejected — {f.rejection_reason}
                  </div>
                )}
              </div>
              <div className="fi-status">
                <span
                  className={`status ${f.status === 'approved' ? 'st-done' : f.status === 'pending' ? 'st-pend' : ''}`}
                  style={f.status === 'rejected' ? { background: 'var(--red-bg)', color: 'var(--red)' } : undefined}
                >
                  {f.status === 'pending' ? 'Awaiting review' : f.status === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              </div>
              <div className="fi-actions">
                <button className="btn sm danger" onClick={() => handleDelete(f)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────

export default function Knowledge({ role, selectedProject }: Props) {
  const projectId = selectedProject?.id ?? null

  const [folders, setFolders]           = useState<KnowledgeFolder[]>([])
  const [allFiles, setAllFiles]         = useState<KnowledgeFile[]>([])
  const [openFolders, setOpenFolders]   = useState<Set<string>>(new Set())
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [search, setSearch]             = useState('')
  const [loading, setLoading]           = useState(true)
  const [triggerEmpUpload, setTriggerEmpUpload] = useState(false)

  const loadData = () => {
    setLoading(true)
    setSelectedFolderId(null)
    Promise.all([
      api.fetchFolders(projectId ?? undefined),
      api.fetchFiles(projectId ? { project_id: projectId } : undefined),
    ])
      .then(([f, files]) => {
        setFolders(f)
        setAllFiles(files)
        if (f.length > 0) {
          setSelectedFolderId(f[0].id)
          setOpenFolders(new Set([f[0].id]))
        }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [projectId])

  const toggleFolder = (id: string) => {
    setOpenFolders(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const getFilesForFolder = (folderId: string) =>
    allFiles.filter(f => f.folder_id === folderId)

  const filteredFolders = folders.filter(f =>
    !search || f.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="rag-wrap">
      {/* Left tree */}
      <div className="rag-tree-pane">
        <div className="rtp-head">
          <div className="rtp-title">
            {selectedProject ? selectedProject.name : 'Knowledge base'}
          </div>
          {selectedProject && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Project documents</div>
          )}
          <div className="rsearch">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="6.5" cy="6.5" r="4"/>
              <path d="M10 10L13.5 13.5" strokeLinecap="round"/>
            </svg>
            <input
              placeholder="Search files…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="rtree">
          {loading ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 8px' }}>Loading…</div>
          ) : filteredFolders.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', padding: '12px 8px' }}>
              {folders.length === 0 ? 'No folders yet.' : 'No matches.'}
            </div>
          ) : (
            filteredFolders.map(folder => {
              const folderFiles = getFilesForFolder(folder.id)
              const isOpen = openFolders.has(folder.id)
              return (
                <div key={folder.id}>
                  <div
                    className={`tf-hdr${isOpen ? ' open' : ''}`}
                    onClick={() => { toggleFolder(folder.id); setSelectedFolderId(folder.id) }}
                  >
                    <span className="tf-chev">▶</span>
                    <span style={{ fontSize: 13 }}>{folder.emoji ?? '📁'}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{folder.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{folder.file_count}</span>
                  </div>
                  <div className={`tf-kids${isOpen ? ' open' : ''}`}>
                    {folderFiles.map(file => (
                      <div
                        key={file.id}
                        className="tf-file"
                        onClick={() => setSelectedFolderId(folder.id)}
                      >
                        <span style={{ fontSize: 11, opacity: .5 }}>📄</span>
                        <span className="tf-fname">{file.name}</span>
                        <span className={`fbadge ${badgeClass(file.status)}`}>{badgeLabel(file.status)}</span>
                      </div>
                    ))}
                    {folderFiles.length === 0 && isOpen && (
                      <div style={{ fontSize: 11.5, color: 'var(--text3)', padding: '4px 20px' }}>Empty folder</div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {role === 'admin' && (
            <button className="rag-upload-btn" onClick={() => setShowNewFolder(true)}>
              + New folder
            </button>
          )}
          {role !== 'admin' && (
            <button className="rag-upload-btn" onClick={() => setTriggerEmpUpload(true)}>
              ⬆ Upload file
            </button>
          )}
        </div>
      </div>

      {/* Right main */}
      <div className="rag-main">
        {role === 'admin' && (
          <AdminView
            folders={folders}
            selectedFolderId={selectedFolderId}
            onFolderDeleted={id => {
              setFolders(prev => prev.filter(f => f.id !== id))
              setAllFiles(prev => prev.filter(f => f.folder_id !== id))
              setSelectedFolderId(null)
            }}
          />
        )}
        {role === 'manager' && <ManagerView />}
        {role === 'employee' && (
          <EmployeeView
            folders={folders}
            projectId={projectId}
            triggerUpload={triggerEmpUpload}
            onUploadTriggered={() => setTriggerEmpUpload(false)}
          />
        )}
      </div>

      {showNewFolder && (
        <NewFolderModal
          projectId={projectId}
          onCreated={f => {
            setFolders(prev => [f, ...prev])
            setSelectedFolderId(f.id)
            setOpenFolders(prev => new Set([...prev, f.id]))
            setShowNewFolder(false)
          }}
          onClose={() => setShowNewFolder(false)}
        />
      )}
    </div>
  )
}
