import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import { getSingletonHighlighter } from 'shiki'

// Server Component 전용 — 'use client' 컴포넌트에서 import 금지

const SUPPORTED_LANGS = [
  'sql', 'bash', 'sh', 'shell', 'yaml', 'typescript', 'javascript',
  'json', 'ini', 'toml', 'plaintext', 'text',
] as const

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

async function highlightCodeBlocks(html: string): Promise<string> {
  const highlighter = await getSingletonHighlighter({
    themes: ['github-dark'],
    langs: SUPPORTED_LANGS as unknown as string[],
  })

  const regex = /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g
  const tasks: Array<{ index: number; length: number; replacement: string }> = []

  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    const lang = m[1] || 'plaintext'
    const code = unescapeHtml(m[2])
    const safeLang = (SUPPORTED_LANGS as readonly string[]).includes(lang) ? lang : 'plaintext'
    try {
      const highlighted = await highlighter.codeToHtml(code, {
        lang: safeLang as 'sql',
        theme: 'github-dark',
      })
      tasks.push({ index: m.index, length: m[0].length, replacement: highlighted })
    } catch {
      // leave as-is
    }
  }

  // Apply replacements from end to start to preserve indices
  let result = html
  for (const { index, length, replacement } of tasks.reverse()) {
    result = result.slice(0, index) + replacement + result.slice(index + length)
  }
  return result
}

const CONTENT_DIR = path.join(process.cwd(), 'content')

export type Level = 'beginner' | 'intermediate' | 'advanced'

export interface Heading {
  id: string
  text: string
  depth: 1 | 2 | 3
}

export interface ChapterMeta {
  slug: string
  level: Level
  levelSlug: string       // 폴더명 그대로
  categorySlug: string    // NN- 제거한 slug
  categoryName: string    // frontmatter category or auto-generated
  chapterSlug: string     // NN- 제거한 slug
  title: string
  description: string
  order: number
  readingTime: number     // 분 단위 (자동 계산 or frontmatter override)
  href: string
}

export interface Chapter extends ChapterMeta {
  bodyHtml: string
  headings: Heading[]
}

// NN- 숫자 접두사를 정렬 키로 추출 (URL slug 생성과 별개)
function getSortKey(name: string): number {
  const match = name.match(/^(\d+)-/)
  return match ? parseInt(match[1], 10) : Infinity
}

// NN- 접두사 제거 → URL slug
function toSlug(name: string): string {
  return name.replace(/^\d+-/, '').replace(/\.md$/, '')
}

// slug → 표시용 이름 (폴더명 자동 변환)
function slugToDisplayName(slug: string): string {
  return slug
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

// 단어 수로 읽기 시간 계산 (200 wpm)
function calcReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length
  return Math.max(1, Math.round(words / 200))
}

export function getAllChapterMeta(): ChapterMeta[] {
  const levels = fs.readdirSync(CONTENT_DIR).filter(f =>
    fs.statSync(path.join(CONTENT_DIR, f)).isDirectory()
  )

  const chapters: ChapterMeta[] = []

  for (const levelSlug of levels) {
    const levelDir = path.join(CONTENT_DIR, levelSlug)
    const categoryDirs = fs
      .readdirSync(levelDir)
      .filter(f => fs.statSync(path.join(levelDir, f)).isDirectory())
      .sort((a, b) => getSortKey(a) - getSortKey(b))

    for (const categoryDir of categoryDirs) {
      const categorySlug = toSlug(categoryDir)
      const catDir = path.join(levelDir, categoryDir)
      const files = fs
        .readdirSync(catDir)
        .filter(f => f.endsWith('.md'))
        .sort((a, b) => getSortKey(a) - getSortKey(b))

      for (const file of files) {
        const chapterSlug = toSlug(file)
        const raw = fs.readFileSync(path.join(catDir, file), 'utf-8')
        const { data, content } = matter(raw)

        const order = typeof data.order === 'number'
          ? data.order
          : getSortKey(file) !== Infinity ? getSortKey(file) : 999

        const categoryName = data.category || slugToDisplayName(categorySlug)
        const readingTime = typeof data.readingTime === 'number'
          ? data.readingTime
          : calcReadingTime(content)

        chapters.push({
          slug: `${levelSlug}/${categorySlug}/${chapterSlug}`,
          level: levelSlug as Level,
          levelSlug,
          categorySlug,
          categoryName,
          chapterSlug,
          title: data.title || slugToDisplayName(chapterSlug),
          description: data.description || '',
          order,
          readingTime,
          href: `/${levelSlug}/${categorySlug}/${chapterSlug}`,
        })
      }
    }
  }

  return chapters
}

export async function getChapter(
  levelSlug: string,
  categorySlug: string,
  chapterSlug: string
): Promise<Chapter | null> {
  // categorySlug로 실제 폴더 찾기 (NN- 접두사 있는 폴더)
  const levelDir = path.join(CONTENT_DIR, levelSlug)
  if (!fs.existsSync(levelDir)) return null

  const categoryDirs = fs.readdirSync(levelDir).filter(f =>
    fs.statSync(path.join(levelDir, f)).isDirectory()
  )
  const categoryDir = categoryDirs.find(d => toSlug(d) === categorySlug)
  if (!categoryDir) return null

  const catDir = path.join(levelDir, categoryDir)
  const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'))
  const file = files.find(f => toSlug(f) === chapterSlug)
  if (!file) return null

  const raw = fs.readFileSync(path.join(catDir, file), 'utf-8')
  const { data, content } = matter(raw)

  const headings: Heading[] = []

  const vfile = await remark()
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(() => (tree: any) => {
      // rehype AST에서 헤딩 추출
      const visit = (node: any) => {
        if (node.type === 'element' && /^h[123]$/.test(node.tagName)) {
          const depth = parseInt(node.tagName[1]) as 1 | 2 | 3
          const id = node.properties?.id as string || ''
          const text = extractText(node)
          if (id && text) headings.push({ id, text, depth })
        }
        if (node.children) node.children.forEach(visit)
      }
      visit(tree)
    })
    .use(rehypeStringify)
    .process(content)

  const bodyHtml = await highlightCodeBlocks(String(vfile))
  const readingTime = typeof data.readingTime === 'number'
    ? data.readingTime
    : calcReadingTime(content)

  const categoryName = data.category || slugToDisplayName(categorySlug)
  const order = typeof data.order === 'number' ? data.order : getSortKey(file)

  return {
    slug: `${levelSlug}/${categorySlug}/${chapterSlug}`,
    level: levelSlug as Level,
    levelSlug,
    categorySlug,
    categoryName,
    chapterSlug,
    title: data.title || slugToDisplayName(chapterSlug),
    description: data.description || '',
    order,
    readingTime,
    href: `/${levelSlug}/${categorySlug}/${chapterSlug}`,
    bodyHtml,
    headings,
  }
}

function extractText(node: any): string {
  if (node.type === 'text') return node.value || ''
  if (node.children) return node.children.map(extractText).join('')
  return ''
}

// 레벨별 메타 요약
export interface LevelSummary {
  slug: Level
  label: string
  description: string
  color: 'green' | 'yellow' | 'pink'
  chapters: ChapterMeta[]
  totalChapters: number
  totalReadingTime: number
  categories: string[]
}

const LEVEL_META: Record<string, Omit<LevelSummary, 'slug' | 'chapters' | 'totalChapters' | 'totalReadingTime' | 'categories'>> = {
  beginner: {
    label: '입문',
    description: 'SQL 기초 문법부터 스키마 설계까지. 데이터베이스를 처음 접하는 분께 맞춰져 있습니다.',
    color: 'green',
  },
  intermediate: {
    label: '중급',
    description: '서브쿼리, Window 함수, 트랜잭션. 실무에서 바로 쓰는 패턴들을 다룹니다.',
    color: 'yellow',
  },
  advanced: {
    label: '고급',
    description: 'EXPLAIN ANALYZE, 인덱스 전략, 파티셔닝. DBA 수준의 성능 튜닝과 운영.',
    color: 'pink',
  },
}

export function getLevelSummaries(): LevelSummary[] {
  const all = getAllChapterMeta()
  const order: Level[] = ['beginner', 'intermediate', 'advanced']

  return order.map(level => {
    const chapters = all.filter(c => c.level === level)
    const categories = [...new Set(chapters.map(c => c.categoryName))]
    const totalReadingTime = chapters.reduce((s, c) => s + c.readingTime, 0)
    return {
      slug: level,
      ...LEVEL_META[level],
      chapters,
      totalChapters: chapters.length,
      totalReadingTime,
      categories,
    }
  })
}

// 이전/다음 챕터
export function getPrevNext(
  levelSlug: string,
  categorySlug: string,
  chapterSlug: string
): { prev: ChapterMeta | null; next: ChapterMeta | null } {
  const all = getAllChapterMeta().filter(c => c.level === levelSlug as Level)
  const idx = all.findIndex(
    c => c.categorySlug === categorySlug && c.chapterSlug === chapterSlug
  )
  return {
    prev: idx > 0 ? all[idx - 1] : null,
    next: idx < all.length - 1 ? all[idx + 1] : null,
  }
}
