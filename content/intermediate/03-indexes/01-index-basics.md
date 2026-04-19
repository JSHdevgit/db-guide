---
title: "인덱스 기초"
category: "인덱스"
order: 1
description: "B-Tree 인덱스의 동작 원리와 언제 인덱스를 만들어야 하는지"
---

## 인덱스란?

책의 색인처럼, 원하는 데이터를 **전체 스캔 없이** 빠르게 찾게 해주는 자료구조입니다. 인덱스가 없으면 데이터베이스는 원하는 행을 찾기 위해 모든 행을 순서대로 읽어야 합니다(Seq Scan). 인덱스가 있으면 O(log n)으로 줄어듭니다.

```sql
-- 인덱스 없이: 10만 행 전체 스캔 → 느림
SELECT * FROM orders WHERE user_id = 1234;
-- EXPLAIN: Seq Scan on orders (cost=0..5000 rows=100000)

-- 인덱스 생성 후
CREATE INDEX idx_orders_user_id ON orders(user_id);
-- EXPLAIN: Index Scan on orders using idx_orders_user_id
-- 성능 차이: 수십~수백배
```

## B-Tree 인덱스 (기본값)

PostgreSQL의 기본 인덱스 타입. 정렬된 트리 구조로 값을 저장합니다.

- **등호(`=`)**: 가장 빠름
- **범위(`>`, `<`, `BETWEEN`)**: 효과적
- **정렬(`ORDER BY`)**: 인덱스 순서와 일치하면 정렬 생략
- **IS NULL / IS NOT NULL**: 지원

```sql
-- 기본 생성
CREATE INDEX idx_users_email ON users(email);

-- 유니크 인덱스 (값 중복 방지 + 성능)
CREATE UNIQUE INDEX idx_users_email_unique ON users(email);

-- 내림차순 인덱스 (ORDER BY column DESC에 최적화)
CREATE INDEX idx_posts_created_desc ON posts(created_at DESC);

-- CONCURRENTLY: 테이블 잠금 없이 생성 (운영 중 실행 가능, 더 오래 걸림)
CREATE INDEX CONCURRENTLY idx_orders_created_at ON orders(created_at);
```

> **운영 환경에서는 항상 CONCURRENTLY:** 일반 `CREATE INDEX`는 테이블에 공유 잠금을 걸어 쓰기를 차단합니다. 운영 중인 테이블에서는 반드시 `CREATE INDEX CONCURRENTLY`를 사용하세요. 단, 트랜잭션 안에서는 사용할 수 없습니다.

## 인덱스가 효과 있는 경우

```sql
-- WHERE 조건 (선택성이 높을수록 효과적)
SELECT * FROM users WHERE email = 'kim@example.com';  -- 전체의 0.001%

-- ORDER BY (인덱스 정렬 = 정렬 생략)
SELECT * FROM posts ORDER BY created_at DESC LIMIT 20;

-- JOIN 조건 (양쪽 모두 인덱스 있으면 효율적인 조인)
SELECT * FROM orders o JOIN users u ON u.id = o.user_id;

-- 범위 검색
SELECT * FROM events WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01';
```

## 인덱스가 무시되는 경우

```sql
-- 1. 함수로 컬럼을 감싸면 인덱스 못 씀
WHERE LOWER(email) = 'kim@example.com'  -- email 인덱스 X
-- 해결: 함수 인덱스 생성
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
WHERE LOWER(email) = 'kim@example.com'  -- 인덱스 O

-- 2. 타입 불일치 (암묵적 형변환)
WHERE user_id = '1234'  -- user_id가 INT인데 문자열 비교
-- → 암묵적 형변환이 발생해 인덱스가 무시될 수 있음
-- 해결: 올바른 타입으로 비교 WHERE user_id = 1234

-- 3. LIKE 앞 와일드카드
WHERE name LIKE '%김'   -- 인덱스 X (앞이 고정되지 않음)
WHERE name LIKE '김%'   -- 인덱스 O (앞이 고정됨)

-- 4. 선택성이 낮은 컬럼 (전체의 10~20% 이상 해당)
WHERE is_active = true  -- 90%가 true라면 인덱스가 오히려 느릴 수 있음
-- → 플래너가 Seq Scan을 선택할 수 있음

-- 5. NULL 조건 (일반 B-Tree는 IS NULL 지원하지만 비효율적)
-- 해결: 부분 인덱스
CREATE INDEX idx_pending ON tasks(id) WHERE completed_at IS NULL;
```

## Hash 인덱스

등호(`=`) 비교만 사용하고 범위 검색이 전혀 없을 때 B-Tree보다 빠릅니다.

```sql
-- Hash 인덱스: = 연산자에만 최적화
CREATE INDEX idx_sessions_token ON sessions USING HASH (token);

-- B-Tree보다 작고 빠르지만 범위, ORDER BY, LIKE에는 사용 불가
-- PostgreSQL 10+부터 WAL 지원으로 크래시 안전
```

## 인덱스 현황 확인

```sql
-- 테이블의 모든 인덱스 조회
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders';

-- 인덱스 사용률 확인 (한 번도 안 쓴 인덱스는 삭제 후보)
SELECT
  indexrelname AS index_name,
  idx_scan     AS times_used,
  idx_tup_read AS tuples_read,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE relname = 'orders'
ORDER BY idx_scan DESC;

-- DB 재시작 후 통계 초기화됨 → 충분한 기간(수주) 관찰 후 판단
```

## 인덱스 삭제

```sql
DROP INDEX idx_orders_user_id;
DROP INDEX CONCURRENTLY idx_orders_user_id; -- 운영 중 잠금 없이 삭제
DROP INDEX IF EXISTS idx_orders_user_id;    -- 없어도 에러 안 남
```

> **인덱스 비용:** 인덱스는 조회를 빠르게 하지만 INSERT/UPDATE/DELETE를 느리게 합니다. 인덱스마다 별도로 업데이트되기 때문입니다. 테이블당 인덱스가 많아지면 쓰기 성능이 저하되므로, 실제로 자주 사용되는 인덱스만 유지하세요. 사용되지 않는 인덱스는 비용만 낭비합니다.
