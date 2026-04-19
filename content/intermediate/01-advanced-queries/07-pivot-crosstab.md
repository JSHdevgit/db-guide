---
title: "피벗 테이블과 CROSSTAB"
category: "고급 쿼리"
order: 7
description: "행 데이터를 열로 변환하는 피벗 기법과 tablefunc 확장의 crosstab 함수를 배웁니다."
---

## 피벗이란?

피벗은 행 데이터를 열로 변환하는 기법입니다. 보고서나 집계 데이터를 보기 좋게 변환할 때 유용합니다.

```
-- 원본 (행 형태)          -- 피벗 결과 (열 형태)
month  | category | sales    month | 식품 | 전자 | 의류
-------|----------|------   ------|------|------|-----
1월    | 식품     | 500      1월  | 500  | 300  | 200
1월    | 전자     | 300      2월  | 400  | 600  | 350
1월    | 의류     | 200
```

## CASE WHEN으로 수동 피벗

가장 범용적인 방법입니다.

```sql
SELECT
    TO_CHAR(sale_date, 'YYYY-MM') AS month,
    SUM(CASE WHEN category = '식품' THEN amount ELSE 0 END) AS 식품,
    SUM(CASE WHEN category = '전자' THEN amount ELSE 0 END) AS 전자,
    SUM(CASE WHEN category = '의류' THEN amount ELSE 0 END) AS 의류
FROM sales
GROUP BY TO_CHAR(sale_date, 'YYYY-MM')
ORDER BY month;
```

## tablefunc 확장 — CROSSTAB

카테고리가 많을 때는 `crosstab()`이 더 간결합니다.

```sql
-- 확장 설치 (최초 1회)
CREATE EXTENSION IF NOT EXISTS tablefunc;

SELECT * FROM crosstab(
    -- 데이터 쿼리 (row_name, category, value 순서)
    $$SELECT
        TO_CHAR(sale_date, 'YYYY-MM') AS month,
        category,
        SUM(amount)::INT
      FROM sales
      GROUP BY 1, 2
      ORDER BY 1, 2$$,
    -- 카테고리 목록
    $$SELECT DISTINCT category FROM sales ORDER BY 1$$
) AS ct(month TEXT, 식품 INT, 의류 INT, 전자 INT);
```

> `crosstab()`은 카테고리 순서가 두 번째 인자와 정확히 일치해야 합니다. 순서가 다르면 잘못된 결과가 나옵니다.

## 역피벗 — 열을 행으로 변환

```sql
-- 여러 열을 행으로 변환 (values unnest 활용)
SELECT
    year,
    unnest(ARRAY['Q1', 'Q2', 'Q3', 'Q4'])  AS quarter,
    unnest(ARRAY[q1_sales, q2_sales, q3_sales, q4_sales]) AS sales
FROM quarterly_report;
```

## 누적 합계와 함께 사용

```sql
-- 월별 카테고리 매출 및 누계
WITH monthly AS (
    SELECT
        TO_CHAR(sale_date, 'YYYY-MM') AS month,
        category,
        SUM(amount) AS monthly_sales
    FROM sales
    GROUP BY 1, 2
)
SELECT
    month,
    category,
    monthly_sales,
    SUM(monthly_sales) OVER (
        PARTITION BY category
        ORDER BY month
    ) AS cumulative_sales
FROM monthly
ORDER BY category, month;
```

## 주의사항

| 항목 | 설명 |
|------|------|
| 동적 열 | SQL은 실행 전 열 이름을 알아야 함 → 동적 피벗은 앱 레이어에서 처리 권장 |
| 성능 | 데이터가 많으면 CTE로 먼저 집계 후 피벗 |
| NULL 처리 | `COALESCE(값, 0)`으로 NULL을 0으로 치환 |
