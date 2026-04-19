---
title: "집계 함수와 GROUP BY"
category: "SQL 기초"
order: 5
description: "COUNT, SUM, AVG, GROUP BY, HAVING으로 데이터 요약하기"
---

## 집계 함수 기본

집계 함수는 여러 행을 하나의 값으로 요약합니다. 분석 쿼리의 핵심입니다.

```sql
SELECT
  COUNT(*)          AS total_rows,      -- 전체 행 수 (NULL 포함)
  COUNT(email)      AS non_null_emails, -- NULL 제외한 수
  COUNT(DISTINCT city) AS unique_cities,-- 중복 제외 고유 수
  SUM(total)        AS revenue,
  AVG(total)        AS avg_order,
  MAX(total)        AS max_order,
  MIN(total)        AS min_order
FROM orders
WHERE status = 'completed';
```

> **COUNT(*) vs COUNT(컬럼):** `COUNT(*)`는 NULL 포함 전체 행 수, `COUNT(컬럼)`은 NULL이 아닌 행 수입니다. 특정 컬럼의 입력 비율을 확인할 때 `COUNT(phone) / COUNT(*)::float`처럼 활용하세요.

## GROUP BY

컬럼 값으로 그룹을 나눠서 각 그룹에 집계를 적용합니다. GROUP BY에 쓴 컬럼은 반드시 SELECT에도 있어야 하고, SELECT에 있는 집계 함수가 아닌 컬럼은 반드시 GROUP BY에 있어야 합니다.

```sql
-- 월별 매출
SELECT
  DATE_TRUNC('month', ordered_at) AS month,
  COUNT(*)                         AS order_count,
  SUM(total)                       AS revenue,
  ROUND(AVG(total), 0)             AS avg_order
FROM orders
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', ordered_at)
ORDER BY month;
```

```sql
-- 카테고리별 상품 수와 평균 가격
SELECT
  category,
  COUNT(*)       AS product_count,
  AVG(price)     AS avg_price,
  MAX(price)     AS max_price
FROM products
GROUP BY category
ORDER BY avg_price DESC;
```

## HAVING — 그룹 필터링

WHERE는 개별 행을 필터링하고, HAVING은 **집계 후 그룹**을 필터링합니다.

```sql
-- 주문 3건 이상인 고객만
SELECT
  user_id,
  COUNT(*) AS order_count,
  SUM(total) AS total_spent
FROM orders
GROUP BY user_id
HAVING COUNT(*) >= 3
ORDER BY total_spent DESC;
```

> **규칙:** `WHERE`는 `GROUP BY` 전에 실행되므로 집계 함수를 쓸 수 없습니다. 집계 함수 조건은 반드시 `HAVING`에서 씁니다. 반대로, 집계 함수 없이 단순 필터는 `WHERE`에서 해야 성능이 좋습니다 — WHERE가 먼저 실행되어 GROUP BY에 들어가는 행 수를 줄여주기 때문입니다.

## 실행 순서

SQL은 작성 순서가 아닌 아래 순서로 실행됩니다:

```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

이걸 알면 여러 의문이 풀립니다:
- "왜 SELECT 별칭을 WHERE에서 못 쓰나?" → WHERE가 SELECT보다 먼저 실행
- "왜 집계 함수를 WHERE에서 못 쓰나?" → GROUP BY가 WHERE보다 나중에 실행
- "ORDER BY에서 별칭을 쓸 수 있는 이유" → ORDER BY가 SELECT 이후에 실행

## FILTER 절 — 조건부 집계

PostgreSQL에서 조건부로 집계할 때 FILTER를 사용합니다. CASE를 쓰는 것보다 간결합니다.

```sql
-- 상태별 주문 수를 한 줄에
SELECT
  COUNT(*)                                  AS total_orders,
  COUNT(*) FILTER (WHERE status = 'completed') AS completed,
  COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
FROM orders;

-- CASE로 동일하게 (더 장황함)
SELECT
  COUNT(*),
  COUNT(CASE WHEN status = 'completed' THEN 1 END) AS completed
FROM orders;
```

## 문자열 집계 (STRING_AGG)

행들을 하나의 문자열로 합칩니다.

```sql
-- 사용자별 구매 카테고리 목록
SELECT
  user_id,
  STRING_AGG(DISTINCT category, ', ' ORDER BY category) AS categories
FROM orders
JOIN order_items oi ON oi.order_id = orders.id
JOIN products p ON p.id = oi.product_id
GROUP BY user_id;
-- 결과: "electronics, furniture, sports"
```

## ROLLUP (소계 자동 생성)

```sql
-- 카테고리별 + 전체 합계 한번에
SELECT
  COALESCE(category, '전체') AS category,
  SUM(total) AS revenue
FROM orders
JOIN products ON products.id = orders.product_id
GROUP BY ROLLUP(category)
ORDER BY category NULLS LAST;
```

ROLLUP은 카테고리별 소계와 전체 합계를 한 쿼리에서 얻을 때 유용합니다. 리포트 쿼리에서 자주 씁니다.

> **실무 팁:** 대시보드나 분석 쿼리에서 GROUP BY + SUM이 자주 쓰인다면 Materialized View로 미리 집계 결과를 저장해두면 응답 시간을 크게 줄일 수 있습니다. 자세한 내용은 "뷰와 Materialized View" 챕터를 참고하세요.
