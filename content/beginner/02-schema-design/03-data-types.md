---
title: "PostgreSQL 데이터 타입"
category: "스키마 설계"
order: 3
description: "숫자, 문자, 날짜, JSON, 배열 — 상황에 맞는 타입 선택하기"
---

## 숫자 타입

```sql
-- 정수
SMALLINT     -- -32,768 ~ 32,767 (2바이트, 거의 안 씀)
INTEGER      -- -2.1억 ~ 2.1억 (4바이트, 가장 많이 사용)
BIGINT       -- -9.2경 ~ 9.2경 (8바이트, 대용량 ID, 이벤트 카운트)

-- 자동 증가 (기본 키에 사용)
SERIAL       -- INTEGER + 시퀀스 자동 생성
BIGSERIAL    -- BIGINT + 시퀀스 자동 생성

-- 실수
NUMERIC(10, 2)  -- 정밀도 보장 (금액, 비율에 필수)
REAL            -- 소수점 6자리 정밀도 (부동소수점, 과학 계산)
DOUBLE PRECISION-- 소수점 15자리 정밀도
```

> **금액은 반드시 NUMERIC:** `FLOAT`이나 `REAL`은 부동소수점이어서 `0.1 + 0.2 = 0.30000000000000004` 같은 오차가 발생합니다. 금액, 세율, 환율처럼 정확도가 중요한 숫자는 `NUMERIC(정밀도, 소수점자리)`를 사용하세요. 예: `NUMERIC(15, 2)` = 최대 999,999,999,999.99원.

## 문자 타입

```sql
VARCHAR(n)   -- 최대 n자 (길이 제한 있을 때)
TEXT         -- 길이 제한 없음 (PostgreSQL에서 VARCHAR와 성능 동일)
CHAR(n)      -- 고정 길이, 짧으면 공백으로 채움 (거의 안 씀)

-- 실무 권장: 길이 제한이 의미 있을 때만 VARCHAR, 나머지는 TEXT
CREATE TABLE users (
  name         TEXT NOT NULL,
  phone        VARCHAR(20),       -- 포맷 검증 의미
  bio          TEXT,
  country_code CHAR(2)            -- 'KR', 'US' 등 고정 2자리
);
```

> **팁:** PostgreSQL에서 `TEXT`와 `VARCHAR`는 내부적으로 동일한 저장 방식을 씁니다. `VARCHAR(255)` 같은 제한은 255자 초과 입력을 DB가 거부해야 할 비즈니스 규칙이 있을 때만 사용하세요. 막연히 "나중에 제한이 필요할 것 같아서" `VARCHAR(100)`을 쓰면 나중에 컬럼 길이를 늘릴 때 번거롭습니다.

## 날짜/시간 타입

```sql
DATE         -- 날짜만 (2024-01-15)
TIME         -- 시간만 (14:30:00)
TIMESTAMP    -- 날짜+시간, 타임존 없음 (로컬 시간을 그대로 저장)
TIMESTAMPTZ  -- 날짜+시간+타임존 (UTC로 변환해서 저장, 권장)
INTERVAL     -- 시간 간격 ('7 days', '2 hours 30 minutes')
```

```sql
-- 실무 예제
CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  ordered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ship_date   DATE,                               -- 날짜만 필요
  expires_at  TIMESTAMPTZ
);

-- 날짜 연산
SELECT ordered_at + INTERVAL '7 days' AS expires_at FROM orders;
SELECT AGE(NOW(), created_at) AS account_age FROM users;
SELECT EXTRACT(YEAR FROM created_at) AS year FROM users;
SELECT DATE_TRUNC('month', created_at) AS month FROM orders;
```

> **항상 TIMESTAMPTZ 사용:** `TIMESTAMP`는 타임존 정보 없이 숫자만 저장합니다. 서버가 한국에 있을 때는 괜찮지만, 서버를 이전하거나 글로벌 서비스를 하면 시간이 틀어집니다. 항상 `TIMESTAMPTZ`를 쓰고, 앱에서 표시할 때 사용자 타임존으로 변환하세요.

## 불리언

```sql
is_active  BOOLEAN NOT NULL DEFAULT true,
is_deleted BOOLEAN NOT NULL DEFAULT false,

-- PostgreSQL에서 TRUE/FALSE, 't'/'f', '1'/'0', 'yes'/'no' 모두 허용
WHERE is_active = true
WHERE is_active  -- 불리언 컬럼은 바로 쓸 수 있음
WHERE NOT is_deleted
```

## JSON / JSONB

스키마가 자주 바뀌거나 유연한 속성 저장이 필요할 때 유용합니다.

```sql
-- JSON: 원본 텍스트 그대로 저장 (키 순서, 중복 유지)
-- JSONB: 파싱 후 바이너리 저장, 인덱스 지원, 조회 빠름 (권장)
CREATE TABLE products (
  id       BIGSERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  metadata JSONB  -- 색상, 사이즈 등 가변 속성
);

INSERT INTO products (name, metadata) VALUES
('티셔츠', '{"color": "red", "sizes": ["S", "M", "L"], "weight_kg": 0.2}');

-- JSONB 조회
SELECT metadata->>'color' FROM products;                    -- 텍스트 반환
SELECT metadata->'sizes' FROM products;                     -- JSON 배열 반환
SELECT * FROM products WHERE metadata @> '{"color": "red"}'; -- 포함 검색

-- JSONB 인덱스 (GIN)
CREATE INDEX idx_products_meta ON products USING GIN (metadata);
```

> **팁:** JSONB는 유연하지만 과도하게 사용하면 쿼리가 복잡해지고 타입 안전성이 떨어집니다. 자주 조회하거나 필터링하는 속성은 별도 컬럼으로 빼는 것이 더 낫습니다. "나중에 바뀔 수 있는 속성의 집합"에만 JSONB를 쓰세요.

## 배열 타입

```sql
CREATE TABLE posts (
  id   BIGSERIAL PRIMARY KEY,
  tags TEXT[]
);

INSERT INTO posts (tags) VALUES (ARRAY['sql', 'postgresql', 'database']);

-- 배열 조회
SELECT * FROM posts WHERE 'sql' = ANY(tags);         -- 포함 여부
SELECT * FROM posts WHERE tags @> ARRAY['sql'];       -- 배열 포함
SELECT * FROM posts WHERE tags && ARRAY['sql', 'go']; -- 교집합 (하나라도 포함)
SELECT unnest(tags) AS tag FROM posts;                -- 배열을 행으로 펼치기
```

> **배열 vs 연결 테이블:** 태그가 많고 태그별 통계, 인기 태그 조회 등이 필요하다면 별도 `tags` 테이블과 연결 테이블이 더 낫습니다. 배열은 간단한 다중 선택(언어 설정 등)에 적합합니다.

## ENUM 타입

값의 범위가 고정되어 있을 때 사용합니다.

```sql
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled');

CREATE TABLE orders (
  id     BIGSERIAL PRIMARY KEY,
  status order_status NOT NULL DEFAULT 'pending'
);

-- 잘못된 값 삽입 시 에러
INSERT INTO orders (status) VALUES ('unknown');
-- ERROR: invalid input value for enum order_status: "unknown"
```

> **주의:** ENUM 타입에 값을 추가하는 건 쉽지만(`ALTER TYPE order_status ADD VALUE 'refunded'`), 값을 삭제하거나 이름을 바꾸는 건 번거롭습니다. 자주 바뀔 수 있는 값은 ENUM 대신 CHECK 제약이나 별도 참조 테이블을 고려하세요.

## UUID 타입

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- URL에 노출해도 순서 예측이 불가능
-- 분산 시스템에서 여러 노드가 독립적으로 ID 생성 가능
```
