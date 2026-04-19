'use client'

import { useState } from 'react'
import type { Heading } from '@/lib/content'

export default function MobileTOC({ headings }: { headings: Heading[] }) {
  const [open, setOpen] = useState(false)
  if (headings.length === 0) return null

  return (
    <div className="lg:hidden mb-6 bg-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-widest"
      >
        이 페이지
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="px-4 pb-3 space-y-1">
          {headings.filter(h => h.depth <= 3).map(h => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={() => setOpen(false)}
                className={`block text-xs text-gray-600 hover:text-violet-700 py-0.5 ${h.depth === 3 ? 'pl-3' : ''}`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
