---
title: "PostgreSQL 모니터링"
category: "운영 관리"
order: 5
description: "pg_stat_* 뷰와 외부 도구를 활용해 PostgreSQL 상태를 실시간으로 모니터링하는 방법을 배웁니다."
---

## 핵심 모니터링 뷰

PostgreSQL은 `pg_stat_*` 시스템 뷰를 통해 상세한 성능 지표를 제공합니다.

## 활성 연결과 쿼리

```sql
-- 현재 연결 상태 전체 보기
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    wait_event_type,
    wait_event,
    now() - query_start AS query_duration,
    LEFT(query, 80) AS query_preview
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_duration DESC NULLS LAST;

-- 연결 수 요약
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;

-- 최대 연결 수 대비 사용률
SELECT
    (SELECT count(*) FROM pg_stat_activity) AS current_connections,
    current_setting('max_connections')::int  AS max_connections;
```

## 느린 쿼리 — pg_stat_statements

```sql
-- 확장 설치 (postgresql.conf에 pg_stat_statements 추가 필요)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- 평균 실행 시간 상위 쿼리
SELECT
    calls,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(stddev_exec_time::numeric, 2) AS stddev_ms,
    LEFT(query, 100) AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- I/O가 많은 쿼리
SELECT
    calls,
    shared_blks_read + shared_blks_hit AS total_blocks,
    round((shared_blks_read * 100.0 /
           NULLIF(shared_blks_read + shared_blks_hit, 0))::numeric, 2) AS cache_miss_rate,
    LEFT(query, 100) AS query
FROM pg_stat_statements
ORDER BY shared_blks_read DESC
LIMIT 20;
```

## 테이블 통계

```sql
-- 테이블별 읽기/쓰기 현황
SELECT
    relname,
    seq_scan,
    idx_scan,
    n_tup_ins AS inserts,
    n_tup_upd AS updates,
    n_tup_del AS deletes,
    n_live_tup,
    n_dead_tup,
    round(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_ratio
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

## 캐시 히트율

```sql
-- 버퍼 캐시 히트율 (90% 이상 목표)
SELECT
    sum(heap_blks_read)                AS heap_read,
    sum(heap_blks_hit)                 AS heap_hit,
    round(sum(heap_blks_hit) * 100.0 /
          NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) AS cache_hit_rate
FROM pg_statio_user_tables;

-- 인덱스 캐시 히트율
SELECT
    round(sum(idx_blks_hit) * 100.0 /
          NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0), 2) AS idx_cache_hit_rate
FROM pg_statio_user_indexes;
```

## 디스크 I/O

```sql
-- 테이블별 디스크 읽기 현황
SELECT
    relname,
    heap_blks_read,
    heap_blks_hit,
    idx_blks_read,
    idx_blks_hit
FROM pg_statio_user_tables
ORDER BY heap_blks_read + idx_blks_read DESC
LIMIT 20;
```

## 복제 지연 모니터링

```sql
-- Primary에서 복제 슬레이브 상태 확인
SELECT
    client_addr,
    state,
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    pg_wal_lsn_diff(sent_lsn, replay_lsn) AS replication_lag_bytes
FROM pg_stat_replication;

-- Standby에서 복제 지연 확인
SELECT now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

## 외부 모니터링 도구

| 도구 | 특징 |
|------|------|
| **pgBadger** | 로그 분석 HTML 리포트 |
| **pgAdmin** | GUI 모니터링 대시보드 |
| **Prometheus + postgres_exporter** | 메트릭 수집 및 Grafana 시각화 |
| **DataDog / New Relic** | SaaS 통합 APM |
| **check_postgres** | Nagios/Icinga 플러그인 |

## 알림 쿼리 예시

```sql
-- 장시간 실행 쿼리 감지 (5분 이상)
SELECT pid, usename, now() - query_start AS runtime, query
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < now() - INTERVAL '5 minutes'
  AND query NOT LIKE '%pg_stat%';

-- 대기 중인 락 감지
SELECT count(*) FROM pg_stat_activity
WHERE wait_event_type = 'Lock';
```
