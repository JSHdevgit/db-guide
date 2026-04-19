'use client'

import { useState } from 'react'
import type { Heading } from '@/lib/content'

export default function MobileTOC({ headings }: { headings: Heading[] }) {
  const [open, setOpen] = useState(false)
  if (headings.length === 0) return null

  return (
    <div className="mb-6 overflow-hidden rounded-lg bg-gray-100 lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold tracking-widest text-gray-600 uppercase"
      >
        이 페이지
        <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <ul className="space-y-1 px-4 pb-3">
          {headings.filter(h => h.depth <= 3).map(h => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={() => setOpen(false)}
                className={`block py-0.5 text-xs text-gray-600 hover:text-violet-700 ${h.depth === 3 ? 'pl-3' : ''}`}
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
