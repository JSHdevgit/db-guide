---
title: "트랜잭션 격리 수준"
category: "트랜잭션"
order: 2
description: "READ COMMITTED, REPEATABLE READ, SERIALIZABLE — 동시성과 정확성의 트레이드오프"
---

## 왜 격리 수준이 필요한가?

동시에 여러 트랜잭션이 실행될 때 발생하는 문제들:

| 문제 | 설명 | 발생 상황 |
|---|---|---|
| **Dirty Read** | 커밋 안 된 데이터를 읽음 | A가 쓰는 중에 B가 읽음 |
| **Non-Repeatable Read** | 같은 쿼리가 다른 결과 반환 | A가 읽는 사이 B가 커밋 |
| **Phantom Read** | 반복 조회 시 새 행이 나타남 | A가 집계하는 사이 B가 INSERT |

높은 격리 수준일수록 이런 문제를 더 잘 막지만, 동시성(처리량)이 줄어드는 트레이드오프가 있습니다.

## 격리 수준

```sql
-- 트랜잭션 시작과 동시에 격리 수준 설정
BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- 또는 세션 기본값 변경
SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;
```

### READ COMMITTED (기본값)

커밋된 데이터만 읽습니다. 같은 트랜잭션 내에서도 다른 트랜잭션이 커밋하면 새 값을 읽어요. Non-Repeatable Read가 발생할 수 있습니다.

```sql
-- 세션 A
BEGIN;
SELECT balance FROM accounts WHERE id = 1; -- 100,000

-- [이 사이에 세션 B: UPDATE accounts SET balance = 50,000 WHERE id = 1; COMMIT;]

SELECT balance FROM accounts WHERE id = 1; -- 50,000 (변경 반영됨!)
COMMIT;
```

대부분의 OLTP 애플리케이션에서 이 수준으로 충분합니다. PostgreSQL의 기본값이기도 합니다.

### REPEATABLE READ

트랜잭션이 시작된 시점의 스냅샷을 유지합니다. 다른 트랜잭션이 커밋해도 현재 트랜잭션에서는 변경이 보이지 않아요.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SELECT balance FROM accounts WHERE id = 1; -- 100,000

-- [다른 세션이 balance를 50,000으로 변경 + 커밋]

SELECT balance FROM accounts WHERE id = 1; -- 여전히 100,000 (스냅샷 유지)
COMMIT;
```

보고서, 정산, 회계처럼 일관된 스냅샷에서 복잡한 계산을 해야 할 때 사용합니다.

> **팁:** PostgreSQL의 REPEATABLE READ는 표준보다 강해서, 이론상 발생 가능한 Phantom Read도 방지합니다. 이는 MVCC(스냅샷 기반) 구현 덕분입니다.

### SERIALIZABLE

가장 강력한 격리. 트랜잭션들이 마치 하나씩 순서대로 실행된 것과 동일한 결과를 보장합니다. 동시성이 낮아지고 직렬화 충돌(serialization failure) 오류가 발생할 수 있습니다.

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;
-- 쓰기 충돌 감지 시 아래 오류 발생:
-- ERROR: could not serialize access due to concurrent update
-- 애플리케이션에서 재시도(retry) 로직이 반드시 필요

-- 재시도 패턴 (애플리케이션 레벨)
-- MAX_RETRIES = 3
-- for attempt in range(MAX_RETRIES):
--   try:
--     begin transaction serializable
--     ... 비즈니스 로직 ...
--     commit
--     break
--   except SerializationError:
--     rollback
--     if attempt == MAX_RETRIES - 1: raise
COMMIT;
```

## 잠금 (LOCK)

명시적 잠금이 필요할 때 씁니다. 격리 수준보다 더 세밀하게 동시성을 제어합니다.

```sql
-- FOR UPDATE: 선택한 행에 독점 잠금 (다른 트랜잭션 수정 불가)
SELECT * FROM accounts WHERE id = 1 FOR UPDATE;
-- 읽은 직후 바로 수정할 때 사용 (read-modify-write 패턴)

-- FOR SHARE: 읽기는 허용, 쓰기만 차단
SELECT * FROM accounts WHERE id = 1 FOR SHARE;

-- NOWAIT: 잠금 획득 실패 시 즉시 에러 반환 (기다리지 않음)
SELECT * FROM accounts WHERE id = 1 FOR UPDATE NOWAIT;
-- 잠금이 이미 걸려 있으면 즉시 에러 → 사용자에게 "잠시 후 재시도" 응답

-- SKIP LOCKED: 잠긴 행을 건너뜀 (다음 사용 가능한 행 처리)
SELECT * FROM job_queue
WHERE status = 'pending'
FOR UPDATE SKIP LOCKED
LIMIT 1;
-- 작업 큐 패턴에서 여러 워커가 중복 없이 작업을 가져갈 때 사용
```

> **데드락 주의:** 트랜잭션 A가 행 1을 잠그고 행 2를 기다리는 동시에, 트랜잭션 B가 행 2를 잠그고 행 1을 기다리면 데드락이 발생합니다. PostgreSQL은 자동으로 데드락을 감지하고 한쪽 트랜잭션을 종료합니다. 데드락을 예방하려면 항상 같은 순서로 잠금을 획득하세요.

## lock_timeout 설정

잠금 대기 시간을 제한해서 데드락 상황에서 빠르게 실패할 수 있습니다.

```sql
-- 세션 레벨 잠금 대기 시간 제한
SET lock_timeout = '5s';   -- 5초 안에 잠금 못 얻으면 에러

-- 문장 레벨 실행 시간 제한
SET statement_timeout = '30s';  -- 30초 이상 걸리는 쿼리 강제 종료
```

## 실무 권장

| 상황 | 격리 수준 |
|---|---|
| 일반 CRUD, 웹 요청 처리 | READ COMMITTED (기본값) |
| 정산, 월 마감, 회계 보고서 | REPEATABLE READ |
| 재고 차감, 티켓 예약 | READ COMMITTED + SELECT FOR UPDATE |
| 금융 이중 지불 방지 | SERIALIZABLE + 재시도 로직 |

> **팁:** "격리 수준을 높이면 문제가 해결된다"는 생각은 조심해야 합니다. SERIALIZABLE은 정확성을 보장하지만 재시도 로직이 복잡해지고 처리량이 줄어듭니다. 대부분의 경우 READ COMMITTED + 적절한 잠금 전략으로 충분합니다.
