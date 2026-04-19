'use client'

import { useState, useEffect, useCallback } from 'react'
import { useNickname } from '@/lib/nicknames'
import { formatRelativeTime } from '@/lib/relativeTime'

type CommentData = {
  id: string
  chapter_slug: string
  parent_id: string | null
  nickname: string
  body: string
  created_at: string
  updated_at: string
  edited: boolean
}

type CommentNode = CommentData & { children: CommentNode[] }

const COMMENT_PWD_KEY = 'comment_password'

function getSessionPassword(): string {
  if (typeof window === 'undefined') return ''
  return sessionStorage.getItem(COMMENT_PWD_KEY) ?? ''
}

function saveSessionPassword(pwd: string): void {
  sessionStorage.setItem(COMMENT_PWD_KEY, pwd)
}

function buildTree(flat: CommentData[]): CommentNode[] {
  const map = new Map<string, CommentNode>()
  for (const c of flat) map.set(c.id, { ...c, children: [] })

  const roots: CommentNode[] = []
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sort = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    for (const n of nodes) sort(n.children)
  }
  sort(roots)
  return roots
}

function NicknameEditor({
  nickname,
  setNickname,
}: {
  nickname: string | null
  setNickname: (n: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')

  if (!nickname) return null

  function startEdit() {
    setValue(nickname!)
    setEditing(true)
  }

  function save() {
    const trimmed = value.trim()
    if (trimmed.length < 1 || trimmed.length > 40) return
    setNickname(trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">닉네임:</span>
        <input
          className="w-40 rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-violet-400 focus:outline-none"
          value={value}
          onChange={e => setValue(e.target.value)}
          maxLength={40}
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditing(false)
          }}
        />
        <button onClick={save} className="text-xs font-medium text-violet-700 hover:text-violet-900">
          저장
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600">
          취소
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">닉네임:</span>
      <span className="font-medium text-gray-800">{nickname}</span>
      <button onClick={startEdit} className="text-xs text-violet-600 underline underline-offset-2 hover:text-violet-800">
        변경
      </button>
    </div>
  )
}

function CommentForm({
  nickname,
  onSubmit,
}: {
  nickname: string | null
  onSubmit: (body: string, password: string) => Promise<void>
}) {
  const [body, setBody] = useState('')
  const [password, setPassword] = useState(getSessionPassword)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(body.trim(), password)
      saveSessionPassword(password)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-xs text-gray-400">
        <span className="font-medium text-gray-600">{nickname ?? '...'}</span> 으로 작성됩니다
      </p>
      <textarea
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-1 focus:ring-violet-100 focus:outline-none"
        rows={3}
        placeholder="댓글을 입력하세요..."
        value={body}
        onChange={e => setBody(e.target.value)}
        maxLength={2000}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          className="w-36 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
          placeholder="비밀번호 (수정/삭제용)"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim() || !password}
          className="rounded-lg bg-violet-700 px-4 py-1.5 text-sm text-white transition-colors hover:bg-violet-800 disabled:bg-gray-300"
        >
          {submitting ? '등록 중...' : '댓글 등록'}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}

function ReplyForm({
  nickname,
  onSubmit,
  onCancel,
}: {
  nickname: string | null
  onSubmit: (body: string, password: string) => Promise<void>
  onCancel: () => void
}) {
  const [body, setBody] = useState('')
  const [password, setPassword] = useState(getSessionPassword)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || !password) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(body.trim(), password)
      saveSessionPassword(password)
      setBody('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3"
    >
      <p className="text-xs text-gray-400">
        <span className="font-medium text-gray-600">{nickname ?? '...'}</span> 으로 답글 작성
      </p>
      <textarea
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
        rows={2}
        placeholder="답글을 입력하세요..."
        value={body}
        onChange={e => setBody(e.target.value)}
        maxLength={2000}
        autoFocus
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          className="w-32 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
          placeholder="비밀번호"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <button
          type="submit"
          disabled={submitting || !body.trim() || !password}
          className="rounded-lg bg-violet-700 px-3 py-1.5 text-sm text-white transition-colors hover:bg-violet-800 disabled:bg-gray-300"
        >
          {submitting ? '등록 중...' : '답글 등록'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          취소
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  )
}

function CommentItem({
  node,
  depth,
  nickname,
  onReply,
  onRefresh,
}: {
  node: CommentNode
  depth: number
  nickname: string | null
  onReply: (parentId: string, body: string, password: string) => Promise<void>
  onRefresh: () => void
}) {
  const [showReply, setShowReply] = useState(false)
  const [editStep, setEditStep] = useState<'idle' | 'password' | 'edit'>('idle')
  const [deleting, setDeleting] = useState(false)
  const [editBody, setEditBody] = useState(node.body)
  const [editNickname, setEditNickname] = useState(node.nickname)
  const [editPassword, setEditPassword] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const indentStyle =
    depth > 0 ? { marginLeft: `${Math.min(depth, 6) * 1.5}rem` } : undefined

  function startEditing() {
    setEditPassword(getSessionPassword())
    setActionError(null)
    setEditStep('password')
    setDeleting(false)
    setShowReply(false)
  }

  function cancelEditing() {
    setEditStep('idle')
    setActionError(null)
  }

  function startDeleting() {
    setDeletePassword(getSessionPassword())
    setActionError(null)
    setDeleting(true)
    setEditStep('idle')
    setShowReply(false)
  }

  async function handlePasswordCheck(e: React.FormEvent) {
    e.preventDefault()
    if (!editPassword) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/comments/${node.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: editPassword }),
      })
      if (!res.ok) {
        throw new Error('비밀번호가 틀렸습니다')
      }
      setEditBody(node.body)
      setEditNickname(node.nickname)
      setEditStep('edit')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/comments/${node.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: editBody.trim() || undefined,
          nickname: editNickname.trim() || undefined,
          password: editPassword,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error === 'INVALID_PASSWORD' ? '비밀번호가 틀렸습니다' : '수정에 실패했습니다')
      }
      setEditStep('idle')
      onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault()
    if (!deletePassword) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/comments/${node.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error === 'INVALID_PASSWORD' ? '비밀번호가 틀렸습니다' : '삭제에 실패했습니다')
      }
      onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '오류가 발생했습니다')
      setActionLoading(false)
    }
  }

  return (
    <div style={indentStyle}>
      <div className="rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{node.nickname}</span>
            {node.edited && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-400">
                수정됨
              </span>
            )}
          </div>
          <span className="ml-2 shrink-0 text-xs text-gray-400">
            {formatRelativeTime(node.created_at)}
          </span>
        </div>

        {/* Body or edit forms */}
        {editStep === 'idle' && (
          <p className="text-sm break-words whitespace-pre-wrap text-gray-700">{node.body}</p>
        )}

        {editStep === 'password' && (
          <form onSubmit={handlePasswordCheck} className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="password"
              className="w-36 rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
              placeholder="비밀번호 입력"
              value={editPassword}
              onChange={e => setEditPassword(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={actionLoading || !editPassword}
              className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs text-white transition-colors hover:bg-violet-800 disabled:bg-gray-300"
            >
              {actionLoading ? '확인 중...' : '확인'}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              취소
            </button>
            {actionError && <p className="w-full text-xs text-red-500">{actionError}</p>}
          </form>
        )}

        {editStep === 'edit' && (
          <form onSubmit={handleEdit} className="mt-1 space-y-2">
            <input
              className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-violet-400 focus:outline-none"
              value={editNickname}
              onChange={e => setEditNickname(e.target.value)}
              maxLength={40}
              placeholder="닉네임"
            />
            <textarea
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none"
              rows={3}
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
              maxLength={2000}
              autoFocus
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs text-white transition-colors hover:bg-violet-800 disabled:bg-gray-300"
              >
                {actionLoading ? '저장 중...' : '저장'}
              </button>
              <button
                type="button"
                onClick={cancelEditing}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                취소
              </button>
            </div>
            {actionError && <p className="text-xs text-red-500">{actionError}</p>}
          </form>
        )}

        {/* Delete form */}
        {deleting && editStep === 'idle' && (
          <form onSubmit={handleDelete} className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="password"
              className="w-32 rounded border border-red-200 px-2 py-1 text-sm focus:border-red-400 focus:outline-none"
              placeholder="비밀번호 입력"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={actionLoading || !deletePassword}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-600 disabled:bg-gray-300"
            >
              삭제 확인
            </button>
            <button
              type="button"
              onClick={() => { setDeleting(false); setActionError(null) }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              취소
            </button>
            {actionError && <p className="text-xs text-red-500">{actionError}</p>}
          </form>
        )}

        {/* Actions */}
        {editStep === 'idle' && !deleting && (
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setShowReply(v => !v)}
              className="text-xs text-violet-700 hover:text-violet-900"
            >
              답글
            </button>
            <button onClick={startEditing} className="text-xs text-gray-400 hover:text-gray-600">
              수정
            </button>
            <button onClick={startDeleting} className="text-xs text-gray-400 hover:text-red-500">
              삭제
            </button>
          </div>
        )}
      </div>

      {/* Reply form */}
      {showReply && (
        <ReplyForm
          nickname={nickname}
          onSubmit={async (body, password) => {
            await onReply(node.id, body, password)
            setShowReply(false)
          }}
          onCancel={() => setShowReply(false)}
        />
      )}

      {/* Children */}
      {node.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {node.children.map(child => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              nickname={nickname}
              onReply={onReply}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Comments({ chapterSlug }: { chapterSlug: string }) {
  const [flat, setFlat] = useState<CommentData[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const { nickname, setNickname } = useNickname()

  const tree = buildTree(flat)

  const loadComments = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/comments?chapterSlug=${encodeURIComponent(chapterSlug)}`)
      if (!res.ok) throw new Error('댓글을 불러오지 못했습니다')
      const data = await res.json()
      setFlat(data.comments)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '오류가 발생했습니다')
    } finally {
      setLoading(false)
    }
  }, [chapterSlug])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  async function submitComment(body: string, password: string, parentId?: string) {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chapterSlug,
        nickname: nickname ?? '익명',
        body,
        password,
        parentId,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      throw new Error(data.error === 'VALIDATION' ? '입력 값을 확인해주세요' : '댓글 등록에 실패했습니다')
    }
    await loadComments()
  }

  async function handleReply(parentId: string, body: string, password: string) {
    await submitComment(body, password, parentId)
  }

  return (
    <section className="mt-12 border-t border-gray-200 pt-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        댓글{flat.length > 0 ? ` (${flat.length})` : ''}
      </h2>

      <div className="mb-4">
        <NicknameEditor nickname={nickname} setNickname={setNickname} />
      </div>

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <CommentForm nickname={nickname} onSubmit={submitComment} />
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-gray-400">댓글을 불러오는 중...</div>
      ) : fetchError ? (
        <div className="py-4 text-center text-sm text-red-400">{fetchError}</div>
      ) : tree.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">첫 번째 댓글을 남겨보세요!</div>
      ) : (
        <div className="space-y-3">
          {tree.map(node => (
            <CommentItem
              key={node.id}
              node={node}
              depth={0}
              nickname={nickname}
              onReply={handleReply}
              onRefresh={loadComments}
            />
          ))}
        </div>
      )}
    </section>
  )
}
