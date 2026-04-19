---
title: "사용자와 권한 관리"
category: "PostgreSQL 기초"
order: 4
description: "PostgreSQL의 역할(Role) 시스템을 통해 사용자를 만들고 권한을 관리하는 방법을 배웁니다."
---

## PostgreSQL의 사용자 = 역할(Role)

PostgreSQL에서는 사용자와 그룹 모두 **역할(Role)** 로 통합 관리합니다. 로그인 가능 여부로 사용자와 그룹을 구분합니다.

## 역할 생성

```sql
-- 로그인 가능한 사용자 생성
CREATE ROLE appuser
    LOGIN
    PASSWORD 'secure_password123!'
    CONNECTION LIMIT 10;

-- 슈퍼유저 생성 (매우 강력한 권한, 최소화 권장)
CREATE ROLE admin_user
    LOGIN
    SUPERUSER
    PASSWORD 'very_secure_pw!';

-- 그룹 역할 (로그인 불가)
CREATE ROLE readonly_group;
```

## 사용자 목록 확인

```sql
\du                  -- psql 명령
SELECT rolname, rollogin, rolsuper FROM pg_roles;
```

## 권한 부여 — GRANT

```sql
-- 데이터베이스 접속 권한
GRANT CONNECT ON DATABASE myapp TO appuser;

-- 스키마 사용 권한
GRANT USAGE ON SCHEMA public TO appuser;

-- 테이블별 권한
GRANT SELECT, INSERT, UPDATE ON TABLE orders TO appuser;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_group;

-- 미래에 생성될 테이블에도 권한 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO readonly_group;
```

## 권한 회수 — REVOKE

```sql
REVOKE INSERT, UPDATE ON TABLE orders FROM appuser;
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM old_user;
```

## 역할 상속 — 그룹처럼 사용

```sql
-- 그룹에 권한 부여
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_group;

-- 사용자를 그룹에 추가
GRANT readonly_group TO appuser;

-- appuser는 이제 readonly_group의 권한을 상속받음
```

## 비밀번호 변경

```sql
ALTER ROLE appuser PASSWORD 'new_secure_password!';

-- 또는 터미널에서
\password appuser
```

## 역할 삭제

```sql
-- 삭제 전 소유 객체 양도 필요
REASSIGN OWNED BY old_user TO postgres;
DROP OWNED BY old_user;
DROP ROLE old_user;
```

## 실전 권한 설계 예시

```sql
-- 1. 읽기 전용 역할
CREATE ROLE read_only;
GRANT CONNECT ON DATABASE myapp TO read_only;
GRANT USAGE ON SCHEMA public TO read_only;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_only;

-- 2. 앱 서버용 역할 (읽기·쓰기, DDL 불가)
CREATE ROLE app_rw;
GRANT CONNECT ON DATABASE myapp TO app_rw;
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;

-- 3. 실제 사용자에게 역할 할당
CREATE ROLE api_server LOGIN PASSWORD 'pw123!';
GRANT app_rw TO api_server;
```

> 애플리케이션 서버에는 절대 슈퍼유저 계정을 사용하지 마세요. 최소 권한 원칙을 따르세요.
