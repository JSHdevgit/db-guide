---
title: "테이블 파티셔닝"
category: "운영 관리"
order: 2
description: "대용량 테이블을 파티션으로 분할해서 성능과 관리 효율 높이기"
---

## 파티셔닝이란?

하나의 큰 테이블을 여러 물리적 파티션으로 나눕니다. 쿼리 시 해당 파티션만 스캔(Partition Pruning)하므로 성능이 향상됩니다. 특히 시계열 데이터에서 "최근 3개월 데이터만" 같은 쿼리 패턴에 매우 효과적입니다.

파티셔닝은 단순히 성능만의 문제가 아닙니다. 오래된 파티션을 `DROP TABLE`로 삭제하면 수백만 행의 DELETE보다 수천 배 빠릅니다. 데이터 보존 정책 구현에도 매우 유용합니다.

```sql
-- 파티션 방식 선택:
-- Range: 날짜/시간, 숫자 범위 (로그, 이벤트 → 가장 일반적)
-- List: 특정 값 목록 (지역, 상태)
-- Hash: 균등 분산 (user_id로 샤딩 효과)
```

## Range 파티셔닝 (날짜 기반)

```sql
-- 부모 테이블 생성 (파티션 기준 정의)
CREATE TABLE events (
  id          BIGSERIAL,
  type        TEXT NOT NULL,
  payload     JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (occurred_at);

-- 월별 파티션 생성 (FROM 포함, TO 미포함)
CREATE TABLE events_2024_01 PARTITION OF events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE events_2024_02 PARTITION OF events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- 기본 파티션 (범위 밖 데이터 수신)
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- 각 파티션에 인덱스 (부모에 만들면 자동 전파됨, PostgreSQL 11+)
CREATE INDEX ON events(occurred_at);  -- 부모에 만들면 모든 파티션에 자동 생성
CREATE INDEX ON events(type, occurred_at);
```

> **기본 파티션 중요성:** `DEFAULT` 파티션이 없으면 범위 밖 데이터 INSERT 시 에러가 발생합니다. 항상 `DEFAULT` 파티션을 만들어두고, 정기적으로 데이터를 확인해서 새 파티션으로 이동시키세요.

## 쿼리 시 Partition Pruning

파티셔닝의 핵심 이점입니다. WHERE 조건에 파티션 키가 있으면 해당 파티션만 스캔합니다.

```sql
-- 이 쿼리는 events_2024_01 파티션만 스캔
SELECT * FROM events
WHERE occurred_at BETWEEN '2024-01-01' AND '2024-01-31';

-- EXPLAIN으로 Partition Pruning 확인
EXPLAIN SELECT * FROM events
WHERE occurred_at >= '2024-01-01' AND occurred_at < '2024-02-01';
-- → Append → Seq Scan on events_2024_01 (다른 파티션 없음)

-- 주의: 파티션 키가 없는 조건은 모든 파티션 스캔
EXPLAIN SELECT * FROM events WHERE type = 'login';
-- → Append → Seq Scan on events_2024_01, events_2024_02, ... (전체 스캔)
```

## List 파티셔닝

```sql
CREATE TABLE orders (
  id         BIGSERIAL,
  region     TEXT NOT NULL,
  total      NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY LIST (region);

CREATE TABLE orders_kr PARTITION OF orders FOR VALUES IN ('KR', 'KP');
CREATE TABLE orders_us PARTITION OF orders FOR VALUES IN ('US', 'CA', 'MX');
CREATE TABLE orders_eu PARTITION OF orders FOR VALUES IN ('DE', 'FR', 'UK', 'IT');
CREATE TABLE orders_other PARTITION OF orders DEFAULT;
```

## Hash 파티셔닝

균등 분산이 필요할 때 씁니다. 특정 파티션에 데이터가 몰리지 않습니다.

```sql
-- user_id로 4개 파티션에 균등 분산
CREATE TABLE user_events (
  id         BIGSERIAL,
  user_id    BIGINT NOT NULL,
  event_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
) PARTITION BY HASH (user_id);

CREATE TABLE user_events_0 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE user_events_1 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE user_events_2 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE user_events_3 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

> **Hash 파티셔닝 주의:** 파티션 수를 나중에 변경하기 매우 어렵습니다. 처음 설계 시 충분히 고려하세요. 변경이 필요하면 새 파티션 테이블을 만들고 데이터를 마이그레이션해야 합니다.

## 파티션 자동 생성 (cron 패턴)

```sql
-- 함수로 다음 달 파티션 자동 생성
CREATE OR REPLACE FUNCTION create_next_month_partition()
RETURNS void AS $$
DECLARE
  next_month     DATE := DATE_TRUNC('month', NOW() + INTERVAL '1 month');
  partition_name TEXT;
BEGIN
  partition_name := 'events_' || TO_CHAR(next_month, 'YYYY_MM');

  -- 이미 존재하면 건너뜀
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF events
       FOR VALUES FROM (%L) TO (%L)',
      partition_name,
      next_month,
      next_month + INTERVAL '1 month'
    );
    RAISE NOTICE '파티션 생성: %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- pg_cron으로 매월 25일에 다음 달 파티션 생성
-- SELECT cron.schedule('0 0 25 * *', 'SELECT create_next_month_partition()');
```

## 파티션 삭제 (데이터 보존 정책)

```sql
-- 파티션 분리 (데이터 유지, 부모에서 제외 — 아카이브 목적)
ALTER TABLE events DETACH PARTITION events_2022_01;
-- detach 후 events_2022_01은 독립 테이블로 남음

-- DETACH CONCURRENTLY: 잠금 없이 분리 (PostgreSQL 14+)
ALTER TABLE events DETACH PARTITION events_2022_01 CONCURRENTLY;

-- 파티션 완전 삭제 (2년 이상 된 데이터 삭제)
DROP TABLE events_2022_01;
-- 수백만 행 DELETE보다 훨씬 빠름 (메타데이터만 변경)
```

## 파티셔닝 현황 확인

```sql
-- 파티션 목록과 크기
SELECT
  child.relname AS partition_name,
  pg_size_pretty(pg_relation_size(child.oid)) AS size,
  pg_size_pretty(pg_total_relation_size(child.oid)) AS total_size
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child  ON pg_inherits.inhrelid  = child.oid
WHERE parent.relname = 'events'
ORDER BY child.relname;
```

> **파티셔닝 도입 기준:** 파티셔닝은 복잡성을 추가합니다. 단순히 크다는 이유만으로 도입하지 마세요. (1) 날짜 기반으로 대부분 쿼리하는 패턴, (2) 오래된 데이터를 정기적으로 삭제해야 하는 정책, (3) 단일 테이블이 수억 건 이상일 때 고려하세요.
