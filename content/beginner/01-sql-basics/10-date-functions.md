---
title: "날짜와 시간 함수"
category: "SQL 기초"
order: 10
description: "PostgreSQL에서 날짜·시간 데이터를 다루는 핵심 함수와 연산을 배웁니다."
---

## 날짜·시간 타입

| 타입 | 설명 | 예시 |
|------|------|------|
| `DATE` | 날짜만 | `2024-01-15` |
| `TIME` | 시간만 | `14:30:00` |
| `TIMESTAMP` | 날짜 + 시간 | `2024-01-15 14:30:00` |
| `TIMESTAMPTZ` | 타임존 포함 | `2024-01-15 14:30:00+09` |
| `INTERVAL` | 기간 | `3 days`, `2 hours` |

## 현재 날짜·시간

```sql
SELECT
    CURRENT_DATE,        -- 2024-01-15
    CURRENT_TIME,        -- 14:30:00.123456+09
    CURRENT_TIMESTAMP,   -- 2024-01-15 14:30:00.123456+09
    NOW();               -- CURRENT_TIMESTAMP와 동일
```

## 날짜 연산

```sql
-- 날짜 더하기·빼기
SELECT
    CURRENT_DATE + 7               AS week_later,    -- 7일 후
    CURRENT_DATE - INTERVAL '1 month' AS month_ago,  -- 1개월 전
    '2024-12-31'::date - CURRENT_DATE AS days_until_year_end;
```

```sql
-- 두 날짜의 차이
SELECT
    AGE('2024-12-31', '2024-01-01') AS age_interval,  -- 11 mons 30 days
    '2024-12-31'::date - '2024-01-01'::date AS days_diff; -- 365
```

## 날짜 구성 요소 추출

```sql
SELECT
    EXTRACT(YEAR  FROM CURRENT_DATE) AS year,
    EXTRACT(MONTH FROM CURRENT_DATE) AS month,
    EXTRACT(DAY   FROM CURRENT_DATE) AS day,
    EXTRACT(DOW   FROM CURRENT_DATE) AS day_of_week, -- 0=일 ~ 6=토
    EXTRACT(WEEK  FROM CURRENT_DATE) AS week_number;
```

> `DATE_PART('month', ts)` 는 `EXTRACT(MONTH FROM ts)` 와 동일합니다.

## 날짜 절사 — DATE_TRUNC

```sql
SELECT
    DATE_TRUNC('month', CURRENT_TIMESTAMP),  -- 이번 달 1일 00:00:00
    DATE_TRUNC('year',  CURRENT_TIMESTAMP),  -- 올해 1월 1일 00:00:00
    DATE_TRUNC('hour',  CURRENT_TIMESTAMP);  -- 현재 시간의 정각
```

## 날짜 포맷팅

```sql
SELECT
    TO_CHAR(CURRENT_DATE, 'YYYY년 MM월 DD일'),  -- '2024년 01월 15일'
    TO_CHAR(NOW(), 'HH24:MI:SS'),               -- '14:30:00'
    TO_DATE('20240115', 'YYYYMMDD');            -- 2024-01-15
```

## 실전 예제

```sql
-- 이번 달 가입한 사용자
SELECT * FROM users
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
  AND created_at <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

-- 30일 이내 만료되는 구독
SELECT user_id, expires_at
FROM subscriptions
WHERE expires_at BETWEEN CURRENT_DATE AND CURRENT_DATE + 30;

-- 요일별 주문 수
SELECT
    TO_CHAR(ordered_at, 'Day') AS weekday,
    COUNT(*) AS order_count
FROM orders
GROUP BY EXTRACT(DOW FROM ordered_at), TO_CHAR(ordered_at, 'Day')
ORDER BY EXTRACT(DOW FROM ordered_at);
```
