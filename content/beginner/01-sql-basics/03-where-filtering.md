---
title: "WHERE와 조건 필터링"
category: "SQL 기초"
order: 3
description: "WHERE 절의 다양한 연산자와 패턴 매칭"
---

## 비교 연산자

WHERE 절은 행을 필터링하는 조건을 작성하는 곳입니다. 조건이 `true`인 행만 결과에 포함됩니다.

```sql
SELECT * FROM products
WHERE price > 10000;          -- 초과
WHERE price >= 10000;         -- 이상
WHERE price < 50000;          -- 미만
WHERE price BETWEEN 10000 AND 50000;  -- 범위 (양 끝 포함)
WHERE category <> 'food';    -- 같지 않음 (!=도 동일)
```

> **팁:** `BETWEEN a AND b`는 `>= a AND <= b`와 완전히 동일합니다. 날짜 범위는 `BETWEEN`보다 `>= start AND < end` 형태가 더 명확합니다. 예를 들어 `BETWEEN '2024-01-01' AND '2024-12-31'`은 12월 31일 00:00:00까지만 포함하므로, `>= '2024-01-01' AND < '2025-01-01'`이 더 안전합니다.

## AND / OR / NOT

```sql
-- AND: 두 조건 모두 만족
SELECT * FROM orders
WHERE status = 'pending' AND total > 50000;

-- OR: 하나라도 만족
SELECT * FROM products
WHERE category = 'electronics' OR category = 'appliances';

-- IN: OR의 축약형 (값 목록 중 하나)
SELECT * FROM products
WHERE category IN ('electronics', 'appliances', 'furniture');

-- NOT IN
SELECT * FROM users
WHERE id NOT IN (1, 2, 3);
```

> **주의:** `NOT IN` 목록에 `NULL`이 포함되면 결과가 항상 빈 집합이 됩니다. `NOT IN (1, 2, NULL)`은 `<> 1 AND <> 2 AND <> NULL`인데, `<> NULL`은 항상 NULL(거짓)이기 때문입니다. 서브쿼리에서 `NOT IN`을 쓸 때는 `NOT EXISTS`가 더 안전합니다.

## 문자열 패턴 매칭 (LIKE / ILIKE)

```sql
-- 'kim'으로 시작하는 이름
SELECT * FROM users WHERE name LIKE 'kim%';

-- 이메일에 'gmail' 포함
SELECT * FROM users WHERE email LIKE '%gmail%';

-- 정확히 5글자인 코드
SELECT * FROM codes WHERE code LIKE '_____';

-- ILIKE: 대소문자 구분 없이 (PostgreSQL 전용)
SELECT * FROM users WHERE name ILIKE 'kim%';
```

> **주의:** `LIKE '%검색어%'` 패턴은 앞에 와일드카드가 있어 인덱스를 활용하기 어렵고 전체 테이블 스캔이 발생합니다. `LIKE '검색어%'`(앞 고정)는 인덱스 사용이 가능합니다. 본격적인 텍스트 검색이 필요하다면 PostgreSQL의 `pg_trgm` 확장이나 전문 검색 엔진을 고려하세요.

## NULL 처리

NULL은 "값이 없음"을 나타냅니다. NULL과의 비교는 항상 NULL(알 수 없음)을 반환하기 때문에 `= NULL`은 절대 쓰지 않습니다.

```sql
-- NULL인 행
SELECT * FROM users WHERE deleted_at IS NULL;

-- NULL이 아닌 행
SELECT * FROM users WHERE deleted_at IS NOT NULL;

-- 틀린 방법: 이건 항상 결과가 없음
-- WHERE deleted_at = NULL   ← 절대 쓰지 마세요

-- NULL을 기본값으로 대체: COALESCE
SELECT name, COALESCE(phone, '번호 없음') AS phone FROM users;

-- NULL을 0으로: NULLIF (0을 NULL로 반환)
SELECT total / NULLIF(count, 0) AS avg FROM stats;  -- 0으로 나누기 방지
```

> **팁:** `COALESCE(a, b, c)`는 왼쪽부터 첫 번째 NULL이 아닌 값을 반환합니다. `COALESCE(nickname, name, '익명')`처럼 폴백 체인을 만들 때 유용합니다.

## CASE 표현식

CASE는 SQL의 if-else입니다. SELECT 절, WHERE 절, ORDER BY 절 어디에서도 사용할 수 있습니다.

```sql
-- 단순 CASE (값 매핑)
SELECT
  name,
  CASE status
    WHEN 'pending'   THEN '처리 대기'
    WHEN 'completed' THEN '완료'
    WHEN 'cancelled' THEN '취소'
    ELSE '알 수 없음'
  END AS status_label
FROM orders;

-- 검색 CASE (범위/복잡한 조건)
SELECT
  name,
  CASE
    WHEN age < 20 THEN '10대'
    WHEN age < 30 THEN '20대'
    WHEN age < 40 THEN '30대'
    ELSE '40대 이상'
  END AS age_group
FROM users;

-- ORDER BY에서도 사용
SELECT name, status
FROM orders
ORDER BY
  CASE status
    WHEN 'urgent' THEN 1
    WHEN 'pending' THEN 2
    ELSE 3
  END;
```

## EXISTS와 NOT EXISTS

서브쿼리와 함께 쓰는 강력한 패턴입니다.

```sql
-- 주문이 있는 고객만 (IN보다 큰 테이블에서 빠를 수 있음)
SELECT name FROM customers c
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- 주문이 없는 고객
SELECT name FROM customers c
WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id
);
```

> **팁:** `EXISTS`는 조건을 만족하는 행이 하나라도 있으면 즉시 중단합니다. `IN`과 달리 NULL 이슈가 없고 대용량에서 더 예측 가능한 성능을 보입니다.
