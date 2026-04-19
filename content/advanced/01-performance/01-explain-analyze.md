---
title: "EXPLAIN ANALYZE 읽는 법"
category: "성능 튜닝"
order: 1
description: "쿼리 실행 계획을 분석해서 병목을 찾는 방법"
---

## EXPLAIN이란?

PostgreSQL이 쿼리를 **어떻게 실행할 계획인지** 보여주는 명령입니다. `EXPLAIN`만 쓰면 예상 계획, `EXPLAIN ANALYZE`를 붙이면 실제로 실행하면서 정확한 시간도 측정합니다.

```sql
EXPLAIN ANALYZE
SELECT u.name, COUNT(o.id) AS order_count
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
GROUP BY u.id, u.name
ORDER BY order_count DESC
LIMIT 10;
```

## 출력 읽는 법

```
Limit  (cost=1500.00..1500.02 rows=10 width=40)
         (actual time=89.412..89.415 rows=10 loops=1)
  -> Sort  (cost=1500.00..1512.50 rows=5000 width=40)
            (actual time=89.405..89.408 rows=10 loops=1)
       Sort Key: (count(o.id)) DESC
       Sort Method: top-N heapsort  Memory: 25kB
       -> HashAggregate  (cost=1200.00..1275.00 rows=5000)
                          (actual time=81.234..85.100 rows=5000)
            -> Hash Left Join  (cost=50.00..1100.00 rows=20000)
                                (actual time=0.521..45.123 rows=20000)
                  Hash Cond: (o.user_id = u.id)
                  -> Seq Scan on orders  (cost=0.00..500.00 rows=20000)
                                          (actual time=0.012..12.340 rows=20000)
                  -> Hash  (cost=40.00..40.00 rows=5000)
                            (actual time=0.402..0.402 rows=5000)
                        -> Seq Scan on users  (cost=0.00..40.00 rows=5000)
                                               (actual time=0.008..0.201 rows=5000)
Planning Time: 0.823 ms
Execution Time: 89.512 ms
```

### 핵심 항목 해석

| 항목 | 의미 |
|---|---|
| `cost=X..Y` | 플래너 예상 비용 (X: 첫 행 출력 전 비용, Y: 전체 완료 비용) |
| `actual time=X..Y` | 실제 실행 시간(ms) |
| `rows=N` | 실제 처리한 행 수 |
| `loops=N` | 이 노드가 반복 실행된 횟수 |
| `Seq Scan` | 전체 테이블 순차 스캔 — 인덱스 없음 |
| `Index Scan` | 인덱스로 위치 찾고 테이블 읽기 |
| `Index Only Scan` | 인덱스만으로 처리 (테이블 접근 없음) |
| `Bitmap Heap Scan` | 인덱스로 비트맵 만들고 일괄 테이블 읽기 |

### cost 단위 이해

`cost`는 임의의 비용 단위입니다. 절대값보다 **노드 간 상대적 비교**에 사용하세요. `seq_page_cost = 1.0` 기준으로 계산됩니다. 예상 cost와 actual time이 크게 다르면 테이블 통계가 오래된 것입니다 — `ANALYZE` 실행을 고려하세요.

## 병목 찾는 방법

1. **가장 안쪽(들여쓰기 깊은) 노드부터** 읽습니다 — 실제 실행 순서
2. `actual time`이 큰 노드를 찾습니다
3. `Seq Scan`이면서 `rows`가 많으면 인덱스 후보
4. **예상 rows와 실제 rows 차이가 크면** 통계 문제 → `ANALYZE` 실행

```sql
-- rows 예상치 오차 계산
-- rows=10000 (예상)  actual rows=1 (실제)
-- → 플래너가 잘못된 계획을 세울 수 있음
-- → ANALYZE tablename; 으로 통계 갱신
```

## 실용 예제: 느린 쿼리 개선

```sql
-- 1단계: 느린 쿼리 실행 계획 확인
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 1234;
-- Seq Scan on orders (cost=0..5000 actual time=150..200) ← 느림

-- 2단계: 인덱스 생성
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- 3단계: 다시 확인
EXPLAIN ANALYZE
SELECT * FROM orders WHERE user_id = 1234;
-- Index Scan on orders (cost=0.3..10 actual time=0.1..0.5) ← 빠름
```

## EXPLAIN 옵션

```sql
-- 버퍼 사용량 포함 (캐시 히트율 확인)
EXPLAIN (ANALYZE, BUFFERS)
SELECT ...;
-- "Buffers: shared hit=50 read=10"
-- hit: 메모리 캐시에서 읽음 (빠름)
-- read: 디스크에서 읽음 (느림)

-- 전체 정보 출력
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, FORMAT TEXT)
SELECT ...;

-- JSON 형태로 보기 (pgAdmin, explain.depesz.com에서 시각화 가능)
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ...;
```

> **시각화 도구:** `EXPLAIN (FORMAT JSON)` 결과를 [explain.depesz.com](https://explain.depesz.com) 또는 [explain.dalibo.com](https://explain.dalibo.com)에 붙여넣으면 트리 형태로 시각화해줍니다. 복잡한 실행 계획을 분석할 때 매우 유용합니다.

## UPDATE/DELETE에서 EXPLAIN ANALYZE

```sql
-- 반드시 트랜잭션으로 감싸서 실제 변경 방지
BEGIN;
EXPLAIN ANALYZE DELETE FROM old_logs WHERE created_at < '2023-01-01';
-- 실행 계획과 영향받을 행 수 확인
ROLLBACK;  -- 실제 삭제하지 않고 롤백
```

> **주의:** `EXPLAIN ANALYZE`는 실제로 쿼리를 실행합니다. SELECT는 영향이 없지만, INSERT/UPDATE/DELETE는 실제 데이터가 변경됩니다. 반드시 트랜잭션으로 감싸고 ROLLBACK하세요.

## 자주 보이는 느린 패턴

| EXPLAIN 출력 | 의미 | 해결 방법 |
|---|---|---|
| `Seq Scan` + rows 많음 | 인덱스 없음 | WHERE/JOIN 컬럼에 인덱스 추가 |
| `Sort` + 큰 `actual time` | 정렬 비용 높음 | ORDER BY 컬럼에 인덱스 |
| `Hash Join` + `Batches=N (N>1)` | 해시가 메모리 초과 | `work_mem` 증가 |
| 예상 rows 오차 큼 | 통계 오래됨 | `ANALYZE tablename` |
| `Nested Loop` + 큰 loops | N+1 쿼리 | JOIN 방식 재검토 |
