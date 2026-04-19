---
title: "데이터베이스와 테이블 만들기"
category: "PostgreSQL 기초"
order: 3
description: "PostgreSQL에서 데이터베이스와 테이블을 생성·수정·삭제하는 방법을 익힙니다."
---

## 데이터베이스 생성

```sql
-- psql에서 실행
CREATE DATABASE myapp
    ENCODING    'UTF8'
    LC_COLLATE  'ko_KR.UTF-8'
    LC_CTYPE    'ko_KR.UTF-8'
    TEMPLATE    template0;
```

```bash
# 터미널에서 실행
createdb -U postgres myapp
```

> 한국어 데이터를 저장한다면 인코딩을 `UTF8`로 설정하세요. 생성 후에는 변경할 수 없습니다.

## 데이터베이스 목록 확인

```sql
\l          -- 또는 \list
SELECT datname FROM pg_database;
```

## 데이터베이스 연결

```sql
\c myapp    -- psql에서 데이터베이스 전환
```

## 테이블 생성

```sql
CREATE TABLE products (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200)   NOT NULL,
    description TEXT,
    price       NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    stock       INT            DEFAULT 0,
    created_at  TIMESTAMP      DEFAULT NOW(),
    updated_at  TIMESTAMP      DEFAULT NOW()
);
```

## 데이터 타입 선택 가이드

| 용도 | 권장 타입 |
|------|-----------|
| 자동 증가 정수 ID | `SERIAL` 또는 `BIGSERIAL` |
| 짧은 문자열 (제한 있음) | `VARCHAR(n)` |
| 긴 텍스트 | `TEXT` |
| 정수 | `INT` (`INTEGER`) |
| 소수 (정확도 중요) | `NUMERIC(p, s)` |
| 소수 (속도 중요) | `FLOAT8` (`DOUBLE PRECISION`) |
| 날짜 | `DATE` |
| 날짜+시간 | `TIMESTAMP` 또는 `TIMESTAMPTZ` |
| 참/거짓 | `BOOLEAN` |
| UUID | `UUID` |

## 테이블 수정 — ALTER TABLE

```sql
-- 열 추가
ALTER TABLE products ADD COLUMN category VARCHAR(100);

-- 열 타입 변경
ALTER TABLE products ALTER COLUMN name TYPE VARCHAR(300);

-- 열 기본값 설정
ALTER TABLE products ALTER COLUMN stock SET DEFAULT 0;

-- 열 이름 변경
ALTER TABLE products RENAME COLUMN name TO product_name;

-- 열 삭제
ALTER TABLE products DROP COLUMN description;
```

## 테이블 삭제

```sql
DROP TABLE products;                -- 테이블 삭제 (의존하는 객체 있으면 오류)
DROP TABLE products CASCADE;        -- 의존하는 뷰·제약조건도 함께 삭제
DROP TABLE IF EXISTS products;      -- 존재하지 않아도 오류 없음
TRUNCATE TABLE products;            -- 데이터만 전체 삭제 (구조 유지, 빠름)
```

## 테이블 목록 확인

```sql
\dt                  -- 현재 스키마의 테이블 목록
\d products          -- 특정 테이블 구조 확인
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```
