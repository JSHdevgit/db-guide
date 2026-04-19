---
title: "자주 쓰는 문자열 함수"
category: "SQL 기초"
order: 9
description: "PostgreSQL에서 문자열을 다루는 주요 내장 함수들을 예제와 함께 익힙니다."
---

## 문자열 함수 기초

PostgreSQL은 문자열 처리를 위한 다양한 내장 함수를 제공합니다.

## 길이와 대소문자

```sql
SELECT
    UPPER('hello world')     AS upper_case,   -- 'HELLO WORLD'
    LOWER('HELLO WORLD')     AS lower_case,   -- 'hello world'
    LENGTH('안녕하세요')       AS len,          -- 5
    CHAR_LENGTH('hello')     AS char_len;     -- 5
```

## 공백 제거

```sql
SELECT
    TRIM('  hello  ')         AS both_trim,   -- 'hello'
    LTRIM('  hello  ')        AS left_trim,   -- 'hello  '
    RTRIM('  hello  ')        AS right_trim;  -- '  hello'
```

> 사용자 입력 데이터는 항상 `TRIM()`으로 공백을 제거한 후 저장하는 것이 좋습니다.

## 부분 문자열 추출

```sql
SELECT
    SUBSTRING('PostgreSQL' FROM 1 FOR 4),  -- 'Post'
    LEFT('PostgreSQL', 4),                  -- 'Post'
    RIGHT('PostgreSQL', 3);                 -- 'SQL'
```

## 문자열 연결

```sql
-- || 연산자 또는 CONCAT 함수
SELECT
    '이름: ' || last_name || ' ' || first_name AS full_name,
    CONCAT(last_name, ' ', first_name)          AS full_name2,
    CONCAT_WS(', ', city, district, address)    AS full_address
FROM users;
```

## 검색과 치환

```sql
SELECT
    POSITION('SQL' IN 'PostgreSQL'),      -- 9
    STRPOS('PostgreSQL', 'SQL'),           -- 9 (동일)
    REPLACE('hello world', 'world', 'SQL'); -- 'hello SQL'
```

## 채우기와 반복

```sql
SELECT
    LPAD('42', 5, '0'),    -- '00042' (왼쪽 0으로 채우기)
    RPAD('42', 5, '-'),    -- '42---' (오른쪽 - 채우기)
    REPEAT('ab', 3);       -- 'ababab'
```

## 패턴 매칭 — LIKE

```sql
-- % : 임의의 문자열, _ : 임의의 한 글자
SELECT name FROM products WHERE name LIKE '스마트%';     -- '스마트'로 시작
SELECT name FROM products WHERE name LIKE '%폰';         -- '폰'으로 끝남
SELECT code FROM items    WHERE code LIKE 'A__01';       -- A + 2글자 + 01
```

## 정규표현식 — REGEXP

```sql
-- 이메일 형식 검증
SELECT email
FROM users
WHERE email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$';
```

## 자주 쓰는 함수 요약

| 함수 | 설명 | 예시 결과 |
|------|------|-----------|
| `UPPER(s)` | 대문자 변환 | 'HELLO' |
| `LOWER(s)` | 소문자 변환 | 'hello' |
| `LENGTH(s)` | 문자 수 | 5 |
| `TRIM(s)` | 양쪽 공백 제거 | 'hello' |
| `SUBSTRING(s, n, len)` | 부분 추출 | 'ello' |
| `REPLACE(s, a, b)` | 치환 | 'hXllo' |
| `LPAD(s, n, c)` | 왼쪽 채우기 | '00042' |
| `SPLIT_PART(s, d, n)` | 구분자로 분리 후 n번째 | 'world' |
