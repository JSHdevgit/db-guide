---
title: "GROUP BY와 HAVING으로 데이터 그룹화"
category: "SQL 기초"
order: 7
description: "GROUP BY로 데이터를 묶고 HAVING으로 그룹 조건을 필터링하는 방법을 익힙니다."
---

## GROUP BY란?

`GROUP BY`는 동일한 값을 가진 행들을 하나의 그룹으로 묶어 집계 함수와 함께 사용합니다.

```sql
SELECT department, COUNT(*) AS employee_count
FROM employees
GROUP BY department;
```

| department | employee_count |
|------------|---------------|
| 개발        | 12            |
| 마케팅      | 5             |
| 영업        | 8             |

## 여러 열로 그룹화

```sql
SELECT department, job_title, AVG(salary) AS avg_salary
FROM employees
GROUP BY department, job_title
ORDER BY department, avg_salary DESC;
```

> GROUP BY에 나열된 열만 SELECT에서 직접 사용할 수 있습니다. 나머지는 집계 함수로 감싸야 합니다.

## HAVING — 그룹 필터링

`WHERE`는 행을 필터링하고, `HAVING`은 **그룹화된 결과**를 필터링합니다.

```sql
-- 직원이 5명 이상인 부서만 조회
SELECT department, COUNT(*) AS cnt
FROM employees
GROUP BY department
HAVING COUNT(*) >= 5;
```

## WHERE vs HAVING 차이

| 구분   | WHERE                  | HAVING                   |
|--------|------------------------|--------------------------|
| 시점   | 그룹화 이전             | 그룹화 이후               |
| 대상   | 개별 행                | 그룹                      |
| 집계함수 사용 | 불가                | 가능                      |

```sql
-- 함께 쓰기: 2023년 데이터 중 합계가 100만 원 초과인 부서
SELECT department, SUM(sales) AS total_sales
FROM orders
WHERE order_date >= '2023-01-01'
GROUP BY department
HAVING SUM(sales) > 1000000
ORDER BY total_sales DESC;
```

## 실행 순서

SQL 쿼리는 작성 순서와 실행 순서가 다릅니다.

```
FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT
```

> HAVING 절에서는 SELECT 별칭(alias)을 사용할 수 없습니다. PostgreSQL은 일부 허용하지만 표준 SQL에서는 집계 함수 자체를 다시 써야 합니다.

## 연습 쿼리

```sql
-- 카테고리별 상품 수와 평균 가격 (평균 가격 5만 원 이상만)
SELECT
    category,
    COUNT(*)        AS product_count,
    AVG(price)::int AS avg_price
FROM products
GROUP BY category
HAVING AVG(price) >= 50000
ORDER BY avg_price DESC;
```
