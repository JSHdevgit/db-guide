---
title: "GIN과 GiST 인덱스"
category: "인덱스"
order: 4
description: "배열, JSON, 전문 검색, 지리 데이터에 사용하는 GIN과 GiST 인덱스의 차이와 활용법을 배웁니다."
---

## B-Tree의 한계

기본 B-Tree 인덱스는 `=`, `<`, `>` 같은 단순 비교에 최적화되어 있습니다. 다음 타입에는 맞지 않습니다.

- 배열 (`@>`, `&&`, `ANY`)
- JSONB (`@>`, `?`)
- 전문 검색 (`@@`)
- 지리 좌표 (범위, 거리)

## GIN — Generalized Inverted Index

"포함 관계" 검색에 최적화된 인덱스입니다. 하나의 값이 여러 키를 가질 때 사용합니다.

### 배열 검색

```sql
CREATE INDEX idx_articles_tags ON articles USING GIN(tags);

-- 인덱스 활용
SELECT * FROM articles WHERE tags @> ARRAY['postgresql'];     -- 포함
SELECT * FROM articles WHERE tags && ARRAY['sql', 'nosql'];   -- 교집합
SELECT * FROM articles WHERE 'database' = ANY(tags);
```

### JSONB 검색

```sql
CREATE INDEX idx_products_meta ON products USING GIN(metadata);

-- 인덱스 활용
SELECT * FROM products WHERE metadata @> '{"color": "red"}';
SELECT * FROM products WHERE metadata ? 'discount';  -- 키 존재 여부
```

### 전문 검색

```sql
CREATE INDEX idx_docs_search ON documents USING GIN(to_tsvector('english', content));
-- 또는 tsvector 열을 따로 만들어 GIN 인덱스 적용
```

## GiST — Generalized Search Tree

범위, 지리 좌표, 겹침 검색에 최적화되어 있습니다. 손실 압축(lossy)이라 재확인이 필요하지만 업데이트 성능이 GIN보다 좋습니다.

### 범위 타입

```sql
CREATE TABLE reservations (
    id       SERIAL PRIMARY KEY,
    room_id  INT,
    period   DATERANGE
);

CREATE INDEX idx_reservations_period ON reservations USING GIST(period);

-- 날짜 겹침 검색
SELECT * FROM reservations
WHERE period && '[2024-01-15, 2024-01-20)'::daterange;

-- 이미 예약된 방 찾기
SELECT room_id FROM reservations
WHERE period @> '2024-01-17'::date;
```

### PostGIS와 지리 좌표

```sql
-- PostGIS 확장 필요
CREATE EXTENSION postgis;

CREATE TABLE locations (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(200),
    geom GEOMETRY(POINT, 4326)
);

CREATE INDEX idx_locations_geom ON locations USING GIST(geom);

-- 반경 10km 내 장소 검색
SELECT name
FROM locations
WHERE ST_DWithin(
    geom,
    ST_MakePoint(127.0, 37.5)::geography,
    10000  -- 미터
);
```

## GIN vs GiST 비교

| 항목 | GIN | GiST |
|------|-----|------|
| 검색 속도 | 빠름 | 약간 느림 (재확인 필요) |
| 구축 속도 | 느림 | 빠름 |
| 업데이트 | 느림 | 빠름 |
| 크기 | 큼 | 작음 |
| 주 용도 | 배열, JSONB, 전문검색 | 범위, 지리, 겹침 |

## 인덱스 타입 선택 가이드

```sql
-- 배열 포함/교집합 검색
CREATE INDEX ON t USING GIN(array_col);

-- JSONB 키/값 검색
CREATE INDEX ON t USING GIN(jsonb_col);

-- 날짜 범위 겹침
CREATE INDEX ON t USING GIST(daterange_col);

-- 전문 검색 (읽기 많음)
CREATE INDEX ON t USING GIN(tsvector_col);

-- 전문 검색 (쓰기 많음)
CREATE INDEX ON t USING GIST(tsvector_col);
```
