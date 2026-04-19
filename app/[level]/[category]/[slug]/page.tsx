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
    title: `${chapter.title} — DBGuide`,
    description: chapter.description,
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
      <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5 flex-wrap">
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

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{chapter.title}</h1>
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-6">
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
      <div className="flex justify-between mt-12 pt-6 border-t border-gray-200 gap-4">
        {prev ? (
          <Link
            href={prev.href}
            className="flex-1 text-left bg-white border border-gray-200 hover:border-violet-300 rounded-xl px-4 py-3 text-sm transition-all group max-w-xs"
          >
            <p className="text-xs text-gray-400 mb-1">← 이전</p>
            <p className="text-gray-700 group-hover:text-violet-700 font-medium leading-tight">{prev.title}</p>
          </Link>
        ) : <div className="flex-1" />}

        {next ? (
          <Link
            href={next.href}
            className="flex-1 text-right bg-white border border-gray-200 hover:border-violet-300 rounded-xl px-4 py-3 text-sm transition-all group max-w-xs ml-auto"
          >
            <p className="text-xs text-gray-400 mb-1">다음 →</p>
            <p className="text-gray-700 group-hover:text-violet-700 font-medium leading-tight">{next.title}</p>
          </Link>
        ) : <div className="flex-1" />}
      </div>

      <Comments chapterSlug={chapter.slug} />
    </ChapterLayout>
  )
}
