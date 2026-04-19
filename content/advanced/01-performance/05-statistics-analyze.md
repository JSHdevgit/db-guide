---
title: "통계 정보와 ANALYZE"
category: "성능 최적화"
order: 5
description: "PostgreSQL 플래너가 사용하는 통계 정보의 구조와 ANALYZE로 통계를 갱신하는 방법을 깊이 이해합니다."
---

## 플래너가 통계를 쓰는 이유

쿼리 플래너(Query Planner)는 실행 계획을 선택하기 위해 **행 수, 값 분포, 상관관계** 등의 통계를 사용합니다. 통계가 오래되면 잘못된 실행 계획이 선택됩니다.

## pg_statistic / pg_stats

```sql
-- 테이블별 통계 요약 (읽기 쉬운 뷰)
SELECT
    attname,
    null_frac,         -- NULL 비율
    avg_width,         -- 평균 바이트 수
    n_distinct,        -- 고유 값 수 (음수: 비율)
    most_common_vals,  -- 가장 많은 값 목록
    most_common_freqs, -- 빈도
    histogram_bounds   -- 히스토그램 경계
FROM pg_stats
WHERE tablename = 'orders' AND attname = 'status';
```

## ANALYZE 실행

```sql
-- 전체 DB 통계 갱신
ANALYZE;

-- 특정 테이블
ANALYZE orders;

-- 특정 열만
ANALYZE orders (status, created_at);

-- VACUUM과 함께
VACUUM ANALYZE orders;
```

## statistics_target — 통계 정밀도 조정

`statistics_target`은 히스토그램 버킷 수와 most_common_vals 개수를 결정합니다. 기본값은 100입니다.

```sql
-- 시스템 전체 기본값 조정 (postgresql.conf)
-- default_statistics_target = 100

-- 특정 열에만 높은 정밀도 설정 (카디널리티 높은 열)
ALTER TABLE orders ALTER COLUMN customer_id SET STATISTICS 500;

-- 낮은 카디널리티 열은 낮게 설정해 ANALYZE 속도 향상
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 10;

-- 변경 후 ANALYZE 필수
ANALYZE orders;
```

## 잘못된 통계로 인한 문제 진단

```sql
-- 실제 행 수 vs 플래너 예측 비교
EXPLAIN (ANALYZE, FORMAT JSON)
SELECT * FROM orders WHERE status = 'pending';

-- 출력에서 확인
-- "Plan Rows": 150       ← 플래너 예측
-- "Actual Rows": 48000   ← 실제 행 수 → 큰 차이 = 통계 문제
```

## 확장 통계 — CREATE STATISTICS

열 간의 상관관계를 통계에 반영합니다.

```sql
-- city와 zip_code는 강한 상관관계 (같은 도시면 같은 우편번호)
-- 기본 통계는 각 열을 독립으로 가정 → 행 수 예측 오류

CREATE STATISTICS stat_city_zip ON city, zip_code FROM addresses;
ANALYZE addresses;

-- 통계 확인
SELECT * FROM pg_statistic_ext;
```

## 자동 통계 갱신 — autovacuum

```sql
-- autovacuum 통계 갱신 트리거 조건 (postgresql.conf)
autovacuum_analyze_threshold = 50       -- 최소 변경 행 수
autovacuum_analyze_scale_factor = 0.1   -- 테이블의 10% 변경 시

-- 테이블별 오버라이드 (대형 테이블에 유용)
ALTER TABLE events SET (
    autovacuum_analyze_threshold = 1000,
    autovacuum_analyze_scale_factor = 0.01  -- 1%만 변경해도 ANALYZE
);
```

## 실시간 통계 갱신 확인

```sql
-- 마지막 ANALYZE 시점
SELECT
    relname,
    last_analyze,
    last_autoanalyze,
    n_live_tup,
    n_dead_tup,
    n_mod_since_analyze
FROM pg_stat_user_tables
ORDER BY n_mod_since_analyze DESC;
```

> `n_mod_since_analyze`가 크고 `last_analyze`가 오래되었다면 수동 `ANALYZE`를 실행하세요.

## 통계 리셋

```sql
-- 특정 테이블 통계 리셋
SELECT pg_stat_reset_single_table_counts('orders'::regclass);

-- 전체 통계 리셋 (주의: 모든 누적 데이터 초기화)
SELECT pg_stat_reset();
```
