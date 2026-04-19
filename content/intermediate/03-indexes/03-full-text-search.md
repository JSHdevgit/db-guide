---
title: "전문 검색 인덱스 (Full-Text Search)"
category: "인덱스"
order: 3
description: "PostgreSQL의 전문 검색 기능을 활용해 텍스트 데이터를 효율적으로 검색하는 방법을 배웁니다."
---

## 전문 검색이란?

`LIKE '%검색어%'`는 인덱스를 사용하지 못하고 전체 스캔합니다. 전문 검색(Full-Text Search)은 텍스트를 토큰으로 분리하고 인덱스를 통해 빠르게 검색합니다.

## 핵심 개념

- **tsvector**: 검색 대상 텍스트를 정규화한 토큰 집합
- **tsquery**: 검색 쿼리 표현식
- **ts_rank**: 검색 결과의 관련도 점수

## 기본 사용법

```sql
-- tsvector 변환
SELECT to_tsvector('english', 'PostgreSQL is a powerful database system');
-- 'databas':5 'postgreql':1 'power':4 'system':6

-- tsquery 생성
SELECT to_tsquery('english', 'powerful & database');

-- 검색 (@@  연산자)
SELECT title FROM articles
WHERE to_tsvector('english', content) @@ to_tsquery('english', 'postgresql & index');
```

## 한국어 검색

PostgreSQL 기본 파서는 한국어 형태소 분석을 지원하지 않습니다. 간단한 방법은 `simple` 딕셔너리를 사용하거나 `pg_bigm` 확장을 설치하는 것입니다.

```sql
-- simple: 소문자 변환만 수행
SELECT to_tsvector('simple', '데이터베이스 인덱스 최적화');

-- pg_bigm 설치 후 (2-gram 기반 한국어 검색)
CREATE EXTENSION pg_bigm;
SELECT * FROM articles WHERE title LIKE '%데이터베이스%';  -- GIN 인덱스 활용
```

## 성능을 위한 tsvector 열 추가

매번 `to_tsvector()` 계산은 비쌉니다. 별도 열에 미리 계산해 저장합니다.

```sql
ALTER TABLE articles ADD COLUMN search_vector TSVECTOR;

-- 기존 데이터 채우기
UPDATE articles
SET search_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(body, ''));

-- GIN 인덱스 생성
CREATE INDEX idx_articles_search ON articles USING GIN(search_vector);

-- 트리거로 자동 갱신
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := to_tsvector('english',
        COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.body, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_articles_search
BEFORE INSERT OR UPDATE ON articles
FOR EACH ROW EXECUTE FUNCTION update_search_vector();
```

## 검색 쿼리 패턴

```sql
-- AND 검색 (두 단어 모두 포함)
WHERE search_vector @@ to_tsquery('english', 'database & index')

-- OR 검색
WHERE search_vector @@ to_tsquery('english', 'mysql | postgresql')

-- NOT 검색
WHERE search_vector @@ to_tsquery('english', 'database & !nosql')

-- 접두어 검색
WHERE search_vector @@ to_tsquery('english', 'data:*')  -- data로 시작하는 단어

-- 자연어 검색 (plainto_tsquery: & 자동 삽입)
WHERE search_vector @@ plainto_tsquery('english', 'database index optimization')
```

## 관련도 순 정렬

```sql
SELECT
    title,
    ts_rank(search_vector, query) AS rank
FROM articles,
     to_tsquery('english', 'postgresql & performance') AS query
WHERE search_vector @@ query
ORDER BY rank DESC
LIMIT 10;
```

## LIKE vs 전문 검색 성능 비교

| 방법 | 백만 건 검색 | 인덱스 |
|------|------------|--------|
| `LIKE '%word%'` | ~2000ms | 불가 (Seq Scan) |
| `LIKE 'word%'` | ~5ms | B-tree 가능 |
| 전문 검색 (GIN) | ~5ms | GIN 사용 |
