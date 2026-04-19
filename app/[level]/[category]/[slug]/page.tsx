import { notFound } from 'next/navigation'
import Link from 'next/link'
import ProgressTracker from '@/components/ProgressTracker'
import ChapterLayout from '@/components/ChapterLayout'
import MobileTOC from '@/components/MobileTOC'
import { getAllChapterMeta, getChapter, getPrevNext } from '@/lib/content'
import Comments from '@/components/Comments'

const LEVEL_LABELS: Record<string, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
}

export async function generateStaticParams() {
  const chapters = getAllChapterMeta()
  return chapters.map(ch => ({
    level: ch.levelSlug,
    category: ch.categorySlug,
    slug: ch.chapterSlug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string; category: string; slug: string }>
}) {
  const { level, category, slug } = await params
  const chapter = await getChapter(level, category, slug)
  if (!chapter) return {}
  return {
    title: chapter.title,
    description: chapter.description,
    keywords: [chapter.title, chapter.categoryName, 'PostgreSQL', 'SQL', '데이터베이스'],
    openGraph: {
      type: 'article',
      title: `${chapter.title} — DBGuide`,
      description: chapter.description,
    },
    twitter: {
      card: 'summary',
      title: `${chapter.title} — DBGuide`,
      description: chapter.description,
    },
    alternates: {
      canonical: `/${chapter.levelSlug}/${chapter.categorySlug}/${chapter.chapterSlug}`,
    },
  }
}

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ level: string; category: string; slug: string }>
}) {
  const { level, category, slug } = await params
  const chapter = await getChapter(level, category, slug)
  if (!chapter) notFound()

  const { prev, next } = getPrevNext(level, category, slug)
  const siblings = getAllChapterMeta().filter(c => c.level === level)

  return (
    <ChapterLayout siblings={siblings} headings={chapter.headings}>
      <ProgressTracker slug={chapter.slug} />

      {/* 브레드크럼 */}
      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
        <Link href="/" className="hover:text-gray-600">홈</Link>
        <span>›</span>
        <Link href={`/${chapter.levelSlug}`} className="hover:text-gray-600">
          {LEVEL_LABELS[chapter.level] ?? chapter.level}
        </Link>
        <span>›</span>
        <span className="text-gray-500">{chapter.categoryName}</span>
        <span>›</span>
        <span className="text-gray-700">{chapter.title}</span>
      </nav>

      <h1 className="mb-2 text-2xl font-bold text-gray-900">{chapter.title}</h1>
      <div className="mb-6 flex items-center gap-3 text-xs text-gray-400">
        <span>📖 약 {chapter.readingTime}분</span>
        <span>🏷 {chapter.categoryName}</span>
      </div>

      {/* 모바일 TOC 아코디언 (lg 미만에서만 표시) */}
      <MobileTOC headings={chapter.headings} />

      {/* 마크다운 본문 */}
      <div
        className="prose"
        dangerouslySetInnerHTML={{ __html: chapter.bodyHtml }}
      />

      {/* 이전/다음 */}
      <div className="mt-12 flex justify-between gap-4 border-t border-gray-200 pt-6">
        {prev ? (
          <Link
            href={prev.href}
            className="group max-w-xs flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm transition-all hover:border-violet-300"
          >
            <p className="mb-1 text-xs text-gray-400">← 이전</p>
            <p className="leading-tight font-medium text-gray-700 group-hover:text-violet-700">{prev.title}</p>
          </Link>
        ) : <div className="flex-1" />}

        {next ? (
          <Link
            href={next.href}
            className="group ml-auto max-w-xs flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-right text-sm transition-all hover:border-violet-300"
          >
            <p className="mb-1 text-xs text-gray-400">다음 →</p>
            <p className="leading-tight font-medium text-gray-700 group-hover:text-violet-700">{next.title}</p>
          </Link>
        ) : <div className="flex-1" />}
      </div>

      <Comments chapterSlug={chapter.slug} />
    </ChapterLayout>
  )
}
