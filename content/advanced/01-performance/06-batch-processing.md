---
title: "대용량 배치 처리 전략"
category: "성능 최적화"
order: 6
description: "수백만 건의 데이터를 안전하고 효율적으로 처리하기 위한 배치 패턴과 최적화 기법을 배웁니다."
---

## 배치 처리의 핵심 원칙

대용량 DML을 단일 트랜잭션으로 실행하면 락 경합, WAL 폭증, 롤백 비용이 커집니다. **작게 나누어** 처리하는 것이 기본 원칙입니다.

## 청크 단위 UPDATE/DELETE

```sql
-- 나쁜 예: 한 번에 수백만 건 처리
UPDATE orders SET archived = true WHERE created_at < '2022-01-01';

-- 좋은 예: 배치로 나누어 처리
DO $$
DECLARE
    batch_size INT := 10000;
    affected   INT;
BEGIN
    LOOP
        UPDATE orders SET archived = true
        WHERE id IN (
            SELECT id FROM orders
            WHERE created_at < '2022-01-01'
              AND archived = false
            LIMIT batch_size
        );

        GET DIAGNOSTICS affected = ROW_COUNT;
        EXIT WHEN affected = 0;

        RAISE NOTICE '% rows updated', affected;
        PERFORM pg_sleep(0.1);  -- DB 부하 완화
    END LOOP;
END;
$$;
```

## COPY를 활용한 대량 삽입

```sql
-- CSV 파일로 직접 로드 (INSERT보다 10~100배 빠름)
COPY products (name, price, category)
FROM '/tmp/products.csv'
WITH (FORMAT CSV, HEADER true, DELIMITER ',');

-- 프로그램에서 STDIN으로 전달
COPY products (name, price) FROM STDIN WITH (FORMAT CSV);

-- psql 명령
\copy products FROM 'local_file.csv' CSV HEADER
```

## 인덱스 비활성화 후 대량 삽입

```sql
-- 인덱스를 비활성화하고 삽입한 뒤 재구축
ALTER TABLE products DISABLE TRIGGER ALL;

-- 삽입 작업...
COPY products FROM '/tmp/products.csv' CSV;

ALTER TABLE products ENABLE TRIGGER ALL;
REINDEX TABLE products;
ANALYZE products;
```

> 이 방법은 외래키 제약조건이 없을 때 안전합니다. 외래키가 있다면 트리거 비활성화 전 데이터 무결성을 확인하세요.

## INSERT ON CONFLICT — Upsert

```sql
-- 중복 시 업데이트 (upsert)
INSERT INTO products (sku, name, price)
VALUES ('SKU001', '상품명', 15000)
ON CONFLICT (sku) DO UPDATE
    SET name  = EXCLUDED.name,
        price = EXCLUDED.price,
        updated_at = NOW();

-- 중복 시 무시
INSERT INTO event_log (event_id, data)
VALUES (123, '{}')
ON CONFLICT (event_id) DO NOTHING;
```

## 임시 테이블 활용 패턴

```sql
-- 1. 임시 테이블에 원본 데이터 로드
CREATE TEMP TABLE tmp_import (LIKE products INCLUDING DEFAULTS);
COPY tmp_import FROM '/tmp/products.csv' CSV HEADER;

-- 2. 유효성 검사
DELETE FROM tmp_import WHERE price <= 0 OR name IS NULL;

-- 3. 실제 테이블로 병합
INSERT INTO products
SELECT * FROM tmp_import
ON CONFLICT (sku) DO UPDATE SET price = EXCLUDED.price;

DROP TABLE tmp_import;
```

## 페이지네이션 기반 배치 — Keyset

```sql
-- OFFSET은 데이터가 많을수록 느려짐
-- OFFSET 대신 마지막 처리 ID를 기억하는 Keyset 방식
DO $$
DECLARE
    last_id  BIGINT := 0;
    batch    BIGINT[];
BEGIN
    LOOP
        SELECT array_agg(id) INTO batch
        FROM (
            SELECT id FROM orders
            WHERE id > last_id
            ORDER BY id
            LIMIT 5000
        ) sub;

        EXIT WHEN batch IS NULL;

        -- 처리
        UPDATE orders SET processed = true WHERE id = ANY(batch);

        last_id := batch[array_length(batch, 1)];
        COMMIT;  -- 배치마다 커밋 (PL/pgSQL autonomous transaction)

        PERFORM pg_sleep(0.05);
    END LOOP;
END;
$$;
```

## 배치 작업 모니터링

```sql
-- 현재 실행 중인 긴 쿼리 확인
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < now() - INTERVAL '1 minute'
ORDER BY duration DESC;
```

## 배치 처리 체크리스트

| 항목 | 권장값 |
|------|--------|
| 배치 크기 | 1,000 ~ 50,000행 |
| 커밋 주기 | 배치마다 |
| 대기 시간 | 10~100ms (부하 조절) |
| 진행 상황 로그 | RAISE NOTICE 또는 별도 로그 테이블 |
| 재시작 지점 | 처리된 마지막 ID 저장 |
