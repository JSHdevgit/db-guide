---
title: "서브쿼리와 CTE"
category: "고급 쿼리"
order: 1
description: "서브쿼리와 WITH 절(CTE)로 복잡한 쿼리를 명확하게"
---

## 서브쿼리란?

쿼리 안에 또 다른 쿼리를 중첩하는 방식입니다. 복잡한 조건이나 중간 집계 결과를 하나의 쿼리로 표현할 때 씁니다.

```sql
-- 평균 주문금액보다 많이 주문한 고객
SELECT name, total_orders
FROM customers
WHERE total_orders > (
  SELECT AVG(total_orders) FROM customers
);
```

서브쿼리는 편리하지만 중첩이 깊어지면 읽기 어려워집니다. 복잡한 서브쿼리는 CTE로 리팩터링하는 것을 권장합니다.

## 서브쿼리의 종류

### 스칼라 서브쿼리 (단일 값 반환)

```sql
SELECT
  p.title,
  p.price,
  (SELECT AVG(price) FROM products) AS avg_price,
  p.price - (SELECT AVG(price) FROM products) AS diff_from_avg
FROM products p;
```

> **주의:** 스칼라 서브쿼리는 각 행마다 실행되므로, 상관 서브쿼리(바깥 쿼리를 참조)라면 성능에 주의하세요. 위 예시처럼 바깥을 참조하지 않는다면 PostgreSQL이 한 번만 실행하도록 최적화합니다.

### 인라인 뷰 (FROM 절 서브쿼리)

결과를 임시 테이블처럼 FROM에서 사용합니다.

```sql
SELECT dept_name, avg_salary
FROM (
  SELECT department_id, AVG(salary) AS avg_salary
  FROM employees
  GROUP BY department_id
) AS dept_stats
JOIN departments d ON d.id = dept_stats.department_id;
```

### EXISTS 서브쿼리

행의 존재 여부만 확인할 때 씁니다. 조건을 만족하는 행을 발견하면 즉시 중단하므로 IN보다 빠를 때가 많습니다.

```sql
-- 주문이 한 번이라도 있는 고객만
SELECT c.name
FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- 주문이 없는 고객 (NOT EXISTS)
SELECT c.name
FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

> **팁:** `NOT EXISTS`는 `NOT IN`보다 안전합니다. `NOT IN`은 서브쿼리 결과에 NULL이 있으면 항상 빈 결과를 반환하는 함정이 있지만, `NOT EXISTS`는 NULL에 영향받지 않습니다.

## CTE (Common Table Expression)

`WITH` 절로 이름 붙인 임시 쿼리입니다. 복잡한 쿼리를 단계별로 이름을 붙여 표현하므로 가독성이 크게 좋아집니다.

```sql
WITH
monthly_sales AS (
  SELECT
    DATE_TRUNC('month', ordered_at) AS month,
    SUM(total) AS revenue
  FROM orders
  WHERE status = 'completed'
  GROUP BY 1
),
growth AS (
  SELECT
    month,
    revenue,
    LAG(revenue) OVER (ORDER BY month) AS prev_revenue
  FROM monthly_sales
)
SELECT
  month,
  revenue,
  ROUND(
    (revenue - prev_revenue) / prev_revenue * 100, 2
  ) AS growth_rate
FROM growth
ORDER BY month;
```

CTE는 서브쿼리와 달리 이름으로 여러 번 참조할 수 있습니다. 같은 중간 결과를 두 번 사용해야 할 때 서브쿼리보다 CTE가 훨씬 효율적입니다.

> **CTE의 기본 동작:** PostgreSQL 12부터 CTE는 기본적으로 인라인(최적화됨)으로 처리됩니다. 결과를 반드시 구체화(materialize)하려면 `WITH MATERIALIZED cte_name AS (...)`를 명시하세요.

## 재귀 CTE

계층 구조(조직도, 카테고리 트리, 댓글 스레드)를 순회할 때 사용합니다. 일반적인 SQL로는 표현할 수 없는 반복 로직을 구현합니다.

```sql
WITH RECURSIVE category_tree AS (
  -- 앵커 쿼리: 최상위 카테고리 (재귀의 시작점)
  SELECT id, name, parent_id, 0 AS depth, ARRAY[id] AS path
  FROM categories
  WHERE parent_id IS NULL

  UNION ALL

  -- 재귀 쿼리: 이전 결과의 자식들을 추가
  SELECT c.id, c.name, c.parent_id, ct.depth + 1, ct.path || c.id
  FROM categories c
  JOIN category_tree ct ON ct.id = c.parent_id
  WHERE NOT c.id = ANY(ct.path)  -- 순환 방지
)
SELECT
  REPEAT('  ', depth) || name AS indented_name,
  depth
FROM category_tree
ORDER BY path;
```

> **성능 주의:** 재귀 CTE는 루프가 끊기지 않으면 무한 반복합니다. `NOT c.id = ANY(ct.path)` 같은 순환 방지 조건을 반드시 추가하세요. PostgreSQL 기본 최대 재귀 횟수는 100번(`max_recursion`). 실제 운영 데이터에 적용 전 꼭 테스트하세요.

## LATERAL — 상관 서브쿼리의 JOIN 버전

FROM 절에서 앞쪽 테이블을 참조할 수 있는 특별한 JOIN입니다.

```sql
-- 각 사용자의 최근 주문 3개
SELECT u.name, recent.*
FROM users u
CROSS JOIN LATERAL (
  SELECT id, total, ordered_at
  FROM orders o
  WHERE o.user_id = u.id
  ORDER BY ordered_at DESC
  LIMIT 3
) AS recent;
```

LATERAL은 "각 행마다 서브쿼리를 실행하되, 그 행의 값을 서브쿼리 안에서 참조"할 때 씁니다. 일반 서브쿼리에서는 `LIMIT`과 상관 조건을 함께 쓸 수 없는데, LATERAL은 가능합니다.
