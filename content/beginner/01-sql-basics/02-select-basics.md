---
title: "SELECT 문 이해하기"
category: "SQL 기초"
order: 2
description: "SELECT의 기본 문법과 실무에서 쓰는 패턴"
---

## 기본 문법

SELECT는 데이터베이스에서 데이터를 조회하는 명령입니다. 가장 많이 쓰는 SQL 명령이며, 복잡한 분석 쿼리도 결국 SELECT의 조합입니다.

```sql
SELECT column1, column2
FROM   table_name
WHERE  condition
ORDER BY column1 ASC
LIMIT  10;
```

SQL은 이렇게 작성하지만, 실제 실행 순서는 `FROM → WHERE → SELECT → ORDER BY → LIMIT` 입니다. 이 순서를 알면 "왜 SELECT에서 만든 별칭을 WHERE에서 못 쓰는지"가 이해됩니다 — WHERE가 먼저 실행되므로 아직 별칭이 없기 때문입니다.

## 열 선택

```sql
-- 모든 열 조회 (실무에서는 지양)
SELECT * FROM users;

-- 필요한 열만 명시 (권장)
SELECT id, name, email FROM users;
```

> **팁:** `SELECT *`는 편하지만 불필요한 데이터까지 가져와 성능이 나빠질 수 있습니다. 특히 네트워크를 통해 대량 데이터를 전송하거나, 컬럼이 많은 테이블에서는 체감 차이가 큽니다. 항상 필요한 열만 명시하세요.

## 별칭 (Alias)

컬럼이나 테이블에 읽기 쉬운 이름을 붙일 수 있습니다.

```sql
-- 컬럼 별칭 (AS는 생략 가능)
SELECT
  u.name      AS user_name,
  u.email     AS contact_email,
  u.created_at AS joined_at
FROM users u;  -- 테이블 별칭: users를 u로

-- 계산식에도 별칭 사용
SELECT
  price,
  price * 0.1 AS vat,
  price * 1.1 AS total_with_vat
FROM products;
```

## DISTINCT — 중복 제거

```sql
-- 중복 없이 도시 목록
SELECT DISTINCT city FROM users;

-- 여러 컬럼: 조합이 유일한 것만
SELECT DISTINCT city, country FROM users;
```

> **주의:** `DISTINCT`는 전체 결과를 정렬해서 중복을 제거하므로 데이터가 많을수록 느립니다. 대량 데이터에서 유니크한 값 개수가 필요하다면 `COUNT(DISTINCT column)` 또는 집계 쿼리를 고려하세요.

## WHERE로 필터링

```sql
-- 활성 사용자만 조회
SELECT id, name, email
FROM   users
WHERE  is_active = true;

-- 특정 기간 내 가입자
SELECT name, created_at
FROM   users
WHERE  created_at >= '2024-01-01'
  AND  created_at <  '2025-01-01';
```

## ORDER BY로 정렬

```sql
-- 최신 가입자부터 (내림차순)
SELECT name, created_at
FROM   users
ORDER BY created_at DESC;

-- 이름 알파벳 순 (오름차순, 기본값)
SELECT name FROM users ORDER BY name ASC;

-- 여러 기준: 카테고리 오름차순, 가격 내림차순
SELECT name, category, price
FROM products
ORDER BY category ASC, price DESC;
```

> **팁:** `ORDER BY`에서 컬럼 번호로 참조할 수 있습니다 (`ORDER BY 2 DESC`). 하지만 쿼리가 변경될 때 버그가 생길 수 있어서 컬럼명 명시를 권장합니다.

## LIMIT & OFFSET

```sql
-- 첫 10명만
SELECT name FROM users LIMIT 10;

-- 11~20번째 (페이징)
SELECT name FROM users
ORDER BY id
LIMIT 10 OFFSET 10;
```

> **주의:** `OFFSET`이 클수록 쿼리가 느려집니다. OFFSET 10000이면 10,010개를 읽고 10,000개를 버립니다. 대용량 페이징은 커서 기반 방식(WHERE id > :last_id)이 훨씬 효율적입니다. 자세한 내용은 고급 섹션의 "쿼리 최적화" 챕터에서 다룹니다.

## 계산 컬럼

SELECT 절에서 바로 계산할 수 있습니다.

```sql
SELECT
  name,
  price,
  stock,
  price * stock AS inventory_value,    -- 재고 가치
  ROUND(price * 0.1, 0) AS vat,        -- 부가세
  CASE
    WHEN stock = 0 THEN '품절'
    WHEN stock < 10 THEN '재고 부족'
    ELSE '정상'
  END AS stock_status
FROM products;
```

## 실전 예제: 게시글 목록

```sql
SELECT
  p.id,
  p.title,
  u.name AS author_name,
  p.created_at,
  p.view_count
FROM   posts p
JOIN   users u ON u.id = p.user_id
WHERE  p.is_published = true
ORDER BY p.created_at DESC
LIMIT  20;
```

이 쿼리가 이해된다면 SELECT 기초를 마스터한 겁니다. 다음은 WHERE 조건을 더 깊이 다룹니다.
