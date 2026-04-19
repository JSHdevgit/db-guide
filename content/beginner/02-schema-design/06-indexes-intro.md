---
title: "인덱스 입문 — 검색을 빠르게"
category: "스키마 설계"
order: 6
description: "인덱스의 개념과 원리를 이해하고 기본적인 인덱스를 생성하는 방법을 배웁니다."
---

## 인덱스란?

인덱스(Index)는 책의 색인처럼 데이터를 빠르게 찾기 위한 별도의 자료구조입니다. 인덱스 없이는 테이블 전체를 처음부터 끝까지 스캔(Sequential Scan)해야 합니다.

## 인덱스가 없을 때

```sql
-- 100만 건의 users 테이블에서 이메일로 검색
SELECT * FROM users WHERE email = 'user@example.com';
-- 인덱스 없음: 100만 건 전체 스캔 → 느림
```

## 인덱스 생성

```sql
-- 기본 인덱스
CREATE INDEX idx_users_email ON users(email);

-- 유니크 인덱스 (데이터 유일성 보장)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 이제 이메일 검색이 빨라짐
SELECT * FROM users WHERE email = 'user@example.com';
-- 인덱스 사용: B-tree 탐색 → 빠름
```

## B-Tree 인덱스 (기본값)

PostgreSQL의 기본 인덱스 타입입니다. `=`, `<`, `>`, `BETWEEN`, `LIKE 'abc%'` 연산에 효과적입니다.

```sql
CREATE INDEX idx_orders_created ON orders(created_at);

-- 범위 검색에도 효과적
SELECT * FROM orders
WHERE created_at BETWEEN '2024-01-01' AND '2024-01-31';
```

## 인덱스를 사용하면 좋은 열

- `WHERE` 절에 자주 사용되는 열
- `JOIN ON` 조건의 열 (FK 열)
- `ORDER BY`에 사용되는 열
- 카디널리티(고유 값 수)가 높은 열

## 인덱스가 도움이 안 되는 경우

```sql
-- 선택성이 낮은 열 (예: boolean)
CREATE INDEX idx_users_active ON users(is_active);
-- is_active가 true/false 둘뿐이라면 비효율적

-- 함수를 적용한 열
SELECT * FROM users WHERE LOWER(name) = 'john';
-- idx_users_name 인덱스는 사용 안 됨
-- 해결: 함수 인덱스
CREATE INDEX idx_users_name_lower ON users(LOWER(name));
```

## 인덱스 목록 확인

```sql
\di                          -- 현재 스키마의 모든 인덱스
\d users                     -- users 테이블의 인덱스 포함 구조
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'users';
```

## 인덱스 삭제

```sql
DROP INDEX idx_users_email;
DROP INDEX IF EXISTS idx_users_email;
```

## 인덱스의 비용

인덱스는 읽기를 빠르게 하지만, `INSERT`, `UPDATE`, `DELETE` 시 인덱스도 함께 갱신되어 쓰기가 느려집니다. 또한 추가 저장 공간을 사용합니다.

> 인덱스는 많을수록 좋지 않습니다. 실제 쿼리 패턴을 분석하고 필요한 곳에만 추가하세요.
