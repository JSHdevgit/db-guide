---
title: "데드락 이해와 예방"
category: "트랜잭션"
order: 3
description: "데드락이 발생하는 원인과 감지 방법, 그리고 예방 전략을 배웁니다."
---

## 데드락이란?

두 트랜잭션이 서로 상대방이 보유한 락을 기다리며 무한히 대기하는 상황입니다.

```
트랜잭션 A: users 행 1 락 획득 → orders 행 1 락 대기
트랜잭션 B: orders 행 1 락 획득 → users 행 1 락 대기
→ 데드락!
```

## 데드락 발생 예제

```sql
-- 세션 A
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;  -- 1번 락
-- 잠시 대기...
UPDATE accounts SET balance = balance + 100 WHERE id = 2;  -- 2번 락 대기
COMMIT;

-- 세션 B (동시에 실행)
BEGIN;
UPDATE accounts SET balance = balance - 50 WHERE id = 2;   -- 2번 락
UPDATE accounts SET balance = balance + 50 WHERE id = 1;   -- 1번 락 대기 → 데드락!
COMMIT;
```

PostgreSQL은 데드락을 자동으로 감지하고 한쪽 트랜잭션을 강제 종료(rollback)합니다.

```
ERROR: deadlock detected
DETAIL: Process 12345 waits for ShareLock on transaction 67890;
        blocked by process 54321.
```

## 예방 전략 1: 일관된 순서로 락 획득

```sql
-- 항상 작은 ID부터 락
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = LEAST(1, 2);
UPDATE accounts SET balance = balance + 100 WHERE id = GREATEST(1, 2);
COMMIT;
```

## 예방 전략 2: 한 번에 모든 락 획득

```sql
BEGIN;
-- SELECT FOR UPDATE로 필요한 행을 한꺼번에 락
SELECT * FROM accounts
WHERE id IN (1, 2)
ORDER BY id  -- 순서 중요!
FOR UPDATE;

UPDATE accounts SET balance = balance - 100 WHERE id = 1;
UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
```

## 예방 전략 3: NOWAIT / SKIP LOCKED

```sql
-- 락을 즉시 얻지 못하면 오류 발생 (대기하지 않음)
SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE NOWAIT;

-- 락이 걸린 행은 건너뜀 (큐 처리에 유용)
SELECT * FROM jobs WHERE status = 'pending' LIMIT 1 FOR UPDATE SKIP LOCKED;
```

## 현재 락 상태 확인

```sql
-- 현재 대기 중인 락
SELECT
    pid,
    query,
    wait_event_type,
    wait_event,
    state
FROM pg_stat_activity
WHERE wait_event_type = 'Lock';

-- 락 의존 관계 확인
SELECT
    blocked.pid         AS blocked_pid,
    blocking.pid        AS blocking_pid,
    blocked.query       AS blocked_query,
    blocking.query      AS blocking_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
    ON blocking.pid = ANY(pg_blocking_pids(blocked.pid))
WHERE cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

## 데드락 타임아웃 설정

```sql
-- 트랜잭션 단위로 설정 (밀리초)
SET deadlock_timeout = '1s';  -- 기본값 1초

-- 연결 대기 타임아웃
SET lock_timeout = '5s';      -- 5초 내 락 못 얻으면 오류
```
