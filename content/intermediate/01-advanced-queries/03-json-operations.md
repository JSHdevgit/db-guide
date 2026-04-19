---
title: "JSON & JSONB 활용"
category: "고급 쿼리"
order: 3
description: "PostgreSQL의 강력한 JSON 지원 — 조회, 수정, 인덱싱"
---

## JSON vs JSONB

PostgreSQL의 JSON 지원은 NoSQL 수준입니다. 관계형 데이터와 비정형 데이터를 한 DB에서 처리할 수 있습니다.

```sql
-- JSON: 원본 텍스트 그대로 저장, 키 순서/중복 유지
-- JSONB: 바이너리로 파싱, 인덱스 지원, 조회 빠름 (거의 항상 JSONB 선택)

CREATE TABLE events (
  id       BIGSERIAL PRIMARY KEY,
  type     TEXT,
  payload  JSONB,           -- 권장
  occurred TIMESTAMPTZ DEFAULT NOW()
);
```

> **팁:** `JSON`이 필요한 경우는 원본 텍스트를 그대로 보존해야 할 때(키 순서, 중복 키)뿐입니다. 나머지는 항상 `JSONB`를 쓰세요. `JSONB`는 저장 시 한 번 파싱하므로 조회가 빠르고 인덱스를 지원합니다.

## 조회 연산자

```sql
INSERT INTO events (type, payload) VALUES
('user.login', '{"user_id": 123, "ip": "1.2.3.4", "device": {"type": "mobile", "os": "iOS"}}');

-- -> : JSON 객체/배열 반환 (타입 유지)
SELECT payload -> 'device' FROM events;
-- {"type": "mobile", "os": "iOS"}

-- ->> : 텍스트 반환 (타입 변환 필요할 때)
SELECT payload ->> 'ip' FROM events;
-- "1.2.3.4"

-- 중첩 접근
SELECT payload -> 'device' ->> 'os' FROM events;
-- "iOS"

-- #>> : 경로 배열로 텍스트 반환
SELECT payload #>> '{device,os}' FROM events;

-- WHERE 조건
SELECT * FROM events WHERE payload ->> 'ip' = '1.2.3.4';
SELECT * FROM events WHERE (payload -> 'user_id')::int = 123;
```

## 포함 연산자 (@>, <@)

인덱스와 함께 쓰면 매우 빠릅니다.

```sql
-- @> : 좌변이 우변을 포함하는가
SELECT * FROM events WHERE payload @> '{"type": "mobile"}';
-- 깊은 중첩도 검색
SELECT * FROM events WHERE payload @> '{"device": {"type": "mobile"}}';

-- ? : 키가 존재하는가
SELECT * FROM events WHERE payload ? 'user_id';

-- ?| : 키 중 하나라도 있는가
SELECT * FROM events WHERE payload ?| ARRAY['user_id', 'session_id'];

-- ?& : 키 전부 있는가
SELECT * FROM events WHERE payload ?& ARRAY['user_id', 'ip'];
```

## 수정

```sql
-- 특정 키 업데이트 (jsonb_set)
-- jsonb_set(target, path, new_value, create_missing)
UPDATE events
SET payload = jsonb_set(payload, '{ip}', '"9.9.9.9"')
WHERE id = 1;

-- 중첩 키 업데이트
UPDATE events
SET payload = jsonb_set(payload, '{device, os}', '"Android"')
WHERE id = 1;

-- 키 삭제 (- 연산자)
UPDATE events SET payload = payload - 'ip' WHERE id = 1;

-- 여러 키 삭제
UPDATE events SET payload = payload - ARRAY['ip', 'session_id'];

-- 병합 (|| 연산자: 중복 키는 오른쪽 값으로 덮어씀)
UPDATE events
SET payload = payload || '{"processed": true, "processed_at": "2024-01-01"}'
WHERE type = 'user.login';
```

## GIN 인덱스

```sql
-- JSONB 전체에 GIN 인덱스 (@>, ?, ?|, ?& 연산자 지원)
CREATE INDEX idx_events_payload ON events USING GIN (payload);

-- 특정 표현식만 인덱싱 (더 작고 효율적)
CREATE INDEX idx_events_user_id ON events ((payload ->> 'user_id'));
CREATE INDEX idx_events_type ON events ((payload ->> 'type'));

-- 특정 경로에만 jsonb_path_ops 사용 (@ > 전용, 더 빠름)
CREATE INDEX idx_events_payload_ops ON events USING GIN (payload jsonb_path_ops);
```

> **인덱스 선택:** `jsonb_path_ops`는 `@>` 연산자 전용이지만 크기가 더 작고 빠릅니다. `?`, `?|`, `?&`도 필요하면 기본 GIN 인덱스를 씁니다.

## 배열 조작

```sql
-- jsonb_array_elements: 배열을 행으로 펼치기
SELECT
  id,
  jsonb_array_elements(payload -> 'tags') AS tag
FROM articles;

-- jsonb_array_elements_text: 텍스트로 펼치기
SELECT jsonb_array_elements_text('["a", "b", "c"]'::jsonb);

-- 배열 길이
SELECT jsonb_array_length(payload -> 'sizes') FROM products;
```

## 객체 순회

```sql
-- jsonb_each: 키-값 쌍으로 행 분해
SELECT key, value FROM jsonb_each('{"a": 1, "b": 2}'::jsonb);

-- jsonb_object_keys: 키 목록
SELECT jsonb_object_keys(payload) FROM events LIMIT 1;

-- jsonb_to_recordset: JSON 배열을 테이블로 변환
SELECT * FROM jsonb_to_recordset(
  '[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]'::jsonb
) AS t(name text, age int);
```

## JSON 집계

```sql
-- 행들을 JSON 배열로 집계
SELECT
  user_id,
  jsonb_agg(jsonb_build_object('id', id, 'total', total)) AS orders
FROM orders
GROUP BY user_id;

-- 행들을 JSON 객체로 집계 (key-value)
SELECT jsonb_object_agg(category, product_count)
FROM (
  SELECT category, COUNT(*) AS product_count FROM products GROUP BY category
) t;
-- 결과: {"electronics": 42, "furniture": 15, ...}
```

## 실전: 이벤트 집계

```sql
SELECT
  type,
  payload ->> 'device_type' AS device,
  COUNT(*)                   AS event_count
FROM events
WHERE occurred >= NOW() - INTERVAL '7 days'
  AND payload ? 'device_type'
GROUP BY type, payload ->> 'device_type'
ORDER BY event_count DESC;
```

> **JSONB의 한계:** JSONB는 스키마가 없어서 컬럼 타입 검사, JOIN, 인덱스 효율이 일반 컬럼보다 떨어질 수 있습니다. 자주 필터링하거나 JOIN하는 속성은 별도 컬럼으로 추출하는 것이 낫습니다. `payload ->> 'user_id'`로 자주 검색한다면 `user_id BIGINT` 컬럼을 따로 두는 것이 더 효율적입니다.
