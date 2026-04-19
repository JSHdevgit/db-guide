---
title: "배열 타입과 연산"
category: "고급 쿼리"
order: 6
description: "PostgreSQL 배열 타입을 활용해 다중 값을 하나의 열에 저장하고 조작하는 방법을 배웁니다."
---

## 배열 타입

PostgreSQL은 모든 데이터 타입의 배열을 지원합니다.

```sql
CREATE TABLE articles (
    id       SERIAL PRIMARY KEY,
    title    VARCHAR(300) NOT NULL,
    tags     TEXT[],          -- 문자열 배열
    scores   INT[]            -- 정수 배열
);

INSERT INTO articles (title, tags, scores)
VALUES ('PostgreSQL 입문', ARRAY['database', 'sql', 'postgresql'], ARRAY[95, 87, 92]);
```

## 배열 리터럴

```sql
-- 두 가지 방식
SELECT ARRAY[1, 2, 3];
SELECT '{1, 2, 3}'::INT[];

-- 2차원 배열
SELECT ARRAY[[1, 2], [3, 4]];
```

## 배열 요소 접근 (1-based index)

```sql
SELECT tags[1] FROM articles;          -- 첫 번째 태그
SELECT tags[1:2] FROM articles;        -- 슬라이싱 (1~2번째)
SELECT array_length(tags, 1) FROM articles;  -- 배열 길이
```

## 배열 검색

```sql
-- 특정 값 포함 여부
SELECT * FROM articles WHERE 'sql' = ANY(tags);
SELECT * FROM articles WHERE tags @> ARRAY['sql', 'database'];  -- 모두 포함
SELECT * FROM articles WHERE tags && ARRAY['sql', 'python'];     -- 하나라도 포함
```

## 배열 조작 함수

```sql
-- 요소 추가
SELECT array_append(ARRAY[1, 2, 3], 4);         -- {1,2,3,4}
SELECT array_prepend(0, ARRAY[1, 2, 3]);         -- {0,1,2,3}
SELECT array_cat(ARRAY[1, 2], ARRAY[3, 4]);      -- {1,2,3,4}

-- 요소 제거
SELECT array_remove(ARRAY[1, 2, 2, 3], 2);      -- {1,3}

-- 배열 → 행으로 변환 (unnest)
SELECT unnest(ARRAY['a', 'b', 'c']) AS element;
-- a
-- b
-- c
```

## 집계 → 배열

```sql
-- 부서별 직원 이름을 배열로 수집
SELECT
    department,
    array_agg(name ORDER BY name) AS members,
    array_agg(salary)              AS salaries
FROM employees
GROUP BY department;
```

## unnest 활용 — 배열을 테이블처럼

```sql
-- 태그별 게시글 수 집계
SELECT
    unnest(tags) AS tag,
    COUNT(*)     AS article_count
FROM articles
GROUP BY tag
ORDER BY article_count DESC;
```

## GIN 인덱스로 배열 검색 가속

```sql
CREATE INDEX idx_articles_tags ON articles USING GIN(tags);

-- @>, &&, ANY 연산이 인덱스를 사용하게 됨
SELECT * FROM articles WHERE tags @> ARRAY['postgresql'];
```

> 배열은 정규화의 대안이 아닙니다. 배열 요소를 기준으로 JOIN이 필요하다면 별도 테이블로 분리하는 것이 더 적합합니다.
