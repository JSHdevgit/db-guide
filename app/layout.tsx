import type { Metadata, Viewport } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dbguide.dev'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'DBGuide — PostgreSQL & SQL 학습 가이드',
    template: '%s | DBGuide',
  },
  description: '데이터베이스 입문부터 고급 튜닝까지. PostgreSQL과 SQL을 실무 예제로 배웁니다.',
  keywords: [
    'PostgreSQL', 'SQL', '데이터베이스', 'DB', '쿼리 최적화',
    '인덱스', '트랜잭션', '입문', '중급', '고급', '튜닝',
  ],
  authors: [{ name: 'DBGuide' }],
  creator: 'DBGuide',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: 'DBGuide',
    title: 'DBGuide — PostgreSQL & SQL 학습 가이드',
    description: '데이터베이스 입문부터 고급 튜닝까지. PostgreSQL과 SQL을 실무 예제로 배웁니다.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DBGuide — PostgreSQL & SQL 학습 가이드',
    description: '데이터베이스 입문부터 고급 튜닝까지. PostgreSQL과 SQL을 실무 예제로 배웁니다.',
  },
  icons: {
    icon: '/icon.svg',
  },
  alternates: {
    canonical: SITE_URL,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
