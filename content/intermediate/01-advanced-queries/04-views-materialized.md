---
title: "뷰와 Materialized View"
category: "고급 쿼리"
order: 4
description: "복잡한 쿼리를 재사용하는 뷰, 성능을 위한 Materialized View"
---

## 뷰 (View)

복잡한 쿼리에 이름을 붙여서 테이블처럼 사용합니다. 실행 시마다 원본 쿼리를 수행합니다. 뷰는 데이터를 저장하지 않고, 쿼리의 저장본일 뿐입니다.

```sql
-- 뷰 생성
CREATE VIEW active_user_orders AS
SELECT
  u.id         AS user_id,
  u.name       AS user_name,
  u.email,
  COUNT(o.id)  AS order_count,
  SUM(o.total) AS total_spent
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE u.deleted_at IS NULL
  AND o.status = 'completed'
GROUP BY u.id, u.name, u.email;

-- 테이블처럼 사용
SELECT * FROM active_user_orders WHERE order_count >= 3;
SELECT user_name, total_spent FROM active_user_orders ORDER BY total_spent DESC LIMIT 10;

-- 뷰 수정
CREATE OR REPLACE VIEW active_user_orders AS ...;  -- 전체 재정의

-- 뷰 삭제
DROP VIEW active_user_orders;
DROP VIEW IF EXISTS active_user_orders;
```

### 뷰 장점

- **추상화:** 복잡한 JOIN/집계를 숨겨서 사용자가 단순한 인터페이스로 접근
- **보안:** 민감한 컬럼을 제외한 뷰만 노출
- **중앙화:** 반복 쿼리 로직을 한 곳에서 관리. 테이블 구조가 바뀌어도 뷰만 수정

```sql
-- 권한 제한 뷰: 민감 정보 숨김
CREATE VIEW public_users AS
SELECT id, name, created_at FROM users;  -- email, phone 제외

GRANT SELECT ON public_users TO readonly_role;
-- readonly_role은 원본 users 테이블 접근 불가
```

### 뷰의 한계

뷰는 실행 시마다 쿼리를 수행하므로, 복잡한 집계가 있는 뷰를 자주 조회하면 매번 전체 계산이 일어납니다. 이럴 때 Materialized View를 쓰세요.

## Materialized View

쿼리 결과를 **실제 디스크에 저장**합니다. 조회가 매우 빠르지만 원본 데이터가 변경되어도 자동으로 갱신되지 않습니다.

```sql
-- 생성 (생성 시 즉시 데이터 채워짐)
CREATE MATERIALIZED VIEW monthly_revenue AS
SELECT
  DATE_TRUNC('month', ordered_at) AS month,
  SUM(total)                       AS revenue,
  COUNT(*)                         AS order_count,
  ROUND(AVG(total), 0)             AS avg_order
FROM orders
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', ordered_at)
ORDER BY month;

-- 인덱스도 생성 가능
CREATE INDEX ON monthly_revenue(month);

-- 조회 (일반 테이블처럼, 매우 빠름)
SELECT * FROM monthly_revenue WHERE month >= '2024-01-01';

-- 갱신 (새 데이터 반영) — 잠금 발생, 갱신 중 조회 불가
REFRESH MATERIALIZED VIEW monthly_revenue;

-- 잠금 없이 갱신 (조회 가능하지만 UNIQUE INDEX 필요)
CREATE UNIQUE INDEX ON monthly_revenue(month);
REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;
```

> **CONCURRENTLY 사용 조건:** `REFRESH MATERIALIZED VIEW CONCURRENTLY`는 Materialized View에 UNIQUE INDEX가 반드시 있어야 합니다. 없으면 에러가 발생합니다.

## 자동 갱신 패턴

Materialized View는 수동으로 갱신해야 하므로, 갱신 시점을 언제로 할지 전략이 필요합니다.

```sql
-- 패턴 1: 새벽 스케줄러로 일괄 갱신
-- cron: 0 2 * * * psql -c "REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;"

-- 패턴 2: pg_cron 확장으로 DB 안에서 스케줄링 (PostgreSQL 10+)
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'refresh-monthly-revenue',
  '0 2 * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue'
);

-- 패턴 3: 트리거로 변경 시마다 갱신 (단, 빈번한 INSERT/UPDATE면 성능 저하)
CREATE OR REPLACE FUNCTION refresh_monthly_revenue()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_monthly_revenue
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH STATEMENT EXECUTE FUNCTION refresh_monthly_revenue();
```

## 언제 뭘 쓸까?

| 상황 | 선택 |
|---|---|
| 실시간 데이터, 단순 쿼리 재사용 | 뷰 (View) |
| 실시간 데이터, 복잡한 집계 | 뷰 (View) + 원본 테이블 최적화 |
| 약간의 지연 허용, 조회 속도 중요 | Materialized View |
| 보고서/대시보드 (일 배치) | Materialized View + 새벽 REFRESH |
| 보안 레이어 (컬럼 숨김) | 뷰 (View) + GRANT |

> **실무 팁:** 대시보드나 주기적 보고서용 쿼리가 느리다면 Materialized View가 가장 효과적인 해결책입니다. 새벽 배치로 갱신하고 낮 동안 조회하는 패턴은 분석 서비스에서 매우 일반적입니다.
