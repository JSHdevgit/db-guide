---
title: "기본 키와 외래 키"
category: "스키마 설계"
order: 2
description: "PRIMARY KEY, FOREIGN KEY, 제약 조건으로 데이터 무결성 지키기"
---

## 기본 키 (PRIMARY KEY)

각 행을 유일하게 식별하는 컬럼입니다. NULL 불가, 중복 불가. 테이블당 하나만 가능합니다.

```sql
-- SERIAL: 자동 증가 정수 (구형 방식이지만 여전히 많이 사용)
CREATE TABLE users (
  id    SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL
);

-- BIGSERIAL: 대용량 테이블 (2억을 넘을 가능성 있으면 사용)
CREATE TABLE events (
  id         BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL
);

-- UUID: 분산 환경, 외부 노출 ID로 선호
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TABLE documents (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL
);

-- GENERATED ALWAYS (PostgreSQL 10+, SERIAL의 현대적 대안)
CREATE TABLE orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY
);
```

> **SERIAL vs UUID:** SERIAL은 단순하고 빠르며 인덱스 효율이 좋습니다. UUID는 전역 유일성을 보장해서 분산 시스템이나 ID를 URL에 노출할 때 안전합니다. 단일 DB면 BIGSERIAL, 마이크로서비스/분산 환경이면 UUID를 고려하세요. UUID v7(시간 기반)은 B-Tree 인덱스 효율도 좋아서 최근 선호됩니다.

## 외래 키 (FOREIGN KEY)

다른 테이블의 기본 키를 참조해서 두 테이블의 관계를 정의합니다. 외래 키가 있으면 참조하는 값이 반드시 부모 테이블에 존재해야 합니다.

```sql
CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  total      NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

외래 키 제약은 데이터 무결성을 DB 레벨에서 보장합니다. 애플리케이션 코드만으로 무결성을 관리하면 버그가 생겼을 때 고아 데이터(부모 없는 자식)가 쌓입니다.

> **팁:** 외래 키 컬럼에는 반드시 인덱스를 만드세요. PostgreSQL은 PRIMARY KEY와 UNIQUE에는 자동으로 인덱스를 만들지만, FOREIGN KEY에는 만들지 않습니다. `user_id`, `order_id` 같은 참조 컬럼에 인덱스가 없으면 JOIN과 DELETE가 느려집니다.

## ON DELETE 동작

부모 행이 삭제될 때 자식 행을 어떻게 처리할지 정의합니다.

```sql
-- CASCADE: 부모 삭제 시 자식도 함께 삭제
CREATE TABLE order_items (
  id         BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity   INT NOT NULL
);

-- SET NULL: 부모 삭제 시 자식의 참조 컬럼을 NULL로
CREATE TABLE posts (
  id        BIGSERIAL PRIMARY KEY,
  author_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  title     TEXT NOT NULL
);
-- 작성자 탈퇴 후에도 게시글은 남겨두고 싶을 때

-- SET DEFAULT: 부모 삭제 시 기본값으로
-- RESTRICT (기본값): 자식이 있으면 부모 삭제 불가
-- NO ACTION: RESTRICT와 유사하지만 지연 평가 가능
```

| 옵션 | 설명 | 적합한 경우 |
|---|---|---|
| CASCADE | 자식도 함께 삭제 | 주문 → 주문상품, 게시글 → 댓글 |
| SET NULL | 자식의 FK를 NULL로 | 작성자 탈퇴 후 게시글 유지 |
| RESTRICT | 자식 있으면 삭제 불가 | 실수로 부모 삭제 방지 |

## 복합 기본 키

두 컬럼의 조합이 유일한 경우 사용합니다.

```sql
-- 다대다 관계 연결 테이블
CREATE TABLE user_roles (
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  role_id BIGINT REFERENCES roles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)  -- 조합이 유일
);
```

> **팁:** 복합 기본 키는 순서가 중요합니다. `PRIMARY KEY (user_id, role_id)`는 `user_id` 기준 조회가 인덱스를 타지만, `role_id`만으로 조회할 때는 별도 인덱스가 필요합니다.

## 기타 제약 조건

```sql
CREATE TABLE products (
  id       BIGSERIAL PRIMARY KEY,
  name     VARCHAR(200) NOT NULL,
  price    NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock    INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  category VARCHAR(50) NOT NULL,
  sku      VARCHAR(50) UNIQUE,               -- NULL 허용, 값 있으면 유일
  CONSTRAINT valid_price CHECK (price < 100000000)
);
```

| 제약 | 설명 |
|---|---|
| `NOT NULL` | NULL 값 불허 |
| `UNIQUE` | 중복 값 불허 (NULL은 여러 개 허용) |
| `CHECK` | 조건식이 true인 값만 허용 |
| `DEFAULT` | 값 미제공 시 기본값 사용 |

> **팁:** `CHECK` 제약은 DB 레벨에서 비즈니스 규칙을 강제하는 좋은 방법입니다. 애플리케이션 코드에서만 검증하면 다른 경로(마이그레이션 스크립트, 데이터 수정 등)로 잘못된 데이터가 들어올 수 있습니다.
