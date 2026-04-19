---
title: "수학 함수와 연산자"
category: "SQL 기초"
order: 11
description: "PostgreSQL에서 숫자를 다루는 산술 연산자와 수학 함수를 예제와 함께 익힙니다."
---

## 기본 산술 연산자

```sql
SELECT
    10 + 3  AS addition,       -- 13
    10 - 3  AS subtraction,    -- 7
    10 * 3  AS multiplication, -- 30
    10 / 3  AS division,       -- 3  (정수 나눗셈!)
    10.0/3  AS float_division, -- 3.333...
    10 % 3  AS modulo,         -- 1 (나머지)
    2 ^ 10  AS power;          -- 1024
```

> 두 정수를 나누면 결과도 정수입니다. 소수점 결과가 필요하면 하나를 `NUMERIC`이나 `FLOAT`로 캐스팅하세요: `10::numeric / 3`

## 반올림 함수

```sql
SELECT
    ROUND(3.14159, 2),    -- 3.14
    ROUND(3.5),           -- 4   (반올림)
    CEIL(3.1),            -- 4   (올림)
    FLOOR(3.9),           -- 3   (내림)
    TRUNC(3.9999, 2);     -- 3.99 (절사)
```

## 절댓값과 부호

```sql
SELECT
    ABS(-42),             -- 42
    SIGN(-10),            -- -1
    SIGN(0),              -- 0
    SIGN(10);             -- 1
```

## 최솟값·최댓값 (행 내부)

```sql
-- 집계함수 MIN/MAX와 다름 — 같은 행의 여러 열 비교
SELECT
    LEAST(10, 20, 5, 15),    -- 5
    GREATEST(10, 20, 5, 15); -- 20
```

## 수학 함수

```sql
SELECT
    SQRT(144),            -- 12 (제곱근)
    POWER(2, 8),          -- 256
    LOG(100),             -- 2 (log₁₀)
    LN(2.718),            -- ~1 (자연로그)
    EXP(1),               -- 2.718... (e의 거듭제곱)
    PI();                 -- 3.14159265...
```

## 실전 예제

```sql
-- 할인 가격 계산
SELECT
    product_name,
    price,
    discount_rate,
    ROUND(price * (1 - discount_rate / 100.0), 0) AS discounted_price
FROM products;

-- 페이지네이션 — 전체 페이지 수 계산
SELECT CEIL(COUNT(*)::numeric / 20) AS total_pages
FROM articles;

-- 통계 — 표준편차와 분산
SELECT
    AVG(score)               AS mean,
    STDDEV(score)            AS std_dev,
    VARIANCE(score)          AS variance,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY score) AS median
FROM exam_results;
```

## 난수 생성

```sql
SELECT RANDOM();              -- 0 이상 1 미만 실수
SELECT FLOOR(RANDOM() * 100) + 1;  -- 1~100 사이 정수
```

## 타입 캐스팅

```sql
SELECT
    '3.14'::numeric,          -- 문자열 → 숫자
    42::text,                 -- 숫자 → 문자열
    CAST(price AS INT)        -- 표준 SQL 방식
FROM products;
```
