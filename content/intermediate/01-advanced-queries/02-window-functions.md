---
title: "Window 함수"
category: "고급 쿼리"
order: 2
description: "OVER(), PARTITION BY, ROW_NUMBER, RANK, LAG/LEAD"
---

## Window 함수란?

일반 집계(`GROUP BY`)는 여러 행을 하나로 합쳐버립니다. Window 함수는 **행을 유지하면서** 집계 계산 결과를 각 행에 추가합니다. "각 직원의 급여 + 그 직원이 속한 부서의 평균 급여"처럼, 개별 행과 그룹 집계를 동시에 보고 싶을 때 씁니다.

```sql
-- 일반 집계: 부서당 1행만 남음
SELECT department_id, AVG(salary)
FROM employees
GROUP BY department_id;

-- Window 함수: 모든 행이 유지되면서 부서 평균 추가
SELECT
  name,
  salary,
  department_id,
  AVG(salary) OVER (PARTITION BY department_id) AS dept_avg,
  salary - AVG(salary) OVER (PARTITION BY department_id) AS diff_from_avg
FROM employees;
```

`OVER()` 안이 비어있으면 전체 결과에 대해 계산하고, `PARTITION BY`를 쓰면 파티션 단위로 계산합니다.

## PARTITION BY & ORDER BY

```sql
SELECT
  name,
  salary,
  department_id,
  -- 부서 내 급여 순위
  RANK() OVER (
    PARTITION BY department_id
    ORDER BY salary DESC
  ) AS dept_rank,
  -- 전체 급여 순위
  RANK() OVER (ORDER BY salary DESC) AS overall_rank,
  -- 부서 내 급여 백분위 (0.0 ~ 1.0)
  PERCENT_RANK() OVER (
    PARTITION BY department_id
    ORDER BY salary
  ) AS salary_pct_rank
FROM employees;
```

## 순위 함수

동점 처리 방식이 다른 세 가지 순위 함수입니다.

```sql
SELECT name, score,
  ROW_NUMBER() OVER (ORDER BY score DESC),  -- 1,2,3,4... (항상 고유한 순위)
  RANK()       OVER (ORDER BY score DESC),  -- 1,1,3,4... (동점 시 같은 순위, 다음 순위 건너뜀)
  DENSE_RANK() OVER (ORDER BY score DESC)   -- 1,1,2,3... (동점 시 같은 순위, 순위 건너뜀 없음)
FROM exam_results;
```

| 함수 | 100,100,90 일 때 |
|---|---|
| ROW_NUMBER | 1, 2, 3 |
| RANK | 1, 1, 3 |
| DENSE_RANK | 1, 1, 2 |

> **실무 팁:** 같은 점수에 같은 순위를 줘야 한다면 `RANK`나 `DENSE_RANK`를 쓰고, "무조건 N등까지 뽑아야 한다"면 `ROW_NUMBER`를 쓰세요.

## LAG / LEAD (이전/다음 행 참조)

행 간 차이를 계산할 때 필수입니다. 전날 대비 성장률, 이전 이벤트와의 시간 차이 등에 씁니다.

```sql
SELECT
  ordered_at::DATE AS day,
  SUM(total)       AS revenue,
  LAG(SUM(total)) OVER (ORDER BY ordered_at::DATE) AS prev_revenue,
  LEAD(SUM(total)) OVER (ORDER BY ordered_at::DATE) AS next_revenue,
  ROUND(
    (SUM(total) - LAG(SUM(total)) OVER (ORDER BY ordered_at::DATE))
    / NULLIF(LAG(SUM(total)) OVER (ORDER BY ordered_at::DATE), 0) * 100,
    1
  ) AS growth_pct
FROM orders
GROUP BY ordered_at::DATE
ORDER BY day;
```

`LAG(컬럼, N, 기본값)` — N행 앞. 기본값은 첫 행처럼 이전이 없을 때 반환할 값입니다.

## FIRST_VALUE / LAST_VALUE / NTH_VALUE

파티션 내의 특정 위치 값을 가져옵니다.

```sql
SELECT
  name,
  salary,
  department_id,
  FIRST_VALUE(salary) OVER (
    PARTITION BY department_id
    ORDER BY salary DESC
  ) AS highest_in_dept,
  -- LAST_VALUE는 기본 프레임이 현재 행까지이므로 주의
  LAST_VALUE(salary) OVER (
    PARTITION BY department_id
    ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
  ) AS lowest_in_dept
FROM employees;
```

> **LAST_VALUE 주의:** `LAST_VALUE`의 기본 프레임은 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`입니다. 즉, 현재 행까지만 보므로 파티션 전체의 마지막 값을 원한다면 반드시 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`을 명시해야 합니다.

## 누적 합계 (Running Total)

```sql
SELECT
  ordered_at::DATE AS day,
  SUM(total) AS daily_revenue,
  SUM(SUM(total)) OVER (
    ORDER BY ordered_at::DATE
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS cumulative_revenue
FROM orders
GROUP BY ordered_at::DATE
ORDER BY day;
```

## NTILE — 분위수 나누기

전체 결과를 N개의 동일한 크기 그룹으로 나눕니다.

```sql
-- 고객을 구매금액 기준 4분위로 나누기
SELECT
  user_id,
  total_spent,
  NTILE(4) OVER (ORDER BY total_spent DESC) AS quartile
  -- 1: 상위 25%, 2: 25~50%, 3: 50~75%, 4: 하위 25%
FROM (
  SELECT user_id, SUM(total) AS total_spent
  FROM orders GROUP BY user_id
) t;
```

## Window 함수 프레임

`ROWS BETWEEN`으로 집계에 포함할 행 범위를 지정합니다.

```sql
-- 최근 7일 이동 평균
SELECT
  day,
  revenue,
  AVG(revenue) OVER (
    ORDER BY day
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS moving_avg_7d
FROM daily_revenue;

-- ROWS vs RANGE:
-- ROWS: 물리적 행 수
-- RANGE: 값의 범위 (같은 값끼리 묶임)
```

Window 함수는 한 번 익히면 보고서 쿼리, 분석 쿼리에서 반복적으로 쓰게 됩니다. 가장 실용적인 SQL 기능 중 하나입니다.
