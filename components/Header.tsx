'use client'

import Link from 'next/link'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Fuse from 'fuse.js'
import { useVirtualizer } from '@tanstack/react-virtual'

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

const ITEM_HEIGHT = 56

export default function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [allEntries, setAllEntries] = useState<SearchEntry[]>([])
  const [results, setResults] = useState<SearchEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const [index, setIndex] = useState<Fuse<SearchEntry> | null>(null)
  const [isMac] = useState(() => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform))
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/search-index.json')
      .then(r => r.json())
      .then((data: SearchEntry[]) => {
        setAllEntries(data)
        setIndex(new Fuse(data, {
          keys: ['title', 'description', 'category'],
          threshold: 0.4,
        }))
      })
      .catch(() => {})
  }, [])

  const displayedItems = query.trim() ? results : allEntries

  const virtualizer = useVirtualizer({
    count: displayedItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  })

  const closeModal = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setActiveIdx(-1)
  }, [])

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
    setResults(index.search(q).map(r => r.item))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const items = displayedItems
    if (items.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => {
        const next = Math.min(i + 1, items.length - 1)
        virtualizer.scrollToIndex(next, { align: 'auto' })
        return next
      })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => {
        const next = Math.max(i - 1, 0)
        virtualizer.scrollToIndex(next, { align: 'auto' })
        return next
      })
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = activeIdx >= 0 ? items[activeIdx] : items[0]
      if (target) {
        router.push(target.href)
        closeModal()
      }
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/60 px-4 pt-4 sm:pt-16"
      onClick={closeModal}
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#3d3d5c] bg-[#1e1e35] shadow-2xl max-h-[calc(100dvh-2rem)] sm:max-h-[540px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-[#2d2d4d] px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="챕터 검색..."
            className="flex-1 bg-transparent text-base text-white placeholder-gray-500 outline-none sm:text-sm"
            autoFocus
            autoComplete="off"
          />
          <kbd className="font-mono text-xs text-gray-600">Esc</kbd>
        </div>

        {!query.trim() && (
          <p className="shrink-0 border-b border-[#2d2d4d] px-4 py-2 text-[11px] text-gray-600">
            전체 {allEntries.length}개 챕터 &nbsp;·&nbsp;
            <span className="font-mono">↑↓</span> 이동 &nbsp;·&nbsp;
            <span className="font-mono">↵</span> 선택
          </p>
        )}

        {displayedItems.length > 0 && (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-1">
            <div
              style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
            >
              {virtualizer.getVirtualItems().map(virtualItem => {
                const r = displayedItems[virtualItem.index]
                const i = virtualItem.index
                return (
                  <div
                    key={r.slug}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <Link
                      href={r.href}
                      onClick={closeModal}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`flex h-full items-start gap-3 px-4 py-2.5 transition-colors ${
                        i === activeIdx ? 'bg-[#2a2a40]' : 'hover:bg-[#2a2a40]'
                      }`}
                    >
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        r.level === 'beginner' ? 'bg-green-900/50 text-green-400' :
                        r.level === 'intermediate' ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-pink-900/50 text-pink-400'
                      }`}>
                        {LEVEL_LABELS[r.level] || r.level}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-tight text-white">{r.title}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{r.category}</p>
                      </div>
                      {i === activeIdx && (
                        <kbd className="mt-0.5 shrink-0 rounded border border-gray-700 px-1 font-mono text-[10px] text-gray-600">↵</kbd>
                      )}
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">결과 없음</p>
        )}
      </div>
    </div>
  )

  return (
    <>
      <header className="sticky top-0 z-40 flex h-13 items-center gap-4 border-b border-[#2d2d4d] bg-[#1a1a2e] px-4">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            className="p-1 text-gray-400 hover:text-white md:hidden"
            aria-label="메뉴 열기"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}

        <Link href="/" className="flex shrink-0 items-center gap-1.5 text-base font-bold tracking-tight text-violet-400">
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
          </svg>
          DBGuide
        </Link>

        <nav className="hidden gap-5 text-sm text-gray-400 md:flex">
          <Link href="/beginner" className="transition-colors hover:text-white">입문</Link>
          <Link href="/intermediate" className="transition-colors hover:text-white">중급</Link>
          <Link href="/advanced" className="transition-colors hover:text-white">고급</Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-md border border-[#3d3d5c] bg-[#2a2a40] px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-violet-500"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="hidden sm:inline">검색 </span>
          <span suppressHydrationWarning className="hidden font-mono text-gray-600 sm:inline">{isMac ? '⌘K' : 'Ctrl+K'}</span>
        </button>
      </header>

      {typeof window !== 'undefined' && open && createPortal(modal, document.body)}
    </>
  )
}
