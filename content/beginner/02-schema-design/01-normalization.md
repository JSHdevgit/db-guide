---
title: "정규화란 무엇인가"
category: "스키마 설계"
order: 1
description: "데이터 중복을 줄이는 정규화 원칙 1NF ~ 3NF"
---

## 왜 스키마 설계가 중요한가

나쁜 스키마는 처음엔 잘 동작합니다. 문제는 나중에 옵니다. 데이터 중복, 업데이트 이상, 삭제 이상 — 이 세 가지가 나쁜 설계의 증상이에요.

예를 들어, 주문 테이블에 고객 이름을 직접 저장했다면:
- 고객이 이름을 바꾸면 모든 주문 행을 수정해야 합니다 (업데이트 이상)
- 고객의 마지막 주문을 삭제하면 고객 정보도 사라집니다 (삭제 이상)
- 같은 고객 정보가 수천 개 주문 행에 중복 저장됩니다 (삽입 이상)

**정규화(Normalization)**는 이런 이상 현상을 방지하는 설계 원칙입니다.

## 1NF: 원자값만 저장

각 셀에는 **하나의 값**만 들어가야 합니다. 여러 값을 콤마로 이어 붙이거나, 반복 컬럼을 만들면 안 됩니다.

```sql
-- 나쁜 예: 한 셀에 여러 값
-- | user_id | phone_numbers        |
-- | 1       | 010-1111, 010-2222   |  ← 나쁨
-- → 특정 번호로 검색, 번호 삭제가 매우 어려워짐

-- 나쁜 예: 반복 컬럼
-- | user_id | phone1     | phone2     |
-- | 1       | 010-1111   | 010-2222   |  ← 나쁨
-- → 번호가 3개면 테이블 구조를 바꿔야 함

-- 좋은 예: 별도 테이블로 분리
CREATE TABLE user_phones (
  id      SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  phone   VARCHAR(20) NOT NULL
);
```

## 2NF: 부분 종속 제거

복합 기본 키가 있을 때, 모든 열은 **기본 키 전체**에 의존해야 합니다. 기본 키의 일부에만 의존하는 컬럼은 별도 테이블로 빼야 합니다.

```sql
-- 나쁜 예: order_items 테이블에서
-- (order_id, product_id)가 기본 키인데
-- product_name은 product_id에만 종속됨
-- → products 테이블로 분리

CREATE TABLE products (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL
);

CREATE TABLE order_items (
  order_id   INT REFERENCES orders(id),
  product_id INT REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price INT NOT NULL,  -- 주문 시점 가격 스냅샷 (의도적 중복)
  PRIMARY KEY (order_id, product_id)
);
```

> **팁:** `unit_price`는 주문 당시 가격을 저장하는 의도적 중복입니다. 나중에 상품 가격이 바뀌어도 과거 주문 금액이 보존되어야 하기 때문입니다. 이처럼 비즈니스 요구사항에 의한 중복은 정상입니다.

## 3NF: 이행 종속 제거

기본 키 → 비키 컬럼 A → 비키 컬럼 B 처럼 간접 종속이 있으면 안 됩니다. B를 별도 테이블로 분리해야 합니다.

```sql
-- 나쁜 예: employees 테이블
-- employee_id → department_id → department_name
-- department_name이 employee_id가 아닌
-- department_id에 종속됨

-- 좋은 예: 부서를 별도 테이블로
CREATE TABLE departments (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  budget NUMERIC(15, 2)
);

CREATE TABLE employees (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  department_id INT REFERENCES departments(id)
  -- department_name은 여기 없음
);
```

부서 이름을 수정할 때 `departments` 테이블 한 행만 바꾸면 모든 직원에게 반영됩니다.

## 언제 역정규화가 맞을까?

정규화가 항상 정답은 아닙니다. 조회 성능이 중요할 때는 의도적으로 중복을 허용하는 **역정규화(Denormalization)**를 선택하기도 합니다.

```sql
-- 예 1: 댓글 수를 매번 COUNT()로 집계하기 힘들면
-- posts 테이블에 comment_count 컬럼을 두고 캐싱
ALTER TABLE posts ADD COLUMN comment_count INT DEFAULT 0;

-- 댓글 추가 시 트리거로 자동 업데이트
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 예 2: 대용량 분석 쿼리용 요약 테이블
-- 원본 데이터를 정규화해서 저장하되,
-- 집계 결과는 별도 테이블에 미리 계산해두기
```

> **설계 원칙:** 정규화로 시작하세요. 성능 문제가 실제로 발생하면, 그때 측정하고 필요한 부분만 선택적으로 역정규화하세요. 섣불리 역정규화하면 데이터 정합성 문제가 생깁니다.

## 실무에서 자주 보는 정규화 실수

| 실수 | 증상 | 해결 |
|---|---|---|
| 태그를 콤마로 구분해 TEXT에 저장 | 특정 태그 검색, 태그 수 집계 불가 | 별도 태그 테이블 + 연결 테이블 |
| 상태를 숫자 코드로만 저장 | 코드 의미를 앱 코드에서만 관리 | ENUM 타입 또는 별도 상태 테이블 |
| 여러 용도의 "메타데이터"를 하나 컬럼에 JSON | 특정 속성 쿼리 어려움 | 자주 조회하는 속성은 컬럼으로 |
| 주소를 하나의 TEXT로 | 도시/지역별 쿼리 불가 | street, city, state, country로 분리 |
