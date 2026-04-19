---
title: "VACUUM과 Autovacuum"
category: "운영 관리"
order: 1
description: "PostgreSQL의 MVCC와 dead tuple 정리 — Autovacuum 튜닝"
---

## 왜 VACUUM이 필요한가?

PostgreSQL은 UPDATE/DELETE 시 기존 행을 **즉시 지우지 않습니다.** 대신 "죽은 행(dead tuple)"으로 표시하고 나중에 정리합니다. 이게 MVCC(Multi-Version Concurrency Control)의 핵심입니다.

MVCC 덕분에 읽기 트랜잭션은 잠금 없이 동시에 실행할 수 있습니다. 각 트랜잭션은 자신이 시작될 때의 스냅샷을 보기 때문입니다. 하지만 이 접근의 대가로 dead tuple이 쌓이고, 주기적으로 정리(VACUUM)가 필요합니다.

```sql
-- dead tuple 현황 확인
SELECT
  relname,
  n_live_tup,
  n_dead_tup,
  ROUND(n_dead_tup::numeric / NULLIF(n_live_tup + n_dead_tup, 0) * 100, 1) AS dead_pct,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 20;
```

> **팁:** `dead_pct`가 10% 이상이면 테이블 성능에 영향을 줄 수 있습니다. Autovacuum이 정상 동작 중이라면 자동으로 처리됩니다. 갑자기 급증했다면 대량 DELETE/UPDATE 작업이 있었는지 확인하세요.

## VACUUM 종류

```sql
-- 기본 VACUUM: dead tuple 정리, 공간은 OS에 반환 안 함 (재사용 가능)
VACUUM orders;

-- VACUUM ANALYZE: dead tuple 정리 + 통계 갱신 (가장 많이 쓰임)
VACUUM ANALYZE orders;

-- VACUUM FULL: 테이블 재작성, 공간 OS 반환 (강한 잠금 발생!)
VACUUM FULL orders;

-- VACUUM VERBOSE: 진행 상황 상세 출력
VACUUM VERBOSE orders;
```

> **VACUUM FULL은 신중하게:** 테이블 전체를 새로 작성하면서 ACCESS EXCLUSIVE 잠금이 걸립니다. 잠금이 걸리는 동안 해당 테이블에 SELECT도 차단됩니다. 운영 중에는 `VACUUM FULL` 대신 `pg_repack` 확장을 사용하세요. `pg_repack`은 잠금 없이 테이블을 재구성합니다.

## Autovacuum 모니터링

PostgreSQL은 백그라운드에서 Autovacuum을 자동으로 실행합니다.

```sql
-- Autovacuum 설정 확인
SHOW autovacuum_vacuum_scale_factor;   -- 기본 0.2 (dead tuple 20%일 때 실행)
SHOW autovacuum_vacuum_threshold;      -- 기본 50 (최소 50행 이상 dead tuple)
SHOW autovacuum_max_workers;           -- 기본 3 (동시 실행 수)

-- 현재 autovacuum 실행 중인 테이블
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query
FROM pg_stat_activity
WHERE query LIKE 'autovacuum:%';

-- VACUUM 진행 상황 (PostgreSQL 9.6+)
SELECT
  phase,
  heap_blks_total,
  heap_blks_scanned,
  ROUND(heap_blks_scanned::numeric / NULLIF(heap_blks_total, 0) * 100, 1) AS pct
FROM pg_stat_progress_vacuum;
```

## Autovacuum 튜닝

기본 Autovacuum 설정은 작은 테이블에는 공격적이고 큰 테이블에는 너무 느립니다. 테이블별로 튜닝하세요.

```sql
-- 빠르게 변하는 테이블에 더 공격적으로
ALTER TABLE events SET (
  autovacuum_vacuum_scale_factor = 0.01,   -- 1% 변경 시 실행 (기본 20%)
  autovacuum_vacuum_threshold = 100,
  autovacuum_analyze_scale_factor = 0.005
);

-- 대용량 테이블: I/O 비용 낮춰서 더 빠르게
ALTER TABLE big_table SET (
  autovacuum_vacuum_cost_delay = 2,      -- ms (기본 2ms, 낮출수록 빠름)
  autovacuum_vacuum_cost_limit = 400     -- 페이지당 비용 한도 (기본 200)
);

-- 설정 초기화 (기본값으로 되돌리기)
ALTER TABLE events RESET (autovacuum_vacuum_scale_factor);
```

> **Autovacuum이 뒤처지는 신호:** `pg_stat_user_tables`에서 `last_autovacuum`이 오래됐거나, `n_dead_tup`이 계속 증가하면 Autovacuum이 따라가지 못하는 것입니다. `autovacuum_max_workers`를 늘리거나 테이블별 설정을 조정하세요.

## Transaction ID Wraparound 예방

PostgreSQL의 트랜잭션 ID는 32비트 정수입니다. 약 20억 개가 한계이며, 초과하면 데이터 손상이 발생합니다. VACUUM은 이를 예방합니다.

```sql
-- 위험 수준 확인 (20억 트랜잭션이 한계)
SELECT
  datname,
  age(datfrozenxid) AS tx_age,
  ROUND(age(datfrozenxid)::numeric / 2000000000 * 100, 1) AS pct_of_limit
FROM pg_database
ORDER BY age(datfrozenxid) DESC;

-- 경고: pct_of_limit > 50% → 모니터링 강화
-- 경고: pct_of_limit > 75% → 즉시 VACUUM FREEZE 고려
VACUUM FREEZE orders;

-- 테이블별 확인
SELECT
  relname,
  age(relfrozenxid) AS tx_age,
  ROUND(age(relfrozenxid)::numeric / 2000000000 * 100, 1) AS pct
FROM pg_class
WHERE relkind = 'r'
ORDER BY age(relfrozenxid) DESC
LIMIT 20;
```

> **심각성:** Transaction ID Wraparound는 PostgreSQL의 가장 위험한 장애 중 하나입니다. 이 상태가 되면 PostgreSQL이 "안전 셧다운" 모드로 전환되어 읽기만 가능하게 됩니다. Autovacuum이 정상 동작하면 이 문제는 자동으로 예방됩니다. 정기적으로 `pct_of_limit`을 모니터링하고 50%를 넘기면 수동으로 `VACUUM FREEZE`를 실행하세요.
