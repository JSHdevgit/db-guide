---
title: "쿼리 병렬화 — Parallel Query"
category: "성능 최적화"
order: 4
description: "PostgreSQL의 병렬 쿼리 실행 메커니즘을 이해하고, 병렬화 설정을 튜닝하는 방법을 배웁니다."
---

## 병렬 쿼리란?

PostgreSQL 9.6+에서는 대용량 테이블 스캔, 집계, 조인을 여러 worker 프로세스가 나누어 처리할 수 있습니다.

```
Leader process
├── Worker 1: 테이블 1/4 스캔
├── Worker 2: 테이블 2/4 스캔
├── Worker 3: 테이블 3/4 스캔
└── Worker 4: 테이블 4/4 스캔
→ 결과 병합
```

## EXPLAIN로 병렬 실행 확인

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT department, COUNT(*), AVG(salary)
FROM employees
GROUP BY department;

-- 병렬 실행 시 출력 예시
-- Gather  (cost=... rows=... width=...)
--   Workers Planned: 4
--   Workers Launched: 4
--   ->  Partial HashAggregate
--         ->  Parallel Seq Scan on employees
```

## 병렬화 설정 파라미터

```sql
-- 최대 worker 수 (postgresql.conf)
max_parallel_workers_per_gather = 4  -- 쿼리당 최대 worker 수
max_parallel_workers = 8             -- 전체 시스템 최대 worker 수
max_worker_processes = 16            -- 전체 백그라운드 프로세스 수

-- 병렬화 비용 조정
parallel_setup_cost = 1000.0    -- worker 시작 비용 (낮출수록 병렬화 선호)
parallel_tuple_cost = 0.1       -- tuple 전달 비용

-- 세션 단위 설정
SET max_parallel_workers_per_gather = 8;
```

## 병렬 힌트 — 테이블 단위 설정

```sql
-- 특정 테이블의 병렬화 worker 수 강제
ALTER TABLE large_table SET (parallel_workers = 8);

-- 병렬화 비활성화
ALTER TABLE small_table SET (parallel_workers = 0);

-- 최소 병렬화 테이블 크기 조정 (기본 8MB)
SET min_parallel_table_scan_size = '1MB';
SET min_parallel_index_scan_size = '512kB';
```

## 병렬화가 적용되는 연산

| 연산 | 병렬 지원 버전 |
|------|--------------|
| Seq Scan | 9.6+ |
| Hash Join | 9.6+ |
| Nested Loop | 9.6+ |
| Merge Join | 10+ |
| Hash Aggregate | 11+ |
| B-Tree Index Scan | 10+ |
| Bitmap Heap Scan | 10+ |
| CREATE INDEX | 11+ |

## 병렬 인덱스 생성

```sql
-- 병렬 인덱스 생성 (PostgreSQL 11+)
SET max_parallel_maintenance_workers = 4;
CREATE INDEX CONCURRENTLY idx_large_col ON large_table(col);
```

## 병렬화가 비활성화되는 경우

```sql
-- 다음 상황에서 병렬 쿼리 불가
-- 1. 트랜잭션 격리 수준 SERIALIZABLE
SET default_transaction_isolation = 'serializable';

-- 2. CURSOR 사용
DECLARE my_cursor CURSOR FOR SELECT ...;

-- 3. FOR UPDATE / FOR SHARE
SELECT * FROM t FOR UPDATE;

-- 4. 병렬 안전하지 않은 함수 포함
-- PARALLEL SAFE / UNSAFE / RESTRICTED 함수 속성
CREATE FUNCTION my_func() RETURNS INT AS $$...$$
LANGUAGE plpgsql PARALLEL SAFE;  -- 명시적 선언
```

## 성능 측정 예시

```sql
-- 병렬화 전
SET max_parallel_workers_per_gather = 0;
EXPLAIN (ANALYZE) SELECT COUNT(*) FROM events;  -- ~3000ms

-- 병렬화 후
SET max_parallel_workers_per_gather = 8;
EXPLAIN (ANALYZE) SELECT COUNT(*) FROM events;  -- ~450ms
```

> 병렬 쿼리는 CPU 코어가 많고 테이블이 클수록 효과적입니다. OLTP 워크로드(작은 쿼리 다수)보다 OLAP(대규모 집계)에 유리합니다.
