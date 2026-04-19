---
title: "인덱스 유지보수"
category: "인덱스"
order: 5
description: "인덱스 팽창(bloat)을 감지하고 REINDEX로 재구축하며, 인덱스 사용 현황을 모니터링하는 방법을 배웁니다."
---

## 인덱스 팽창(Bloat)이란?

UPDATE와 DELETE가 반복되면 인덱스에 사용되지 않는 공간(dead tuple)이 쌓입니다. 이를 인덱스 팽창이라 합니다.

## 인덱스 크기 및 팽창 확인

```sql
-- 테이블과 인덱스 크기 확인
SELECT
    relname                                   AS object_name,
    pg_size_pretty(pg_relation_size(oid))     AS size,
    pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relname LIKE 'idx_%'
ORDER BY pg_relation_size(oid) DESC;

-- pgstattuple로 팽창률 확인 (확장 필요)
CREATE EXTENSION IF NOT EXISTS pgstattuple;
SELECT * FROM pgstattuple('idx_users_email');
-- dead_tuple_percent 가 20% 초과면 재구축 검토
```

## REINDEX — 인덱스 재구축

```sql
-- 단일 인덱스 재구축
REINDEX INDEX idx_users_email;

-- 테이블의 모든 인덱스 재구축
REINDEX TABLE users;

-- 데이터베이스 전체 (매우 오래 걸림)
REINDEX DATABASE myapp;

-- CONCURRENTLY: 테이블 락 없이 재구축 (PostgreSQL 12+)
REINDEX INDEX CONCURRENTLY idx_users_email;
```

> `REINDEX`는 기본적으로 테이블에 배타적 락을 걸어 다른 쿼리를 차단합니다. 운영 중에는 `CONCURRENTLY` 옵션을 사용하세요.

## VACUUM으로 인덱스 정리

```sql
-- VACUUM은 dead tuple 제거 (인덱스 포함)
VACUUM users;          -- 일반 VACUUM (공간 재사용)
VACUUM FULL users;     -- 공간 OS 반환 (배타적 락, 느림)
VACUUM ANALYZE users;  -- VACUUM + 통계 갱신
```

## 인덱스 사용 현황 모니터링

```sql
-- 인덱스별 사용 횟수 조회
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan    AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## 사용되지 않는 인덱스 찾기

```sql
-- 한 번도 사용되지 않은 인덱스 (잠재적 불필요 인덱스)
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE 'pk_%'          -- PK 제외
  AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;
```

> 통계는 마지막 `pg_stat_reset()` 이후 누적됩니다. 서버 재시작 후 충분히 기다린 뒤 판단하세요.

## 중복 인덱스 찾기

```sql
SELECT
    indrelid::regclass AS table_name,
    array_agg(indexrelid::regclass ORDER BY indexrelid) AS indexes,
    array_agg(indkey) AS keys
FROM pg_index
GROUP BY indrelid, indkey
HAVING COUNT(*) > 1;
```

## 인덱스 유지보수 체크리스트

| 주기 | 작업 |
|------|------|
| 매일 | autovacuum 로그 확인 |
| 주간 | 인덱스 사용 통계 확인 |
| 월간 | 팽창률 높은 인덱스 REINDEX CONCURRENTLY |
| 분기 | 미사용 인덱스 검토 및 제거 |
