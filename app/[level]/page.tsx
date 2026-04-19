import Link from 'next/link'
import { notFound } from 'next/navigation'
import Header from '@/components/Header'
import { getLevelSummaries } from '@/lib/content'

const LEVEL_LABELS: Record<string, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
}

const COLOR_MAP = {
  green: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-400' },
  yellow: { badge: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-400' },
  pink: { badge: 'bg-pink-100 text-pink-800', dot: 'bg-pink-400' },
}

export async function generateStaticParams() {
  const levels = getLevelSummaries()
  return levels.map(l => ({ level: l.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  const levels = getLevelSummaries()
  const levelData = levels.find(l => l.slug === level)
  if (!levelData) return {}
  const label = LEVEL_LABELS[level] ?? level
  return {
    title: `${label} 가이드 — PostgreSQL & SQL`,
    description: levelData.description,
    openGraph: {
      title: `${label} 가이드 — DBGuide`,
      description: levelData.description,
    },
  }
}

export default async function LevelPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  const levels = getLevelSummaries()
  const levelData = levels.find(l => l.slug === level)
  if (!levelData) notFound()

  const colors = COLOR_MAP[levelData.color]

  // 카테고리별 그룹핑
  const groups = levelData.chapters.reduce<Record<string, typeof levelData.chapters>>((acc, ch) => {
    if (!acc[ch.categoryName]) acc[ch.categoryName] = []
    acc[ch.categoryName].push(ch)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-4 inline-flex items-center gap-1">
            ← 홈으로
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${colors.badge}`}>
              {levelData.label}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{LEVEL_LABELS[level]} 가이드</h1>
          </div>
          <p className="text-gray-500 text-sm mt-2">{levelData.description}</p>
          <p className="text-xs text-gray-400 mt-1">{levelData.totalChapters}개 챕터 · 약 {levelData.totalReadingTime}분</p>
        </div>

        {/* 카테고리별 챕터 — 카테고리 헤더는 시각적 레이블만 (클릭 불가) */}
        <div className="space-y-8">
          {Object.entries(groups).map(([categoryName, chapters]) => (
            <div key={categoryName}>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
                {categoryName}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {chapters.map(ch => (
                  <Link
                    key={ch.slug}
                    href={ch.href}
                    className="bg-white border border-gray-200 hover:border-violet-300 hover:shadow-sm rounded-xl p-4 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${colors.dot}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors leading-snug">
                          {ch.title}
                        </p>
                        {ch.description && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ch.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-2">약 {ch.readingTime}분</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
