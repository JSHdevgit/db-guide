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
      <div className="bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-white py-14 px-6 text-center">
        <h1 className="text-3xl font-bold mb-3 tracking-tight">데이터베이스 가이드</h1>
        <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
          PostgreSQL &amp; SQL — 입문부터 고급 튜닝까지.<br />
          실무에서 바로 쓰는 개념과 예제.
        </p>
      </div>

      {/* 레벨 카드 */}
      <div className="max-w-5xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-6">
        {levels.map(level => {
          const colors = COLOR_MAP[level.color]
          const previewChapters = level.chapters.slice(0, 5)

          return (
            <Link
              key={level.slug}
              href={`/${level.slug}`}
              className={`bg-white border-2 ${colors.border} rounded-2xl p-6 transition-all duration-200 hover:shadow-lg group`}
            >
              <span className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4 ${colors.badge}`}>
                {level.label}
              </span>

              <h2 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-violet-700 transition-colors">
                {level.categories.slice(0, 2).join(' & ')}
              </h2>

              <p className="text-sm text-gray-500 leading-relaxed mb-5">
                {level.description}
              </p>

              <ul className="space-y-1.5 mb-5">
                {previewChapters.map(ch => (
                  <li key={ch.slug} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
                    {ch.title}
                  </li>
                ))}
                {level.totalChapters > 5 && (
                  <li className="text-xs text-gray-400 pl-3.5">+{level.totalChapters - 5}개 더</li>
                )}
              </ul>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>{level.totalChapters}개 챕터</span>
                <span>약 {level.totalReadingTime}분</span>
              </div>
            </Link>
          )
        })}
      </div>

      <footer className="text-center text-xs text-gray-400 pb-10">
      </footer>
    </div>
  )
}
