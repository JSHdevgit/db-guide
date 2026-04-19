'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'

interface SearchEntry {
  slug: string
  href: string
  title: string
  description: string
  level: string
  category: string
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
}

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [index, setIndex] = useState<Fuse<SearchEntry> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    setMounted(true)
    fetch('/search-index.json')
      .then(r => r.json())
      .then((data: SearchEntry[]) => {
        setIndex(new Fuse(data, {
          keys: ['title', 'description', 'category'],
          threshold: 0.4,
        }))
      })
      .catch(() => {})
  }, [])

  const closeModal = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setActiveIdx(-1)
  }, [])

  // ⌘K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeModal])

  const handleSearch = (q: string) => {
    setQuery(q)
    setActiveIdx(-1)
    if (!index || !q.trim()) { setResults([]); return }
    setResults(index.search(q).slice(0, 8).map(r => r.item))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => {
        const next = Math.min(i + 1, results.length - 1)
        scrollItemIntoView(next)
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => {
        const next = Math.max(i - 1, 0)
        scrollItemIntoView(next)
        return next
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = activeIdx >= 0 ? results[activeIdx] : results[0]
      if (target) {
        router.push(target.href)
        closeModal()
      }
    }
  }

  const scrollItemIntoView = (idx: number) => {
    const list = listRef.current
    if (!list) return
    const item = list.children[idx] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 flex items-start justify-center pt-24 px-4"
      onClick={closeModal}
    >
      <div
        className="w-full max-w-xl bg-[#1e1e35] border border-[#3d3d5c] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2d2d4d]">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="챕터 검색..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
            autoFocus
            autoComplete="off"
          />
          <kbd className="text-gray-600 text-xs font-mono">Esc</kbd>
        </div>

        {results.length > 0 && (
          <ul ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={r.slug}>
                <Link
                  href={r.href}
                  onClick={closeModal}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`flex items-start gap-3 px-4 py-2.5 transition-colors ${
                    i === activeIdx ? 'bg-[#2a2a40]' : 'hover:bg-[#2a2a40]'
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    r.level === 'beginner' ? 'bg-green-900/50 text-green-400' :
                    r.level === 'intermediate' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-pink-900/50 text-pink-400'
                  }`}>
                    {LEVEL_LABELS[r.level] || r.level}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white leading-tight">{r.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{r.category}</p>
                  </div>
                  {i === activeIdx && (
                    <kbd className="mt-0.5 shrink-0 text-[10px] text-gray-600 font-mono border border-gray-700 rounded px-1">↵</kbd>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query && results.length === 0 && (
          <p className="text-center text-gray-500 text-sm py-8">결과 없음</p>
        )}

        {!query && (
          <p className="text-center text-gray-600 text-xs py-5">
            챕터 제목이나 키워드를 입력하세요 &nbsp;·&nbsp;
            <span className="font-mono">↑↓</span> 이동 &nbsp;·&nbsp;
            <span className="font-mono">↵</span> 선택
          </p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#1a1a2e] border-b border-[#2d2d4d] h-13 flex items-center px-4 gap-4">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="md:hidden text-gray-400 hover:text-white p-1"
            aria-label="메뉴 열기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <Link href="/" className="flex items-center gap-1.5 text-violet-400 font-bold text-base tracking-tight shrink-0">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
          DBGuide
        </Link>

        <nav className="hidden md:flex gap-5 text-sm text-gray-400">
          <Link href="/beginner" className="hover:text-white transition-colors">입문</Link>
          <Link href="/intermediate" className="hover:text-white transition-colors">중급</Link>
          <Link href="/advanced" className="hover:text-white transition-colors">고급</Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 bg-[#2a2a40] border border-[#3d3d5c] text-gray-400 text-xs px-3 py-1.5 rounded-md hover:border-violet-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">검색...</span>
          <span className="hidden sm:inline text-gray-600 font-mono">⌘K</span>
        </button>
      </header>

      {mounted && open && createPortal(modal, document.body)}
    </>
  )
}
