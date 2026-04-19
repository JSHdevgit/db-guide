import type { MetadataRoute } from 'next'
import { getAllChapterMeta, getLevelSummaries } from '@/lib/content'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dbguide.dev'

export default function sitemap(): MetadataRoute.Sitemap {
  const levels = getLevelSummaries()
  const chapters = getAllChapterMeta()

  const levelRoutes = levels.map(l => ({
    url: `${SITE_URL}/${l.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const chapterRoutes = chapters.map(ch => ({
    url: `${SITE_URL}${ch.href}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...levelRoutes,
    ...chapterRoutes,
  ]
}
