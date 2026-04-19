'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { ChapterMeta } from '@/lib/content'

interface SidebarProps {
  chapters: ChapterMeta[]
  isOpen: boolean
  onClose: () => void
}

const LEVEL_LABELS: Record<string, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
}

export default function Sidebar({ chapters, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname()

  // 챕터 링크 클릭 시 모바일에서 자동 닫힘
  useEffect(() => {
    onClose()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // 카테고리별 그룹핑
  const groups = chapters.reduce<Record<string, ChapterMeta[]>>((acc, ch) => {
    if (!acc[ch.categoryName]) acc[ch.categoryName] = []
    acc[ch.categoryName].push(ch)
    return acc
  }, {})

  const sidebar = (
    <aside className="w-56 bg-[#1a1a2e] border-r border-[#2d2d4d] flex flex-col overflow-y-auto shrink-0">
      <div className="px-4 py-3 border-b border-[#2d2d4d]">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          {LEVEL_LABELS[chapters[0]?.level] || '가이드'}
        </span>
      </div>

      <nav className="flex-1 py-2">
        {Object.entries(groups).map(([category, items]) => (
          <div key={category} className="mb-4">
            <p className="px-4 text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-1">
              {category}
            </p>
            {items.map(ch => {
              const isActive = pathname === ch.href
              return (
                <Link
                  key={ch.slug}
                  href={ch.href}
                  className={`flex items-center gap-2 px-4 py-1.5 text-xs border-l-2 transition-colors ${
                    isActive
                      ? 'border-violet-500 bg-[#2a2a40] text-white'
                      : 'border-transparent text-gray-400 hover:bg-[#22223a] hover:text-gray-200'
                  }`}
                >
                  <ReadDot slug={ch.slug} />
                  <span className="leading-tight">{ch.title}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )

  return (
    <>
      {/* 데스크톱: 항상 보임 */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* 모바일: 오버레이 */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className="relative z-10 flex">{sidebar}</div>
        </div>
      )}
    </>
  )
}

function ReadDot({ slug }: { slug: string }) {
  const [read, setRead] = useState(false)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dbguide_progress') || '{}')
      setRead(!!stored[slug])
    } catch {}
  }, [slug])

  return (
    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-0.5 ${read ? 'bg-green-500' : 'bg-gray-700'}`} />
  )
}
