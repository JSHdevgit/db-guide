import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'DBGuide — PostgreSQL & SQL 학습 가이드',
  description: '데이터베이스 입문부터 고급 튜닝까지. PostgreSQL과 SQL을 실무 예제로 배웁니다.',
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
