---
title: "CASE 표현식으로 조건부 값 처리"
category: "SQL 기초"
order: 8
description: "CASE 표현식을 사용해 SQL 안에서 IF-ELSE 로직을 구현하는 방법을 배웁니다."
---

## CASE 표현식이란?

`CASE`는 SQL에서 조건에 따라 다른 값을 반환하는 표현식입니다. 프로그래밍의 if-else와 동일한 역할을 합니다.

## 기본 문법 — 단순 CASE

```sql
SELECT
    name,
    grade,
    CASE grade
        WHEN 'A' THEN '우수'
        WHEN 'B' THEN '양호'
        WHEN 'C' THEN '보통'
        ELSE '미흡'
    END AS grade_label
FROM students;
```

## 검색 CASE — 조건식 사용

더 유연한 방식으로, 복잡한 조건을 사용할 수 있습니다.

```sql
SELECT
    product_name,
    price,
    CASE
        WHEN price < 10000  THEN '저가'
        WHEN price < 50000  THEN '중가'
        WHEN price < 100000 THEN '고가'
        ELSE '프리미엄'
    END AS price_tier
FROM products;
```

## 집계 함수와 함께 사용

```sql
-- 부서별 직급 분포
SELECT
    department,
    COUNT(CASE WHEN level = 'junior'  THEN 1 END) AS junior_count,
    COUNT(CASE WHEN level = 'senior'  THEN 1 END) AS senior_count,
    COUNT(CASE WHEN level = 'manager' THEN 1 END) AS manager_count
FROM employees
GROUP BY department;
```

> `COUNT(CASE WHEN ... THEN 1 END)` 패턴은 조건부 집계에서 매우 자주 사용됩니다. 조건이 거짓이면 NULL을 반환하고, COUNT는 NULL을 세지 않습니다.

## CASE로 동적 정렬

```sql
-- 'VIP' 등급을 항상 먼저, 나머지는 이름순
SELECT name, membership
FROM customers
ORDER BY
    CASE membership WHEN 'VIP' THEN 0 ELSE 1 END,
    name;
```

## NULL 처리와의 조합

```sql
SELECT
    order_id,
    CASE
        WHEN shipped_at IS NULL THEN '배송 준비 중'
        WHEN delivered_at IS NULL THEN '배송 중'
        ELSE '배송 완료'
    END AS shipping_status
FROM orders;
```

## 주의사항

| 항목 | 설명 |
|------|------|
| 평가 순서 | 위에서 아래로, 첫 번째 참인 조건에서 멈춤 |
| ELSE 생략 | 조건이 모두 거짓이면 NULL 반환 |
| 중첩 가능 | CASE 안에 CASE를 쓸 수 있으나 가독성 저하 |
| WHERE 사용 | WHERE 절에도 CASE를 쓸 수 있음 |
