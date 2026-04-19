---
title: "복합 인덱스와 부분 인덱스"
category: "인덱스"
order: 2
description: "여러 컬럼 인덱스와 조건부 인덱스로 성능 극대화하기"
---

## 복합 인덱스

여러 컬럼을 하나의 인덱스로 묶습니다. 여러 컬럼을 함께 WHERE 조건으로 쓸 때 단일 인덱스 두 개보다 효율적입니다.

```sql
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

### 컬럼 순서가 중요합니다

복합 인덱스는 **왼쪽부터(선두 컬럼부터)** 순차적으로 사용합니다. 선두 컬럼이 없는 조건은 인덱스를 활용하지 못합니다.

```sql
-- (user_id, status) 복합 인덱스 기준

-- 인덱스 사용 O
WHERE user_id = 1
WHERE user_id = 1 AND status = 'pending'
WHERE user_id = 1 AND status IN ('pending', 'processing')

-- 인덱스 사용 X (선두 컬럼 없음)
WHERE status = 'pending'

-- 일부만 사용 (user_id만 인덱스, status는 필터로 처리)
-- → 위의 경우보다는 낫지만 전체 활용은 못함
```

> **선두 컬럼 선택 기준:** 선택성이 높은(고유 값이 많은) 컬럼을 앞에 두세요. `user_id`는 고유 값이 많고, `status`는 값이 5개 정도밖에 없다면 `(user_id, status)` 순서가 맞습니다. 쿼리 패턴도 중요합니다 — `user_id`만 있는 쿼리가 많다면 더더욱 `user_id`를 앞에 두어야 합니다.

### Covering Index (Index-Only Scan)

`SELECT` 컬럼까지 인덱스에 포함해서 테이블 접근 자체를 없앱니다. 인덱스만으로 쿼리를 완전히 처리하는 것을 "Index Only Scan"이라고 합니다.

```sql
-- 이 쿼리를
SELECT user_id, status, total FROM orders WHERE user_id = 1;

-- 이 인덱스로 커버: user_id (검색) + status, total (반환값)
CREATE INDEX idx_orders_cover ON orders(user_id, status, total);
-- EXPLAIN에서 "Index Only Scan" 확인
```

```sql
-- INCLUDE: 검색에는 사용 안 하고 반환값으로만 포함 (PostgreSQL 11+)
-- 인덱스 크기를 줄이면서 커버링 인덱스 효과
CREATE INDEX idx_orders_user ON orders(user_id)
  INCLUDE (status, total, created_at);
```

> **INCLUDE의 장점:** `INCLUDE`로 추가된 컬럼은 인덱스 정렬에 사용되지 않으므로, 인덱스 구조가 간단해집니다. 넓은 범위 검색에서 테이블 읽기를 줄이고 싶을 때 유용합니다.

## 부분 인덱스 (Partial Index)

`WHERE` 조건을 지정해서 인덱스 크기를 줄이고 성능을 높입니다. "자주 쓰는 부분집합"만 인덱싱하는 전략입니다.

```sql
-- 미처리 주문만 인덱싱 (전체의 5%라면 인덱스가 훨씬 작고 빠름)
CREATE INDEX idx_orders_pending ON orders(created_at)
WHERE status = 'pending';

-- 삭제 안 된 사용자만 (소프트 삭제 패턴에서 일반적)
CREATE INDEX idx_users_active_email ON users(email)
WHERE deleted_at IS NULL;

-- 최근 1년 데이터만 핫 인덱스
CREATE INDEX idx_events_recent ON events(type, occurred_at)
WHERE occurred_at >= '2024-01-01';
```

### 부분 인덱스가 사용되려면

쿼리의 `WHERE`가 인덱스의 `WHERE`를 **포함**해야 합니다. 인덱스의 조건보다 좁은 조건을 써야 합니다.

```sql
-- idx_orders_pending: WHERE status = 'pending'

-- 사용 O: status = 'pending' 포함
SELECT * FROM orders WHERE status = 'pending' AND created_at > '2024-06-01';

-- 사용 X: status 조건 없음
SELECT * FROM orders WHERE created_at > '2024-06-01';
```

## 표현식 인덱스 (함수 인덱스)

컬럼 값에 함수를 적용한 결과로 인덱스를 만듭니다. 쿼리에서 함수를 쓰는 경우에 필수입니다.

```sql
-- 대소문자 구분 없는 이메일 검색
CREATE INDEX idx_users_email_ci ON users(LOWER(email));
-- 쿼리에서도 반드시 같은 표현식 사용
WHERE LOWER(email) = 'kim@example.com'

-- 날짜만 (시간 제거)
CREATE INDEX idx_orders_date ON orders(DATE(created_at));
WHERE DATE(created_at) = '2024-01-15'

-- JSON 필드
CREATE INDEX idx_products_brand ON products((metadata->>'brand'));
WHERE metadata->>'brand' = 'Samsung'

-- 계산 결과
CREATE INDEX idx_products_discounted ON products((price * 0.9))
WHERE is_on_sale = true;
```

## 인덱스 선택 가이드

| 상황 | 추천 인덱스 |
|---|---|
| 단일 컬럼 등호/범위 검색 | 단순 B-Tree |
| 여러 컬럼 WHERE | 복합 인덱스 (선두 컬럼 주의) |
| SELECT 컬럼도 인덱스에 포함하고 싶을 때 | Covering Index / INCLUDE |
| 특정 값에 집중된 쿼리 | 부분 인덱스 |
| 함수/LOWER() 사용 | 표현식 인덱스 |
| JSON/배열 검색 (`@>`, `?`) | GIN 인덱스 |
| 지리 데이터 | GiST 인덱스 |
| 로그/이벤트 시계열 (INSERT 순서 = 시간 순) | BRIN 인덱스 |
| 등호만, 범위 없음 | Hash 인덱스 |

> **인덱스 최적화 프로세스:** 인덱스를 막무가내로 추가하지 마세요. (1) `pg_stat_statements`로 느린 쿼리를 찾고, (2) `EXPLAIN ANALYZE`로 Seq Scan을 찾고, (3) 해당 쿼리의 WHERE/JOIN/ORDER BY 패턴에 맞는 인덱스를 추가하는 순서로 접근하세요.
