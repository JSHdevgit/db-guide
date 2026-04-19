---
title: "락 유형과 명시적 락"
category: "트랜잭션"
order: 5
description: "PostgreSQL의 다양한 락 유형과 명시적 락 사용법, 그리고 락 충돌을 최소화하는 전략을 배웁니다."
---

## PostgreSQL의 락 계층

락은 크게 **테이블 수준**과 **행 수준**으로 나뉩니다.

## 테이블 수준 락

```sql
-- 명시적 테이블 락
LOCK TABLE users IN ACCESS SHARE MODE;          -- SELECT 허용, 쓰기 차단
LOCK TABLE users IN ROW EXCLUSIVE MODE;         -- DML 작업 (자동)
LOCK TABLE users IN ACCESS EXCLUSIVE MODE;      -- 모든 접근 차단 (DDL)
```

| 락 모드 | 설명 | 충돌 대상 |
|---------|------|-----------|
| ACCESS SHARE | SELECT 시 자동 | ACCESS EXCLUSIVE만 |
| ROW SHARE | SELECT FOR SHARE | EXCLUSIVE, ACCESS EXCLUSIVE |
| ROW EXCLUSIVE | INSERT/UPDATE/DELETE | SHARE 이상 |
| SHARE | CREATE INDEX | ROW EXCLUSIVE 이상 |
| EXCLUSIVE | 거의 모든 쓰기 차단 | SHARE LOCK 이상 |
| ACCESS EXCLUSIVE | DDL (ALTER, DROP) | 모든 락 |

## 행 수준 락

```sql
-- 읽기 후 수정 시 행 락
SELECT * FROM orders WHERE id = 1 FOR UPDATE;         -- 배타적 행 락
SELECT * FROM orders WHERE id = 1 FOR SHARE;          -- 공유 행 락
SELECT * FROM orders WHERE id = 1 FOR NO KEY UPDATE;  -- FK 참조 허용
SELECT * FROM orders WHERE id = 1 FOR KEY SHARE;      -- FK용 공유 락
```

## FOR UPDATE 실전 패턴

```sql
-- 재고 차감 (동시성 문제 방지)
BEGIN;

SELECT stock FROM products WHERE id = 42 FOR UPDATE;
-- 이 시점부터 다른 트랜잭션은 id=42 행 수정 불가

UPDATE products SET stock = stock - 1 WHERE id = 42;

COMMIT;
```

## SKIP LOCKED — 큐 구현

```sql
-- 작업 큐에서 미처리 작업 가져오기
BEGIN;

SELECT id, payload
FROM job_queue
WHERE status = 'pending'
ORDER BY created_at
LIMIT 1
FOR UPDATE SKIP LOCKED;  -- 이미 처리 중인 행 건너뜀

-- 가져온 작업 상태 변경
UPDATE job_queue SET status = 'processing' WHERE id = :job_id;

COMMIT;
```

## NOWAIT — 즉시 실패

```sql
BEGIN;

-- 락을 즉시 얻지 못하면 기다리지 않고 오류 반환
SELECT * FROM critical_row WHERE id = 1 FOR UPDATE NOWAIT;
-- ERROR: could not obtain lock on row in relation "critical_row"

COMMIT;
```

## 현재 락 상태 조회

```sql
-- 모든 락 보기
SELECT pid, mode, granted, relation::regclass
FROM pg_locks l
JOIN pg_class c ON l.relation = c.oid
WHERE NOT granted;  -- 대기 중인 락만

-- 어떤 프로세스가 블로킹?
SELECT
    a.pid,
    a.query,
    age(now(), a.query_start) AS wait_duration
FROM pg_stat_activity a
WHERE cardinality(pg_blocking_pids(a.pid)) > 0;
```

## 락 충돌 최소화 전략

1. **트랜잭션을 짧게** — 락 보유 시간 최소화
2. **인덱스 활용** — 불필요한 행 락 방지
3. **일관된 순서** — 여러 행 락 시 항상 같은 순서로
4. **lock_timeout 설정** — 무한 대기 방지
5. **MVCC 활용** — 가능하면 락 없이 읽기 (스냅샷)
