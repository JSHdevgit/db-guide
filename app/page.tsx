import Link from 'next/link'
import Header from '@/components/Header'
import { getLevelSummaries } from '@/lib/content'

const COLOR_MAP = {
  green: {
    badge: 'bg-green-100 text-green-800',
    border: 'border-green-200 hover:border-green-400',
    dot: 'bg-green-400',
  },
  yellow: {
    badge: 'bg-yellow-100 text-yellow-800',
    border: 'border-yellow-200 hover:border-yellow-400',
    dot: 'bg-yellow-400',
  },
  pink: {
    badge: 'bg-pink-100 text-pink-800',
    border: 'border-pink-200 hover:border-pink-400',
    dot: 'bg-pink-400',
  },
}

export default function HomePage() {
  const levels = getLevelSummaries()

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* 히어로 */}
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] px-6 py-14 text-center text-white">
        <h1 className="mb-3 text-3xl font-bold tracking-tight">데이터베이스 가이드</h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-400">
          PostgreSQL &amp; SQL — 입문부터 고급 튜닝까지.<br />
          실무에서 바로 쓰는 개념과 예제.
        </p>
      </div>

      {/* 레벨 카드 */}
      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-10 md:grid-cols-3">
        {levels.map(level => {
          const colors = COLOR_MAP[level.color]
          const previewChapters = level.chapters.slice(0, 5)

          return (
            <Link
              key={level.slug}
              href={`/${level.slug}`}
              className={`border-2 bg-white ${colors.border} group rounded-2xl p-6 transition-all duration-200 hover:shadow-lg`}
            >
              <span className={`mb-4 inline-block rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase ${colors.badge}`}>
                {level.label}
              </span>

              <h2 className="mb-2 text-lg font-bold text-gray-900 transition-colors group-hover:text-violet-700">
                {level.categories.slice(0, 2).join(' & ')}
              </h2>

              <p className="mb-5 text-sm leading-relaxed text-gray-500">
                {level.description}
              </p>

              <ul className="mb-5 space-y-1.5">
                {previewChapters.map(ch => (
                  <li key={ch.slug} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colors.dot}`} />
                    {ch.title}
                  </li>
                ))}
                {level.totalChapters > 5 && (
                  <li className="pl-3.5 text-xs text-gray-400">+{level.totalChapters - 5}개 더</li>
                )}
              </ul>

              <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-400">
                <span>{level.totalChapters}개 챕터</span>
                <span>약 {level.totalReadingTime}분</span>
              </div>
            </Link>
          )
        })}
      </div>

      <footer className="pb-10 text-center text-xs text-gray-400">
      </footer>
    </div>
  )
}
