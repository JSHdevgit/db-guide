---
title: "테이블 관계 — 1:1, 1:N, N:M"
category: "스키마 설계"
order: 5
description: "데이터베이스에서 테이블 간의 관계를 설계하고 표현하는 방법을 배웁니다."
---

## 테이블 관계의 종류

현실의 데이터는 서로 연관되어 있습니다. 테이블 간의 관계는 세 가지로 분류합니다.

## 1:1 관계 (One-to-One)

한 행이 다른 테이블의 정확히 한 행과 대응됩니다.

```sql
-- 사용자와 프로필 (분리 이유: 자주 조회하지 않는 데이터 분리)
CREATE TABLE users (
    id    SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE user_profiles (
    user_id    INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    bio        TEXT,
    avatar_url VARCHAR(500),
    birth_date DATE
);
```

> 1:1 관계는 보안(민감 데이터 분리), 성능(자주 안 쓰는 컬럼 분리), 선택적 데이터 표현에 사용합니다.

## 1:N 관계 (One-to-Many)

가장 흔한 관계입니다. 한 행이 다른 테이블의 여러 행과 대응됩니다.

```sql
-- 부서 1 : 직원 N
CREATE TABLE departments (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employees (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    department_id INT REFERENCES departments(id)  -- FK가 N쪽에 위치
);
```

```sql
-- 게시글 1 : 댓글 N
CREATE TABLE posts (
    id         SERIAL PRIMARY KEY,
    title      VARCHAR(300) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comments (
    id         SERIAL PRIMARY KEY,
    post_id    INT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

> **외래키는 항상 N쪽 테이블에 위치합니다.**

## N:M 관계 (Many-to-Many)

양쪽 테이블의 행이 서로 여러 개와 대응됩니다. **중간 테이블(junction table)** 로 구현합니다.

```sql
-- 학생 N : 수업 M
CREATE TABLE students (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE courses (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL
);

-- 중간 테이블
CREATE TABLE enrollments (
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    course_id  INT REFERENCES courses(id)  ON DELETE CASCADE,
    enrolled_at TIMESTAMP DEFAULT NOW(),
    grade       CHAR(2),
    PRIMARY KEY (student_id, course_id)  -- 복합 기본키로 중복 방지
);
```

## JOIN으로 관계 데이터 조회

```sql
-- 학생별 수강 과목 목록
SELECT
    s.name AS student_name,
    c.name AS course_name,
    e.grade
FROM students s
JOIN enrollments e ON s.id = e.student_id
JOIN courses    c ON c.id = e.course_id
ORDER BY s.name, c.name;
```

## ON DELETE 옵션

| 옵션 | 부모 행 삭제 시 동작 |
|------|---------------------|
| `CASCADE` | 자식 행도 함께 삭제 |
| `RESTRICT` | 자식 행이 있으면 삭제 거부 (기본값) |
| `SET NULL` | 자식의 FK를 NULL로 설정 |
| `SET DEFAULT` | 자식의 FK를 기본값으로 설정 |
