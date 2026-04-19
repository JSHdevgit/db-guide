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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          chapters={siblings}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex flex-1 min-w-0">
          {/* 메인 콘텐츠 */}
          <main className="flex-1 min-w-0 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-6 py-8">
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
