'use client'

import { useEffect } from 'react'

export default function ProgressTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement
      const scrolled = el.scrollTop / (el.scrollHeight - el.clientHeight)
      if (scrolled >= 0.8) {
        try {
          const stored = JSON.parse(localStorage.getItem('dbguide_progress') || '{}')
          if (!stored[slug]) {
            stored[slug] = true
            localStorage.setItem('dbguide_progress', JSON.stringify(stored))
          }
        } catch {}
        window.removeEventListener('scroll', onScroll)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [slug])

  return null
}
