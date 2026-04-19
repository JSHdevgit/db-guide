---
title: "세이브포인트와 중첩 트랜잭션"
category: "트랜잭션"
order: 4
description: "SAVEPOINT로 트랜잭션의 특정 지점을 저장하고 부분 롤백하는 방법을 배웁니다."
---

## 세이브포인트란?

트랜잭션 내에서 중간 지점을 마킹해 해당 지점으로만 롤백할 수 있게 합니다. 전체 트랜잭션을 롤백하지 않아도 됩니다.

## 기본 사용법

```sql
BEGIN;

INSERT INTO orders (user_id, total) VALUES (1, 50000);

SAVEPOINT after_order;  -- 세이브포인트 생성

INSERT INTO order_items (order_id, product_id, qty) VALUES (1, 100, 2);

-- 문제 발생 시
ROLLBACK TO SAVEPOINT after_order;  -- after_order 지점으로만 롤백
-- orders는 유지, order_items 삽입만 취소

-- 다시 시도
INSERT INTO order_items (order_id, product_id, qty) VALUES (1, 101, 1);

COMMIT;
```

## 여러 세이브포인트

```sql
BEGIN;

INSERT INTO step1_table VALUES (1);
SAVEPOINT sp1;

INSERT INTO step2_table VALUES (2);
SAVEPOINT sp2;

INSERT INTO step3_table VALUES (3);

-- sp2로 롤백 → step3만 취소
ROLLBACK TO SAVEPOINT sp2;

-- sp1로 롤백 → step2, step3 모두 취소
ROLLBACK TO SAVEPOINT sp1;

COMMIT;  -- step1만 커밋됨
```

## 세이브포인트 해제

```sql
-- 더 이상 필요 없는 세이브포인트 해제 (메모리 절약)
SAVEPOINT my_point;
-- 작업...
RELEASE SAVEPOINT my_point;  -- 해제 (롤백 불가, 삭제됨)
```

## 예외 처리와 함께 — PL/pgSQL

```sql
CREATE OR REPLACE FUNCTION safe_transfer(
    from_id INT, to_id INT, amount NUMERIC
) RETURNS VOID AS $$
BEGIN
    SAVEPOINT before_transfer;

    UPDATE accounts SET balance = balance - amount WHERE id = from_id;

    IF (SELECT balance FROM accounts WHERE id = from_id) < 0 THEN
        ROLLBACK TO SAVEPOINT before_transfer;
        RAISE EXCEPTION '잔액 부족';
    END IF;

    UPDATE accounts SET balance = balance + amount WHERE id = to_id;

    RELEASE SAVEPOINT before_transfer;
END;
$$ LANGUAGE plpgsql;
```

## 배치 처리에서의 활용

```sql
BEGIN;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM import_queue LOOP
        BEGIN
            SAVEPOINT per_row;

            INSERT INTO processed_data
            SELECT * FROM process_row(r.id);

            RELEASE SAVEPOINT per_row;

        EXCEPTION WHEN OTHERS THEN
            -- 한 행 실패해도 나머지 계속 처리
            ROLLBACK TO SAVEPOINT per_row;
            INSERT INTO error_log (row_id, error) VALUES (r.id, SQLERRM);
        END;
    END LOOP;
END;
$$;

COMMIT;
```

## 주의사항

| 항목 | 설명 |
|------|------|
| 네스팅 | 세이브포인트는 중첩 가능하나, 같은 이름은 마지막 것이 유효 |
| 성능 | 세이브포인트가 많으면 롤백 비용 증가 |
| 자동커밋 | 자동커밋 모드에서는 세이브포인트 사용 불가 |
