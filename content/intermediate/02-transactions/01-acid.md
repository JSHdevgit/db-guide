---
title: "트랜잭션과 ACID"
category: "트랜잭션"
order: 1
description: "트랜잭션의 개념과 ACID 속성 — 원자성, 일관성, 격리성, 지속성"
---

## 트랜잭션이란?

여러 쿼리를 하나의 작업 단위로 묶는 것입니다. **전부 성공하거나 전부 실패합니다.** 중간 상태는 없습니다.

```sql
-- 계좌 이체: 두 쿼리가 항상 같이 실행되어야 함
BEGIN;

UPDATE accounts SET balance = balance - 10000 WHERE id = 1; -- A계좌 출금
UPDATE accounts SET balance = balance + 10000 WHERE id = 2; -- B계좌 입금

COMMIT;  -- 둘 다 성공 → 확정
-- ROLLBACK; -- 오류 발생 시 → 둘 다 취소
```

트랜잭션 없이 첫 번째 UPDATE 직후에 서버가 다운되면, A계좌에서 돈이 빠졌는데 B계좌에 입금이 안 되는 최악의 상황이 발생합니다. 트랜잭션은 이런 부분 실패를 방지합니다.

## ACID 속성

### A — 원자성 (Atomicity)

트랜잭션 내 모든 쿼리는 전부 성공하거나 전부 실패합니다. **부분 성공은 없습니다.**

오류가 발생하면 이미 실행된 쿼리들도 모두 롤백됩니다.

### C — 일관성 (Consistency)

트랜잭션 전후로 데이터베이스의 제약 조건이 유지됩니다. CHECK, FOREIGN KEY, UNIQUE 같은 제약을 위반하면 트랜잭션 전체가 롤백됩니다.

```sql
-- 예: CHECK 제약 조건 위반 시 트랜잭션 전체 롤백
BEGIN;
UPDATE accounts SET balance = -5000 WHERE id = 1;
-- balance >= 0 CHECK 제약 → 오류 발생 → 자동 롤백
COMMIT;
```

### I — 격리성 (Isolation)

동시에 실행 중인 트랜잭션이 서로에게 미치는 영향을 제어합니다. 격리 수준에 따라 다른 트랜잭션의 미완료 변경 사항을 볼 수 있는지 결정됩니다. 자세한 내용은 다음 챕터를 참고하세요.

### D — 지속성 (Durability)

`COMMIT`된 데이터는 시스템 장애(정전, 크래시)가 발생해도 사라지지 않습니다. PostgreSQL은 WAL(Write-Ahead Log)로 이를 보장합니다. 변경 사항을 먼저 WAL에 기록한 뒤 실제 파일을 수정하므로, 크래시가 나도 WAL을 재실행해서 복구할 수 있습니다.

## SAVEPOINT — 부분 롤백

트랜잭션 안에 체크포인트를 만들어서, 오류 발생 시 트랜잭션 전체가 아닌 체크포인트까지만 롤백할 수 있습니다.

```sql
BEGIN;

INSERT INTO orders (user_id, total) VALUES (1, 50000);

SAVEPOINT after_order;  -- 여기까지 성공을 기록

INSERT INTO order_items (order_id, product_id, quantity)
VALUES (LASTVAL(), 999, 1);
-- 존재하지 않는 product_id → 외래 키 위반 오류

ROLLBACK TO SAVEPOINT after_order; -- order_items INSERT만 롤백
-- orders INSERT는 유지됨

-- 다른 product_id로 재시도
INSERT INTO order_items (order_id, product_id, quantity) VALUES (LASTVAL(), 1, 1);

RELEASE SAVEPOINT after_order;  -- SAVEPOINT 정리 (선택사항)
COMMIT;
```

SAVEPOINT는 배치 처리에서 "일부 실패해도 성공한 것만 저장"하는 패턴에 유용합니다.

## 에러 처리 패턴

```sql
DO $$
BEGIN
  BEGIN  -- 내부 트랜잭션 블록
    UPDATE accounts SET balance = balance - 10000 WHERE id = 1;
    UPDATE accounts SET balance = balance + 10000 WHERE id = 2;
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '잔액 부족: %', SQLERRM;
    WHEN foreign_key_violation THEN
      RAISE NOTICE '계좌 없음: %', SQLERRM;
    WHEN OTHERS THEN
      RAISE NOTICE '이체 실패: %', SQLERRM;
  END;
END $$;
```

## 자동 커밋

psql에서 `BEGIN` 없이 실행한 단일 쿼리는 자동으로 트랜잭션이 시작되고 즉시 커밋됩니다. 백엔드 코드에서는 트랜잭션을 명시적으로 관리하는 게 안전합니다.

```sql
-- psql에서: 자동 커밋 (BEGIN 없음)
UPDATE users SET name = '수정' WHERE id = 1;
-- 실행 즉시 커밋 → 롤백 불가

-- 실수 방지: BEGIN으로 감싸고 확인 후 COMMIT
BEGIN;
UPDATE users SET name = '수정' WHERE id = 1;
-- 영향받은 행 확인...
COMMIT;  -- 또는 ROLLBACK
```

> **팁:** 데이터 수정 작업을 할 때는 항상 `BEGIN`으로 시작하고, 결과를 확인한 후 `COMMIT` 또는 `ROLLBACK`을 결정하는 습관을 들이세요. 특히 `UPDATE`/`DELETE`에서 실수를 방지하는 가장 좋은 방법입니다.
