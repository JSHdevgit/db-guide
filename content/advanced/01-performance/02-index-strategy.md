---
title: "인덱스 전략과 최적화"
category: "성능 튜닝"
order: 2
description: "사용되지 않는 인덱스 제거, Bloat 관리, GIN/GiST 활용"
---

## 인덱스 사용 현황 분석

인덱스를 만드는 것보다 **언제 필요한지, 불필요한 것은 없는지** 파악하는 것이 더 중요합니다.

```sql
-- 한 번도 사용되지 않은 인덱스 (삭제 후보)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan     AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

> **주의:** DB를 재시작하거나 `pg_stat_reset()`을 호출하면 통계가 초기화됩니다. 충분한 기간(최소 2~4주) 운영 후 측정하세요. 월 1회 실행되는 배치 쿼리가 쓰는 인덱스도 있습니다.

```sql
-- 많이 쓰이는 인덱스 TOP
SELECT
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;
```

## Bloat — 인덱스 부풀림

UPDATE/DELETE가 빈번하면 인덱스에 빈 공간이 쌓입니다. 물리적 파일 크기는 크지만 실제 데이터는 적은 상태를 Bloat(부풀림)이라고 합니다.

```sql
-- 인덱스 크기 확인
SELECT
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- 인덱스 재구성 (테이블 잠금 발생 — 운영 중 비권장)
REINDEX INDEX idx_orders_user_id;

-- 잠금 없이 재구성 (PostgreSQL 12+)
REINDEX INDEX CONCURRENTLY idx_orders_user_id;

-- 테이블 전체 인덱스 재구성
REINDEX TABLE CONCURRENTLY orders;
```

Autovacuum이 정상 동작하면 심각한 Bloat은 드뭅니다. Bloat이 반복적으로 발생한다면 Autovacuum 설정을 검토하세요.

## GIN 인덱스 — 배열/JSON/전문 검색

B-Tree가 하나의 값을 인덱싱하는 것과 달리, GIN(Generalized Inverted Index)은 하나의 값이 **여러 항목**을 포함할 때 각 항목을 별도로 인덱싱합니다.

```sql
-- 배열 검색
CREATE INDEX idx_posts_tags ON posts USING GIN (tags);
SELECT * FROM posts WHERE tags @> ARRAY['postgresql'];     -- 인덱스 사용
SELECT * FROM posts WHERE tags && ARRAY['sql', 'python'];  -- 인덱스 사용

-- JSONB
CREATE INDEX idx_events_payload ON events USING GIN (payload);
SELECT * FROM events WHERE payload @> '{"device": "mobile"}';  -- 인덱스 사용

-- 전문 검색 (Full-Text Search)
CREATE INDEX idx_articles_fts ON articles
  USING GIN (to_tsvector('english', title || ' ' || body));

SELECT * FROM articles
WHERE to_tsvector('english', title || ' ' || body)
   @@ to_tsquery('english', 'database & tuning');
```

> **GIN 인덱스 업데이트 비용:** GIN은 B-Tree보다 INSERT/UPDATE가 느립니다. 빈번하게 변경되는 JSONB 컬럼에 GIN을 쓸 때는 `gin_pending_list_limit`을 조정해서 비용을 분산시킬 수 있습니다.

## GiST 인덱스 — 지리/범위 데이터

```sql
-- PostGIS 지리 데이터
CREATE INDEX idx_locations_geo ON locations USING GiST (geom);
SELECT * FROM locations WHERE ST_DWithin(geom, ST_Point(126.9, 37.5), 1000);

-- 범위 타입 (겹침, 포함 검색)
CREATE INDEX idx_reservations_range ON reservations USING GiST (during);
-- during: tstzrange 타입
SELECT * FROM reservations WHERE during && '[2024-01-01, 2024-01-07)';

-- BRIN 인덱스 — 대용량 시계열
-- 물리적으로 정렬된 컬럼에 효과적 (로그, 이벤트 테이블)
-- 인덱스 크기가 B-Tree의 1/1000 수준
CREATE INDEX idx_events_time_brin ON events USING BRIN (occurred_at);
-- INSERT 순서 = 시간 순서인 테이블에서만 효과적
```

## pg_trgm — 부분 문자열 인덱스

`LIKE '%검색어%'`처럼 앞에 와일드카드가 있는 검색도 인덱스를 쓸 수 있게 합니다.

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_users_name_trgm ON users USING GIN (name gin_trgm_ops);

-- 이제 LIKE 앞 와일드카드도 인덱스 사용
SELECT * FROM users WHERE name LIKE '%철수%';
SELECT * FROM users WHERE name ILIKE '%chulsoo%';
```

## 인덱스 전략 체크리스트

```sql
-- 1. 느린 쿼리 목록 확인 (pg_stat_statements 익스텐션)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
SELECT
  LEFT(query, 150)  AS query_sample,
  calls,
  ROUND(mean_exec_time::numeric, 2) AS avg_ms,
  ROUND(total_exec_time::numeric / 1000, 2) AS total_sec
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- 100ms 이상
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 2. Seq Scan 비율이 높은 테이블
SELECT
  relname,
  seq_scan,
  idx_scan,
  ROUND(seq_scan::numeric / NULLIF(seq_scan + idx_scan, 0) * 100, 1) AS seq_pct
FROM pg_stat_user_tables
WHERE seq_scan > 100
ORDER BY seq_pct DESC;

-- 3. 인덱스 크기 대비 효율 (크고 안 쓰이는 인덱스 찾기)
SELECT
  indexrelname,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size,
  CASE
    WHEN idx_scan = 0 THEN '삭제 검토'
    WHEN pg_relation_size(indexrelid) > 100000000 AND idx_scan < 100 THEN '비효율'
    ELSE '정상'
  END AS status
FROM pg_stat_user_indexes
WHERE pg_relation_size(indexrelid) > 1000000  -- 1MB 이상
ORDER BY pg_relation_size(indexrelid) DESC;
```

> **인덱스 최적화 팁:** 하루에 인덱스를 하나씩 추가/삭제하고 성능을 모니터링하세요. 여러 인덱스를 한번에 바꾸면 어떤 변경이 효과적이었는지 알 수 없습니다.
