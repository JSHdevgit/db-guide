---
title: "INSERT / UPDATE / DELETE"
category: "SQL 기초"
order: 6
description: "데이터 삽입, 수정, 삭제 — 실수 없이 안전하게"
---

## INSERT

```sql
-- 단일 행 삽입
INSERT INTO users (name, email, created_at)
VALUES ('김철수', 'kim@example.com', NOW());

-- 여러 행 한번에 (단건 INSERT보다 훨씬 빠름)
INSERT INTO products (name, price, category)
VALUES
  ('노트북', 1200000, 'electronics'),
  ('마우스',   30000, 'electronics'),
  ('책상',    250000, 'furniture');

-- 다른 테이블에서 복사
INSERT INTO archive_orders (SELECT * FROM orders WHERE created_at < '2023-01-01');
```

> **팁:** 대량 삽입 시 단건 INSERT를 반복하지 말고, 여러 행을 한 번에 INSERT하거나 `COPY` 명령을 사용하세요. 10만 건 기준으로 단건 반복은 수분, 다중 VALUES는 수초, COPY는 1초 이내입니다.

## RETURNING — 삽입 후 값 바로 받기

INSERT/UPDATE/DELETE 후 영향받은 행의 값을 즉시 반환합니다. 백엔드에서 ID를 얻기 위해 SELECT를 추가로 보낼 필요가 없어집니다.

```sql
-- 삽입 후 자동 생성된 id와 created_at 즉시 반환
INSERT INTO users (name, email)
VALUES ('이영희', 'lee@example.com')
RETURNING id, created_at;

-- UPDATE 후 변경된 값 확인
UPDATE products SET price = price * 1.1
WHERE category = 'electronics'
RETURNING id, name, price;  -- 인상된 가격 확인
```

## UPDATE

```sql
-- 특정 행 수정
UPDATE users
SET name = '김철수 수정', updated_at = NOW()
WHERE id = 1;

-- 조건 기반 일괄 수정
UPDATE products
SET price = price * 1.1  -- 10% 인상
WHERE category = 'electronics';

-- 다른 테이블 값으로 업데이트 (UPDATE ... FROM)
UPDATE order_items oi
SET unit_price = p.price
FROM products p
WHERE p.id = oi.product_id
  AND oi.unit_price <> p.price;
```

> **항상 WHERE 먼저 확인:** `UPDATE`와 `DELETE`는 WHERE 없이 실행하면 **전체 테이블**이 영향을 받습니다. 반드시 실행 전 같은 WHERE 조건으로 `SELECT COUNT(*)`를 먼저 실행해서 영향받을 행 수를 확인하는 습관을 들이세요.

## DELETE

```sql
-- 특정 행 삭제
DELETE FROM sessions WHERE expired_at < NOW();

-- RETURNING으로 삭제된 행 확인 (감사 로그 등에 활용)
DELETE FROM users WHERE id = 5 RETURNING name, email;

-- 다른 테이블 조건으로 삭제 (DELETE ... USING)
DELETE FROM order_items oi
USING orders o
WHERE oi.order_id = o.id
  AND o.status = 'cancelled';
```

## TRUNCATE — 전체 테이블 빠르게 비우기

```sql
-- DELETE보다 훨씬 빠름 (WAL 최소화, 행 단위 처리 없음)
TRUNCATE TABLE sessions;

-- 여러 테이블 동시에
TRUNCATE TABLE sessions, temp_data;

-- 외래 키가 있는 연관 테이블도 함께
TRUNCATE TABLE orders, order_items CASCADE;
```

> **주의:** `TRUNCATE`는 롤백이 가능한 DDL이지만, 트리거가 실행되지 않고 `WHERE` 조건을 줄 수 없습니다. 특정 조건으로 대량 삭제할 때는 DELETE를 사용하세요.

## UPSERT — INSERT or UPDATE

같은 기본 키나 유니크 키가 이미 존재하면 UPDATE, 없으면 INSERT합니다. "있으면 업데이트, 없으면 삽입"이 필요한 경우에 씁니다.

```sql
-- 이미 존재하면 UPDATE, 없으면 INSERT
INSERT INTO user_settings (user_id, theme, lang)
VALUES (1, 'dark', 'ko')
ON CONFLICT (user_id) DO UPDATE
  SET theme = EXCLUDED.theme,
      lang  = EXCLUDED.lang,
      updated_at = NOW();
-- EXCLUDED: 충돌한 INSERT에서 시도한 값을 참조

-- 충돌 시 아무것도 안 하기 (멱등성 보장)
INSERT INTO events (name, occurred_at)
VALUES ('login', NOW())
ON CONFLICT DO NOTHING;
```

> **팁:** `EXCLUDED`는 충돌한 INSERT 시도에서 넣으려 했던 값입니다. `SET theme = EXCLUDED.theme`은 "새로 INSERT하려던 theme 값으로 업데이트"를 의미합니다. 이 패턴은 분산 시스템에서 중복 이벤트 처리나 캐시 갱신에 자주 씁니다.

## 안전한 DML 습관

```sql
-- 1. UPDATE/DELETE 전 SELECT로 대상 확인
SELECT COUNT(*), status FROM orders WHERE user_id = 42;

-- 2. 트랜잭션 안에서 실행하고 확인 후 COMMIT
BEGIN;
DELETE FROM sessions WHERE user_id = 42;
-- 삭제된 행 수 확인
SELECT ROW_COUNT;  -- psql에선 바로 보임
COMMIT;  -- 확인 후 커밋, 문제 있으면 ROLLBACK

-- 3. 대량 처리는 배치로
-- 한번에 100만 행 삭제 → Lock 오래 점유
-- 1000행씩 나눠서 삭제 → Lock 최소화
```
