---
title: "UNION과 집합 연산"
category: "고급 쿼리"
order: 5
description: "UNION, INTERSECT, EXCEPT로 여러 쿼리 결과를 합치거나 비교하는 방법을 배웁니다."
---

## 집합 연산이란?

두 개 이상의 `SELECT` 결과를 집합처럼 합치거나 교차·차집합 연산을 수행합니다. 열 수와 타입이 일치해야 합니다.

## UNION — 합집합

```sql
-- 중복 제거 (느림)
SELECT user_id FROM orders_2023
UNION
SELECT user_id FROM orders_2024;

-- 중복 포함 (빠름) — 대부분의 경우 UNION ALL 권장
SELECT user_id FROM orders_2023
UNION ALL
SELECT user_id FROM orders_2024;
```

> `UNION`은 내부적으로 중복 제거를 위해 정렬을 수행합니다. 중복이 없거나 중복이 괜찮다면 `UNION ALL`이 훨씬 빠릅니다.

## INTERSECT — 교집합

두 결과 모두에 있는 행만 반환합니다.

```sql
-- 2023년과 2024년 모두 주문한 고객
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2023
INTERSECT
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2024;
```

## EXCEPT — 차집합

첫 번째 결과에서 두 번째 결과에 있는 행을 제외합니다.

```sql
-- 2023년에 주문했지만 2024년에는 주문하지 않은 고객 (이탈 고객)
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2023
EXCEPT
SELECT customer_id FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2024;
```

## 열 이름과 ORDER BY

```sql
-- 열 이름은 첫 번째 SELECT 기준
SELECT id, name, 'employee' AS source FROM employees
UNION ALL
SELECT id, name, 'contractor'         FROM contractors
ORDER BY name;  -- 마지막에 한 번만 작성
```

## 실전 예제 — 다중 소스 통합

```sql
-- 전체 활동 로그 통합 (여러 테이블 병합)
SELECT 'purchase' AS event_type, user_id, created_at FROM purchases
UNION ALL
SELECT 'review',                 user_id, created_at FROM reviews
UNION ALL
SELECT 'login',                  user_id, created_at FROM login_logs
ORDER BY created_at DESC
LIMIT 100;
```

```sql
-- 결측 데이터 찾기: products 테이블에 있지만 prices 테이블에 없는 상품
SELECT product_id FROM products
EXCEPT
SELECT product_id FROM prices;
```

## UNION vs JOIN 선택 기준

| 상황 | 선택 |
|------|------|
| 같은 구조의 다른 테이블 합치기 | UNION ALL |
| 같은 테이블의 다른 기간 합치기 | UNION ALL |
| 두 집합의 공통 원소 찾기 | INTERSECT |
| 한 집합에만 있는 원소 찾기 | EXCEPT 또는 LEFT JOIN + IS NULL |
| 관련 데이터를 열로 확장 | JOIN |
