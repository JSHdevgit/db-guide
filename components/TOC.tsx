'use client'

import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/content'

export default function TOC({ headings }: { headings: Heading[] }) {
  const [active, setActive] = useState('')

  useEffect(() => {
    const ids = headings.map(h => h.id)
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id)
            break
          }
        }
      },
      { rootMargin: '-20% 0% -70% 0%' }
    )

    ids.forEach(id => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav className="hidden lg:block w-48 shrink-0 py-6 px-3 sticky top-13 self-start max-h-[calc(100vh-52px)] overflow-y-auto">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">이 페이지</p>
      <ul className="space-y-0.5">
        {headings.filter(h => h.depth <= 3).map(h => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block text-xs py-1 transition-colors leading-snug ${
                h.depth === 3 ? 'pl-3' : ''
              } ${
                active === h.id
                  ? 'text-violet-400 font-semibold'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
