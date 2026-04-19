---
title: "JOIN으로 테이블 합치기"
category: "SQL 기초"
order: 4
description: "INNER JOIN, LEFT JOIN, RIGHT JOIN의 차이와 실무 패턴"
---

## JOIN이란?

두 개 이상의 테이블을 연결해서 데이터를 조회하는 방법입니다. 관계형 데이터베이스의 핵심 기능이에요.

관계형 DB는 데이터를 여러 테이블에 나눠 저장합니다. 예를 들어 주문 정보는 `orders` 테이블에, 고객 이름은 `users` 테이블에 분리되어 있습니다. JOIN은 이 두 테이블을 `ON` 조건으로 연결해서 하나의 결과로 보여줍니다.

## INNER JOIN

두 테이블 모두에 매칭되는 행만 반환합니다. 한 쪽에만 있으면 결과에서 빠집니다.

```sql
SELECT
  o.id        AS order_id,
  u.name      AS user_name,
  o.total
FROM orders o
INNER JOIN users u ON u.id = o.user_id;
-- 또는 그냥 JOIN (기본값이 INNER JOIN)
```

주문이 있는 사용자만 나옵니다. 주문이 없는 사용자는 결과에서 빠져요. "양쪽에 모두 존재하는 데이터만"이라고 기억하세요.

## LEFT JOIN

왼쪽 테이블(FROM에 쓴 것) 전체 + 매칭되는 오른쪽 행을 반환합니다. 오른쪽에 매칭 없으면 NULL로 채워집니다.

```sql
-- 주문이 없는 사용자도 포함
SELECT
  u.name,
  COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
ORDER BY order_count DESC;
```

LEFT JOIN은 "왼쪽 테이블을 기준으로 오른쪽을 붙인다"고 생각하면 쉽습니다. 오른쪽이 없으면 NULL. 실무에서 "없는 것도 포함해서 보여줘"라는 요구사항은 거의 항상 LEFT JOIN입니다.

> **팁:** LEFT JOIN 후 `WHERE 오른쪽테이블.컬럼 IS NULL` 패턴으로 "왼쪽에만 있는 것"을 찾을 수 있습니다.
> ```sql
> -- 한 번도 주문하지 않은 사용자
> SELECT u.name FROM users u
> LEFT JOIN orders o ON o.user_id = u.id
> WHERE o.id IS NULL;
> ```

## RIGHT JOIN

LEFT JOIN의 반대. 실무에서는 거의 쓰지 않아요 — LEFT JOIN으로 테이블 순서만 바꾸면 동일합니다. 코드 일관성을 위해 항상 LEFT JOIN을 권장합니다.

## FULL OUTER JOIN

양쪽 모두 포함. 한쪽에만 있으면 다른 쪽은 NULL.

```sql
-- 양쪽 테이블의 모든 행 포함
SELECT a.name AS a_name, b.name AS b_name
FROM table_a a
FULL OUTER JOIN table_b b ON a.id = b.a_id;
```

FULL OUTER JOIN은 "두 테이블의 차이/교집합을 분석"할 때 주로 씁니다. 예를 들어 어제 데이터와 오늘 데이터를 비교해서 새로 생긴 것, 사라진 것을 찾을 때 유용합니다.

## CROSS JOIN

모든 조합을 만듭니다 (카테시안 곱). 의도적으로 사용할 때는 유용하지만, 실수로 ON 조건을 빠뜨리면 엄청난 결과가 나올 수 있습니다.

```sql
-- 의도적 사용: 달력 × 직원 조합
SELECT d.day, e.name
FROM generate_series('2024-01-01'::date, '2024-01-07'::date, '1 day') d(day)
CROSS JOIN employees e;
```

## SELF JOIN

같은 테이블을 두 번 참조하는 패턴. 계층 구조나 비교 쿼리에 씁니다.

```sql
-- 직원과 그 상사를 같은 테이블에서 조회
SELECT
  e.name      AS employee,
  m.name      AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;
```

## 여러 테이블 JOIN

```sql
SELECT
  o.id,
  u.name       AS customer,
  p.name       AS product,
  oi.quantity,
  oi.unit_price
FROM order_items oi
JOIN orders  o ON o.id         = oi.order_id
JOIN users   u ON u.id         = o.user_id
JOIN products p ON p.id        = oi.product_id
WHERE o.status = 'completed'
ORDER BY o.id;
```

여러 테이블을 JOIN할 때는 가장 중심이 되는 테이블(여기선 `order_items`)을 FROM에 두고 주변 테이블을 연결하는 방식이 읽기 쉽습니다.

## 자주 하는 실수

```sql
-- 1. ON 조건 누락 → 카테시안 곱 (모든 조합 = 위험!)
SELECT * FROM a JOIN b;  -- a행수 × b행수 결과!

-- 2. 애매한 컬럼명 참조
SELECT id FROM orders JOIN users ON ...;
-- 어느 테이블의 id인지 모호 → 테이블명 명시 필수
SELECT orders.id FROM orders JOIN users ON ...;

-- 3. LEFT JOIN 후 NULL 비교
SELECT * FROM a LEFT JOIN b ON a.id = b.a_id
WHERE b.id = NULL;   -- 틀림! NULL은 = 로 비교 불가
WHERE b.id IS NULL;  -- 맞음

-- 4. JOIN 후 집계 시 중복 카운트
-- users 1명이 orders 3개 → LEFT JOIN하면 3행
-- COUNT(u.id) → 3 이 나옴 (원하는 건 1)
-- 해결: COUNT(DISTINCT u.id) 또는 서브쿼리 분리
```

> **팁:** JOIN 성능은 ON 조건의 컬럼에 인덱스가 있는지에 크게 좌우됩니다. 외래 키 컬럼(`user_id`, `order_id` 등)에는 항상 인덱스를 만들어두세요. PostgreSQL은 PRIMARY KEY와 UNIQUE 제약에는 자동으로 인덱스를 만들지만, 외래 키에는 만들지 않습니다.
