# DBGuide 프로젝트 스펙 문서

## 프로젝트 개요

PostgreSQL & SQL을 한국어로 학습하는 교육 플랫폼. 입문 → 중급 → 고급의 단계별 커리큘럼을 제공하며, Markdown 기반 콘텐츠, Supabase 댓글 시스템, 로컬스토리지 진도 관리를 포함한다.

**기술 스택:**
- Next.js 16 (App Router, SSG), React 19, TypeScript 5
- Tailwind CSS 4, PostCSS
- Supabase (댓글 DB), bcryptjs (비밀번호 해싱)
- Markdown 파이프라인: gray-matter, remark, rehype, Shiki (구문 강조)
- Fuse.js (퍼지 검색), Vitest (테스트)

---

## 디렉터리 구조

```
dbguide/
├── app/                    # Next.js App Router (페이지 & API 라우트)
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 홈 페이지
│   ├── [level]/
│   │   ├── page.tsx        # 레벨 목록 페이지
│   │   └── [category]/
│   │       └── [slug]/
│   │           └── page.tsx # 챕터 상세 페이지
│   └── api/
│       └── comments/
│           ├── route.ts    # GET, POST
│           └── [id]/
│               └── route.ts # PATCH, DELETE
├── components/             # 재사용 컴포넌트
├── lib/                    # 서버 유틸리티 & 훅
├── content/                # Markdown 콘텐츠 (26개 파일)
│   ├── beginner/           # 입문: SQL 기초, 스키마 설계, PostgreSQL 기초
│   ├── intermediate/       # 중급: 고급 쿼리, 트랜잭션, 인덱스
│   └── advanced/           # 고급: 성능 튜닝, 운영, 복제
├── public/
│   └── search-index.json   # 빌드 시 자동 생성 (검색 인덱스)
└── scripts/
    ├── build-search-index.ts  # 검색 인덱스 생성 스크립트
    └── supabase-comments.sql  # Supabase 댓글 테이블 스키마
```

---

## 컴포넌트 명세

### `Header` (`components/Header.tsx`)

**타입:** 클라이언트 컴포넌트

**역할:** 전역 상단 내비게이션 바 및 전체 검색

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `onMenuClick` | `() => void` (선택) | 사이드바 토글 콜백 |

**기능:**
- Fuse.js 기반 퍼지 검색 (search-index.json에서 로드)
- 키보드 단축키: `⌘K` 모달 열기, `Esc` 닫기, 방향키로 결과 탐색
- 검색 결과에 입문/중급/고급 색상 배지 표시
- 반응형: 모바일 햄버거 메뉴, 데스크톱 인라인 내비

**렌더링 요소:**
- 로고 (홈 링크)
- 내비 링크: 입문 / 중급 / 고급
- 검색 버튼 + 검색 모달 (React Portal)

---

### `Sidebar` (`components/Sidebar.tsx`)

**타입:** 클라이언트 컴포넌트

**역할:** 카테고리별 챕터 목록 사이드바

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `chapters` | `ChapterMeta[]` | 렌더링할 챕터 목록 |
| `isOpen` | `boolean` | 모바일 사이드바 열림 여부 |
| `onClose` | `() => void` | 사이드바 닫기 콜백 |

**기능:**
- 데스크톱: 항상 표시 (w-56, 좌측 고정)
- 모바일: 오버레이 모달 (배경 클릭 시 닫힘)
- 챕터를 카테고리별로 그룹핑
- 현재 챕터 violet 테두리 하이라이트
- localStorage에서 읽음 여부 확인 → 초록 점(`ReadDot`) 표시
- 챕터 클릭 시 자동 닫힘

---

### `ChapterLayout` (`components/ChapterLayout.tsx`)

**타입:** 클라이언트 컴포넌트 (레이아웃 래퍼)

**역할:** 챕터 페이지의 3단 레이아웃 구성

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `siblings` | `ChapterMeta[]` | 사이드바 표시용 같은 레벨 챕터 |
| `headings` | `Heading[]` | TOC 표시용 제목 목록 |
| `children` | `React.ReactNode` | 메인 콘텐츠 |

**레이아웃 구조:**
```
[Header - 전체 너비]
[Sidebar | 메인 콘텐츠 | TOC(데스크톱)]
```

---

### `TOC` (`components/TOC.tsx`)

**타입:** 클라이언트 컴포넌트

**역할:** 우측 고정 목차 (데스크톱 전용)

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `headings` | `Heading[]` | h1~h3 제목 목록 |

**기능:**
- IntersectionObserver로 현재 스크롤 위치의 제목 감지
- 활성 제목 violet-400 색상으로 강조
- depth ≤ 3인 제목만 표시
- sticky top-13 고정 (`lg:block`, 모바일 숨김)

---

### `MobileTOC` (`components/MobileTOC.tsx`)

**타입:** 클라이언트 컴포넌트

**역할:** 모바일/태블릿용 아코디언 목차

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `headings` | `Heading[]` | h1~h3 제목 목록 |

**기능:**
- 토글 버튼으로 목차 접기/펼치기
- 제목 클릭 시 아코디언 자동 닫힘
- `lg:hidden` (데스크톱에서는 숨김)

---

### `Comments` (`components/Comments.tsx`)

**타입:** 클라이언트 컴포넌트

**역할:** 챕터별 중첩 댓글 시스템

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `chapterSlug` | `string` | 댓글 조회/작성 대상 챕터 식별자 |

**기능:**
- 중첩 댓글 (대댓글, `CommentItem` 재귀 렌더링)
- 닉네임 localStorage 저장 (`useNickname` 훅)
- 비밀번호 기반 수정/삭제 (서버에서 bcrypt 검증)
- 평탄한 DB 데이터 → 트리 구조 변환 (`buildTree`)
- 한국어 상대 시간 표시 (방금 전 / N분 전 / N시간 전 / N일 전)

**내부 서브컴포넌트:**
- `NicknameEditor`: 닉네임 인라인 수정
- `CommentForm`: 신규 댓글 작성 폼
- `ReplyForm`: 대댓글 작성 폼
- `CommentItem`: 단일 댓글 노드 (재귀, 수정/삭제/답글 액션 포함)

---

### `ProgressTracker` (`components/ProgressTracker.tsx`)

**타입:** 클라이언트 컴포넌트 (렌더링 없음)

**역할:** 스크롤 진도 추적 (읽음 상태 저장)

**Props:**
| Prop | 타입 | 설명 |
|------|------|------|
| `slug` | `string` | 챕터 식별자 |

**기능:**
- 페이지 80% 스크롤 시 읽음 완료로 표시
- localStorage (`dbguide_progress`) 에 `{ [slug]: true }` 저장
- 한 번 기록 후 이벤트 리스너 자동 제거
- 렌더링 없음 (null 반환)

---

## 페이지 & 라우트

### 루트 레이아웃 (`app/layout.tsx`)
- 전역 메타데이터 (한국어), Tailwind CSS 적용
- `<html lang="ko">`, `bg-gray-50` 배경

### 홈 페이지 (`/`)
- 히어로 섹션 (다크 그라데이션 배경)
- 3개 레벨 카드 (입문=green, 중급=yellow, 고급=pink)
- 각 카드: 배지, 설명, 챕터 미리보기(최대 5개), 전체 챕터 수
- `getLevelSummaries()` 서버 호출로 데이터 조회

### 레벨 목록 페이지 (`/[level]`)
- 브레드크럼 내비게이션
- 레벨 배지 + 설명 + 통계 (총 챕터 수, 총 읽기 시간)
- 카테고리별 챕터 그룹핑 (2열 그리드)
- 각 챕터 카드: 진도 점 표시, 제목, 설명, 읽기 예상 시간
- SSG (`generateStaticParams` 사용)

### 챕터 상세 페이지 (`/[level]/[category]/[slug]`)
- `ChapterLayout` 3단 레이아웃
- 챕터 제목, 읽기 시간, 카테고리 배지
- `MobileTOC` 아코디언 (모바일)
- Markdown → HTML 렌더링 (Shiki 구문 강조 포함)
- 이전/다음 챕터 내비게이션 버튼
- 댓글 섹션 (`Comments`)
- `ProgressTracker` (묵시적 스크롤 추적)
- SSG + `generateMetadata` 사용

---

## API 라우트

### `GET /api/comments?chapterSlug={slug}`
- `chapter_slug`로 댓글 목록 조회 (created_at 정렬)
- 응답: `{ comments: CommentData[] }`
- 오류: 400 (파라미터 누락), 503 (Supabase 미설정)

### `POST /api/comments`
- 신규 댓글 작성
- Body: `{ chapterSlug, parentId?, nickname, body, password }`
- 유효성 검사: nickname 1-40자, body 1-2000자, password 필수
- 비밀번호 bcrypt 해싱 후 저장
- 응답: 201 `{ comment: CommentData }`

### `PATCH /api/comments/[id]`
- 댓글 수정
- Body: `{ password, body?, nickname? }`
- bcrypt로 비밀번호 검증 후 수정
- 응답: 200 `{ comment: CommentData }`
- 오류: 401 (비밀번호 불일치), 404 (댓글 없음)

### `DELETE /api/comments/[id]`
- 댓글 삭제
- Body: `{ password }`
- bcrypt로 비밀번호 검증 후 삭제
- 응답: 204 No Content
- 오류: 401 (비밀번호 불일치), 404 (댓글 없음)

---

## 데이터 모델

### `ChapterMeta`
```typescript
interface ChapterMeta {
  slug: string          // "{level}/{category}/{chapter}"
  level: 'beginner' | 'intermediate' | 'advanced'
  levelSlug: string
  categorySlug: string  // NN- 접두사 제거된 카테고리 폴더명
  categoryName: string  // frontmatter 또는 자동 생성
  chapterSlug: string   // NN- 접두사, .md 제거된 파일명
  title: string         // frontmatter
  description: string   // frontmatter (기본값 '')
  order: number         // frontmatter 또는 NN- 추출
  readingTime: number   // 분 단위 (200wpm 기준 자동 계산)
  href: string          // "/{level}/{category}/{chapter}"
}
```

### `Chapter`
```typescript
interface Chapter extends ChapterMeta {
  bodyHtml: string    // remark/rehype 파이프라인 처리된 HTML
  headings: Heading[] // AST에서 추출된 제목 목록
}
```

### `Heading`
```typescript
interface Heading {
  id: string        // rehype-slug 자동 생성
  text: string      // 제목 텍스트
  depth: 1 | 2 | 3  // h1, h2, h3
}
```

### `LevelSummary`
```typescript
interface LevelSummary {
  slug: 'beginner' | 'intermediate' | 'advanced'
  label: string              // '입문' | '중급' | '고급'
  description: string
  color: 'green' | 'yellow' | 'pink'
  chapters: ChapterMeta[]
  totalChapters: number
  totalReadingTime: number   // 전체 챕터 읽기 시간 합산
  categories: string[]       // 고유 카테고리명 목록
}
```

### `CommentData` (Supabase 테이블)
```typescript
type CommentData = {
  id: string                 // UUID
  chapter_slug: string       // 챕터 식별자
  parent_id: string | null   // 대댓글용 자기 참조 FK
  nickname: string           // 1-40자
  body: string               // 1-2000자
  created_at: string         // ISO 타임스탬프
  updated_at: string
  edited: boolean            // 수정 여부 표시용
  // password_hash: string   // 서버 전용, 클라이언트에 노출 안 됨
}
```

### Markdown Frontmatter
```yaml
---
title: "챕터 제목"
category: "카테고리명"
order: 1
description: "짧은 설명"
readingTime: 5  # 선택, 수동 설정
---
```

---

## 유틸리티 & 훅

### `lib/content.ts` (서버 전용)
| 함수 | 설명 |
|------|------|
| `getAllChapterMeta()` | content/ 디렉터리 스캔, 전체 챕터 메타 반환 |
| `getChapter(level, category, slug)` | 챕터 로드 + Markdown → HTML 변환 |
| `getPrevNext(level, category, slug)` | 이전/다음 챕터 메타 반환 |
| `getLevelSummaries()` | 3개 레벨 요약 정보 반환 |
| `getSortKey(name)` | NN- 접두사에서 정렬 순서 추출 |
| `calcReadingTime(text)` | 200wpm 기준 읽기 시간 계산 |
| `highlightCodeBlocks(html)` | Shiki github-dark 테마 구문 강조 |

### `lib/supabase.ts` (서버 전용)
| 함수 | 설명 |
|------|------|
| `getSupabaseAdmin()` | 서비스 롤 키로 Supabase 관리자 클라이언트 초기화 |

### `lib/nicknames.ts` (클라이언트)
| 함수/훅 | 설명 |
|---------|------|
| `generateNickname()` | 랜덤 "{형용사} {명사}{2자리 숫자}" 생성 |
| `useNickname()` | localStorage에서 닉네임 읽기/쓰기 훅 |

### `lib/relativeTime.ts` (클라이언트)
| 함수 | 설명 |
|------|------|
| `formatRelativeTime(dateString)` | 한국어 상대 시간 변환 (방금 전 / N분 전 / N시간 전 / N일 전) |

---

## 로컬스토리지 구조

| 키 | 형식 | 설명 |
|----|------|------|
| `dbguide_progress` | `{ [chapterSlug]: true }` | 챕터 읽음 완료 여부 |
| `dbguide:nickname` | `string` | 댓글 작성용 닉네임 |

---

## 콘텐츠 구조

파일명 숫자 접두사(NN-)로 정렬 순서 결정.

**레벨별 카테고리:**
- **입문** (`content/beginner/`): SQL 기초 (6챕터), 스키마 설계 (3챕터), PostgreSQL 기초
- **중급** (`content/intermediate/`): 고급 쿼리, 트랜잭션, 인덱스
- **고급** (`content/advanced/`): 성능 튜닝, 운영, 복제

**전체 콘텐츠:** 26개 Markdown 파일

---

## 빌드 프로세스

```
prebuild → tsx scripts/build-search-index.ts  (search-index.json 생성)
build    → next build                          (SSG 정적 파일 생성)
```

**빌드 시 생성되는 정적 라우트:**
- `/` (홈)
- `/beginner`, `/intermediate`, `/advanced` (레벨 목록)
- `/{level}/{category}/{slug}` (전체 챕터)

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 (현재 미사용) |
| `SUPABASE_SERVICE_ROLE_KEY` | API 라우트용 서비스 롤 키 (서버 전용) |
