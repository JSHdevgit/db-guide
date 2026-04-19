---
title: "쿼리 최적화 실전"
category: "성능 튜닝"
order: 3
description: "느린 쿼리를 찾고 고치는 실전 패턴 — N+1, 페이징, 집계 최적화"
---

## pg_stat_statements로 느린 쿼리 찾기

최적화는 추측이 아닌 **측정**에서 시작합니다. `pg_stat_statements`는 실행된 모든 쿼리의 통계를 누적합니다.

```sql
-- 익스텐션 활성화 (postgresql.conf에 추가 후 재시작)
-- shared_preload_libraries = 'pg_stat_statements'
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 평균 실행 시간 기준 TOP 20
SELECT
  LEFT(query, 100)  AS query_sample,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND(total_exec_time::numeric / 1000, 2) AS total_sec,
  ROUND(stddev_exec_time::numeric, 2) AS stddev_ms  -- 편차가 크면 불안정
FROM pg_stat_statements
WHERE calls > 100  -- 자주 실행되는 것만
ORDER BY total_exec_time DESC  -- 총 소요 시간 기준
LIMIT 20;

-- 통계 초기화
SELECT pg_stat_statements_reset();
```

> **팁:** `mean_exec_time`(평균 시간)만 보지 말고 `total_exec_time`(총 소요 시간)도 확인하세요. 1ms짜리 쿼리가 10만 번 실행되면 총 100초입니다. 빠르지만 자주 실행되는 쿼리를 개선하는 것이 더 효과적일 수 있습니다.

## N+1 쿼리 문제

ORM을 쓸 때 가장 흔하게 발생하는 성능 문제입니다. N개 행을 가져오고 각각에 대해 추가 쿼리를 보내서 총 N+1번 쿼리가 실행됩니다.

```sql
-- 나쁜 패턴 (ORM에서 자주 발생)
-- 1번:  SELECT * FROM orders LIMIT 100
-- 100번: SELECT * FROM users WHERE id = ? (각 order마다)
-- → 총 101번 쿼리

-- 해결: JOIN으로 한번에
SELECT
  o.id, o.total, o.created_at,
  u.id AS user_id, u.name, u.email
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY o.created_at DESC
LIMIT 100;
-- → 1번 쿼리

-- ORM에서는 "Eager Loading" 또는 "preload"로 해결
-- Rails: Order.includes(:user).limit(100)
-- Django: Order.objects.select_related('user')[:100]
```

## 페이징 최적화

```sql
-- 나쁜 방법: OFFSET이 클수록 느려짐
SELECT * FROM orders ORDER BY id DESC LIMIT 20 OFFSET 10000;
-- → 10,020개 행을 읽고 처음 10,000개를 버림
-- OFFSET 100만이면 백만 개 읽고 버림

-- 좋은 방법: Keyset Pagination (커서 기반)
-- 클라이언트가 마지막으로 받은 id를 기억했다가 전달
SELECT * FROM orders
WHERE id < :last_seen_id
ORDER BY id DESC
LIMIT 20;
-- → 인덱스로 바로 위치를 찾아서 20개만 읽음

-- 복합 정렬 커서
SELECT * FROM posts
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20;
```

> **OFFSET의 한계:** OFFSET 기반 페이징은 구현이 간단하지만 페이지 번호가 클수록 기하급수적으로 느려집니다. 사용자가 "1000페이지"로 직접 이동하는 경우가 없다면 커서 기반으로 전환하세요. "더 보기" 버튼이나 무한 스크롤 UI는 커서 기반에 완벽히 어울립니다.

## 집계 쿼리 최적화

```sql
-- 느린 COUNT(DISTINCT): 전체 스캔 필요
SELECT COUNT(DISTINCT user_id) FROM events;

-- 빠른 근사값: pg_extension 없이도 가능
-- 큰 테이블의 전체 행 수 근사치
SELECT reltuples::BIGINT AS approx_count
FROM pg_class WHERE relname = 'events';

-- 정확한 count + Index Only Scan
CREATE INDEX idx_orders_status ON orders(id) WHERE status = 'completed';
SELECT COUNT(*) FROM orders WHERE status = 'completed';
-- Index Only Scan으로 처리, 테이블 읽기 없음

-- 자주 필요한 집계는 Materialized View로 미리 계산
CREATE MATERIALIZED VIEW user_order_stats AS
SELECT
  user_id,
  COUNT(*) AS order_count,
  SUM(total) AS total_spent
FROM orders GROUP BY user_id;
```

## 서브쿼리 vs JOIN 성능

```sql
-- 서브쿼리: 각 행마다 실행될 수 있음 (상관 서브쿼리)
SELECT name
FROM users u
WHERE (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) > 5;
-- 사용자 수만큼 COUNT 쿼리 실행 → 느림

-- JOIN + HAVING: 더 효율적
SELECT u.name
FROM users u
JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
HAVING COUNT(*) > 5;

-- 또는 EXISTS (조건만 확인, 집계 없음)
SELECT name FROM users u
WHERE EXISTS (
  SELECT 1 FROM orders o WHERE o.user_id = u.id
  HAVING COUNT(*) > 5
);
```

## LATERAL JOIN 활용

각 행에 대해 서브쿼리를 실행하되 이전 테이블을 참조할 수 있습니다.

```sql
-- 각 카테고리의 베스트셀러 3개
SELECT c.name AS category, p.*
FROM categories c
CROSS JOIN LATERAL (
  SELECT id, name, price, sales_count
  FROM products
  WHERE category_id = c.id
  ORDER BY sales_count DESC
  LIMIT 3
) p;
-- 카테고리별로 TOP 3을 가져옴 (Window 함수보다 간결)
```

## 배치 처리 패턴

대량 데이터 처리는 한 번에 하지 말고 작은 청크로 나눠서 처리합니다. Lock 점유 시간을 최소화하고 부하를 분산시킵니다.

```sql
-- 배치 삭제 패턴
DO $$
DECLARE
  batch_size INT := 1000;
  deleted    INT;
BEGIN
  LOOP
    DELETE FROM old_logs
    WHERE id IN (
      SELECT id FROM old_logs
      WHERE created_at < NOW() - INTERVAL '1 year'
      LIMIT batch_size
    );
    GET DIAGNOSTICS deleted = ROW_COUNT;
    EXIT WHEN deleted < batch_size;
    PERFORM pg_sleep(0.1); -- 0.1초 쉬어서 다른 쿼리에 양보
  END LOOP;
  RAISE NOTICE '삭제 완료';
END $$;

-- 배치 업데이트 패턴
DO $$
DECLARE
  last_id BIGINT := 0;
  max_id  BIGINT;
  batch_size INT := 5000;
BEGIN
  SELECT MAX(id) INTO max_id FROM large_table;
  WHILE last_id < max_id LOOP
    UPDATE large_table
    SET processed = true
    WHERE id > last_id AND id <= last_id + batch_size
      AND processed = false;
    last_id := last_id + batch_size;
    PERFORM pg_sleep(0.05);
  END LOOP;
END $$;
```

## 통계 정보 수동 갱신

쿼리 플래너는 테이블 통계를 기반으로 실행 계획을 세웁니다. 통계가 오래되면 잘못된 계획이 선택될 수 있습니다.

```sql
-- 통계 갱신
ANALYZE orders;
ANALYZE VERBOSE orders;  -- 상세 출력

-- 샘플링 비율 높이기 (기본값 100, 최대 10000)
ALTER TABLE orders ALTER COLUMN user_id SET STATISTICS 500;
ANALYZE orders;  -- 더 정밀한 통계 수집

-- 특정 테이블 빠른 변화 시 Autovacuum 트리거 조정
ALTER TABLE events SET (
  autovacuum_analyze_scale_factor = 0.01,  -- 1% 변경 시 분석 (기본 20%)
  autovacuum_analyze_threshold = 1000
);
```

> **플래너 힌트:** PostgreSQL은 Oracle/MySQL과 달리 힌트(hint)를 공식 지원하지 않습니다. 잘못된 계획이 나온다면 통계 갱신, `work_mem` 조정, 또는 쿼리 재작성으로 접근하세요. `pg_hint_plan` 확장을 설치하면 힌트 사용이 가능하지만, 근본 원인을 찾는 것이 더 좋습니다.
