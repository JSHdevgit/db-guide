---
title: "제약조건 — UNIQUE, CHECK, NOT NULL"
category: "스키마 설계"
order: 4
description: "데이터 무결성을 보장하는 제약조건의 종류와 사용법을 익힙니다."
---

## 제약조건이란?

제약조건(Constraint)은 테이블에 저장되는 데이터가 특정 규칙을 만족하도록 강제하는 메커니즘입니다. 애플리케이션 레벨의 검증보다 신뢰성이 높습니다.

## NOT NULL

값이 반드시 존재해야 함을 보장합니다.

```sql
CREATE TABLE users (
    id    SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,  -- 이메일은 필수
    name  VARCHAR(100) NOT NULL,
    bio   TEXT                    -- 소개는 선택
);

-- 기존 열에 추가
ALTER TABLE users ALTER COLUMN name SET NOT NULL;
```

## UNIQUE

열(또는 열 조합)의 값이 테이블 전체에서 유일해야 합니다.

```sql
CREATE TABLE users (
    id       SERIAL PRIMARY KEY,
    email    VARCHAR(255) UNIQUE,      -- 단일 열 유니크
    username VARCHAR(50)  UNIQUE
);

-- 복합 유니크: 두 열의 조합이 유일
CREATE TABLE team_members (
    team_id   INT,
    user_id   INT,
    UNIQUE (team_id, user_id)
);
```

> UNIQUE 제약조건은 내부적으로 인덱스를 생성하므로 해당 열의 조회 성능도 향상됩니다. NULL은 UNIQUE 비교에서 서로 다른 값으로 취급됩니다.

## CHECK

열 값이 특정 조건을 만족하는지 검증합니다.

```sql
CREATE TABLE products (
    id       SERIAL PRIMARY KEY,
    name     VARCHAR(100) NOT NULL,
    price    NUMERIC(10, 2) CHECK (price >= 0),
    stock    INT CHECK (stock >= 0),
    discount NUMERIC(5, 2) CHECK (discount BETWEEN 0 AND 100)
);

-- 여러 열을 참조하는 CHECK
CREATE TABLE orders (
    id          SERIAL PRIMARY KEY,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);
```

## 제약조건 이름 지정

```sql
CREATE TABLE employees (
    id     SERIAL,
    email  VARCHAR(255),
    salary NUMERIC(12, 2),

    CONSTRAINT pk_employees     PRIMARY KEY (id),
    CONSTRAINT uq_emp_email     UNIQUE (email),
    CONSTRAINT ck_positive_sal  CHECK (salary > 0)
);
```

이름을 지정하면 나중에 오류 메시지 파악 및 삭제가 쉬워집니다.

## 제약조건 추가·삭제

```sql
-- 추가
ALTER TABLE products ADD CONSTRAINT ck_price_positive CHECK (price >= 0);

-- 삭제
ALTER TABLE products DROP CONSTRAINT ck_price_positive;

-- 일시 비활성화 (NOT NULL 제외)
ALTER TABLE products DISABLE TRIGGER ALL; -- 주의: 트리거 비활성화와 다름
-- CHECK 비활성화는 NOT VALID 옵션 활용
```

## 제약조건 위반 시 오류

```sql
INSERT INTO products (name, price) VALUES ('테스트', -1000);
-- ERROR: new row for relation "products" violates check constraint "ck_price_positive"
```

## 요약

| 제약조건 | 목적 | NULL 허용 |
|----------|------|-----------|
| NOT NULL | 빈 값 방지 | 아니오 |
| UNIQUE | 중복 방지 | 예 (NULL끼리는 중복 허용) |
| CHECK | 범위/형식 검증 | 예 (NULL이면 CHECK 통과) |
| PRIMARY KEY | 행 식별자 | 아니오 |
| FOREIGN KEY | 참조 무결성 | 예 |
