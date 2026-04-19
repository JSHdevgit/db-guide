'use client'

import { useState, useEffect, useCallback } from 'react'

const ADJECTIVES = [
  '게으른', '용감한', '수줍은', '춤추는', '졸린', '엉뚱한', '귀여운', '장난스러운',
  '진지한', '느릿느릿한', '빠른', '조용한', '시끄러운', '행복한', '호기심많은',
  '겁많은', '자랑스러운', '수상한', '멋진', '귀찮은', '흥분한', '당황한',
  '부끄러운', '짓궂은', '깜찍한', '투덜거리는', '열정적인', '냉정한', '따뜻한',
  '차가운', '달콤한', '씩씩한', '소심한', '대담한', '신비로운', '황당한',
  '배고픈', '신난', '졸린', '예의바른', '철없는',
]

const NOUNS = [
  '고양이', '다람쥐', '판다', '문어', '감자', '붕어빵', '강아지', '토끼',
  '햄스터', '펭귄', '북극곰', '수달', '너구리', '여우', '사슴', '양',
  '코알라', '나무늘보', '미어캣', '알파카', '라마', '카피바라', '오리', '참새',
  '무당벌레', '달팽이', '거북이', '복어', '해파리', '가재', '도토리', '바나나',
  '국수', '호떡', '도넛', '마카롱', '떡볶이', '파인애플', '수박', '망고',
]

const STORAGE_KEY = 'dbguide:nickname'

export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const num = Math.floor(Math.random() * 90 + 10)
  return `${adj} ${noun}${num}`
}

export function useNickname() {
  const [nickname, setNicknameState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setNicknameState(stored)
    } else {
      const generated = generateNickname()
      localStorage.setItem(STORAGE_KEY, generated)
      setNicknameState(generated)
    }
  }, [])

  const setNickname = useCallback((next: string) => {
    localStorage.setItem(STORAGE_KEY, next)
    setNicknameState(next)
  }, [])

  return { nickname, setNickname }
}
