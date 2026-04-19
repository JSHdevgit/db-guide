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
    <nav className="sticky top-13 hidden max-h-[calc(100vh-52px)] w-48 shrink-0 self-start overflow-y-auto px-3 py-6 lg:block">
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-gray-500 uppercase">이 페이지</p>
      <ul className="space-y-0.5">
        {headings.filter(h => h.depth <= 3).map(h => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`block py-1 text-xs leading-snug transition-colors ${
                h.depth === 3 ? 'pl-3' : ''
              } ${
                active === h.id
                  ? 'font-semibold text-violet-400'
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
