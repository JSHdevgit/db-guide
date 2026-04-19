import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// lib/content.ts에 의존하지 않음 — fs + gray-matter만 직접 사용

const CONTENT_DIR = path.join(process.cwd(), 'content')
const OUTPUT = path.join(process.cwd(), 'public', 'search-index.json')

function toSlug(name: string): string {
  return name.replace(/^\d+-/, '').replace(/\.md$/, '')
}

function slugToDisplayName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const entries: object[] = []

const levels = fs.readdirSync(CONTENT_DIR).filter(f =>
  fs.statSync(path.join(CONTENT_DIR, f)).isDirectory()
)

for (const levelSlug of levels) {
  const levelDir = path.join(CONTENT_DIR, levelSlug)
  const categoryDirs = fs.readdirSync(levelDir).filter(f =>
    fs.statSync(path.join(levelDir, f)).isDirectory()
  )

  for (const categoryDir of categoryDirs) {
    const categorySlug = toSlug(categoryDir)
    const catDir = path.join(levelDir, categoryDir)
    const files = fs.readdirSync(catDir).filter(f => f.endsWith('.md'))

    for (const file of files) {
      const chapterSlug = toSlug(file)
      const raw = fs.readFileSync(path.join(catDir, file), 'utf-8')
      const { data } = matter(raw)

      entries.push({
        slug: `${levelSlug}/${categorySlug}/${chapterSlug}`,
        href: `/${levelSlug}/${categorySlug}/${chapterSlug}`,
        title: data.title || slugToDisplayName(chapterSlug),
        description: data.description || '',
        level: levelSlug,
        category: data.category || slugToDisplayName(categorySlug),
      })
    }
  }
}

fs.writeFileSync(OUTPUT, JSON.stringify(entries, null, 2))
console.log(`Search index: ${entries.length} entries → ${OUTPUT}`)
