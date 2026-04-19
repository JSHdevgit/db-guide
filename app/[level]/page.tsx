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

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
            ← 홈으로
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold tracking-widest uppercase ${colors.badge}`}>
              {levelData.label}
            </span>
            <h1 className="text-2xl font-bold text-gray-900">{LEVEL_LABELS[level]} 가이드</h1>
          </div>
          <p className="mt-2 text-sm text-gray-500">{levelData.description}</p>
          <p className="mt-1 text-xs text-gray-400">{levelData.totalChapters}개 챕터 · 약 {levelData.totalReadingTime}분</p>
        </div>

        {/* 카테고리별 챕터 — 카테고리 헤더는 시각적 레이블만 (클릭 불가) */}
        <div className="space-y-8">
          {Object.entries(groups).map(([categoryName, chapters]) => (
            <div key={categoryName}>
              <h2 className="mb-3 text-xs font-semibold tracking-widest text-gray-400 uppercase">
                {categoryName}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {chapters.map(ch => (
                  <Link
                    key={ch.slug}
                    href={ch.href}
                    className="group rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-violet-300 hover:shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${colors.dot}`} />
                      <div>
                        <p className="text-sm leading-snug font-semibold text-gray-800 transition-colors group-hover:text-violet-700">
                          {ch.title}
                        </p>
                        {ch.description && (
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">{ch.description}</p>
                        )}
                        <p className="mt-2 text-xs text-gray-400">약 {ch.readingTime}분</p>
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
