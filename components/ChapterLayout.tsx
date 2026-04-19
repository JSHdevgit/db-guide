'use client'

import { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import TOC from './TOC'
import type { Heading, ChapterMeta } from '@/lib/content'

interface Props {
  siblings: ChapterMeta[]
  headings: Heading[]
  children: React.ReactNode
}

export default function ChapterLayout({ siblings, headings, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          chapters={siblings}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex min-w-0 flex-1">
          {/* 메인 콘텐츠 */}
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-4xl px-4 py-8">
              {children}
            </div>
          </main>

          {/* 우측 TOC (데스크톱) */}
          <div className="hidden lg:block">
            <TOC headings={headings} />
          </div>
        </div>
      </div>
    </div>
  )
}
