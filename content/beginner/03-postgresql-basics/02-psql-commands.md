---
title: "psql 필수 명령어"
category: "PostgreSQL 기초"
order: 2
description: "psql 터미널에서 자주 쓰는 메타 명령어와 팁"
---

## psql 접속

psql은 PostgreSQL의 공식 CLI 클라이언트입니다. 가장 빠르고 기능이 풍부해서, GUI 도구(DBeaver, pgAdmin)와 함께 쓰면 좋습니다.

```bash
# 기본 접속
psql -h localhost -U postgres -d mydb

# 연결 문자열로
psql "postgresql://postgres:password@localhost/mydb"

# 환경 변수로 (비밀번호 입력 생략)
PGPASSWORD=secret psql -h localhost -U app_user mydb

# .pgpass 파일로 비밀번호 관리 (~/.pgpass)
# 형식: hostname:port:database:username:password
# 예: localhost:5432:mydb:app_user:secret
# 권한: chmod 600 ~/.pgpass
```

## 자주 쓰는 메타 명령어

psql의 `\` 명령어는 SQL이 아닌 psql 클라이언트 명령어입니다.

```
\l          -- 데이터베이스 목록
\l+         -- 크기 포함 상세 목록
\c mydb     -- mydb로 연결 전환
\dt         -- 현재 스키마 테이블 목록
\dt *.*     -- 모든 스키마 테이블
\d users    -- users 테이블 구조 상세 (컬럼, 인덱스, 제약 조건)
\d+ users   -- 더 상세한 정보 (통계, 설명 포함)
\di         -- 인덱스 목록
\dv         -- 뷰 목록
\df         -- 함수 목록
\dn         -- 스키마 목록
\du         -- 사용자/역할 목록

\x          -- 확장 표시 모드 토글 (컬럼이 많을 때 세로로 표시)
\e          -- 외부 에디터($EDITOR)로 쿼리 작성 후 실행
\i file.sql -- SQL 파일 실행
\o file.txt -- 이후 출력을 파일로 저장 (다시 \o로 해제)
\s          -- 명령어 히스토리 보기

\timing     -- 쿼리 실행 시간 표시/숨기기 토글
\q          -- 종료
```

> **팁:** `\d+` 명령어는 테이블 구조뿐 아니라 인덱스, 외래 키, 트리거, 테이블 크기까지 한번에 보여줍니다. 새 테이블을 파악할 때 가장 먼저 쓰는 명령어입니다.

## 유용한 psql 팁

```sql
-- 이전 쿼리 재실행
\g

-- 현재 연결 정보
\conninfo

-- NULL 표시 설정 (기본은 아무것도 안 보임)
\pset null '(null)'

-- CSV로 내보내기 (\copy는 클라이언트 측에서 파일 저장)
\copy (SELECT * FROM users LIMIT 100) TO '/tmp/users.csv' CSV HEADER;

-- 파일에서 읽어서 삽입
\copy users (name, email) FROM '/tmp/users.csv' CSV HEADER;

-- 여러 줄 쿼리 작성 중 취소
\reset  -- 또는 Ctrl+C
```

## 히스토리 검색

psql은 readline 히스토리를 지원합니다.

```
Ctrl+R    -- 이전 명령어 역방향 검색
↑ / ↓    -- 이전/다음 명령어
Ctrl+A    -- 줄 처음으로
Ctrl+E    -- 줄 끝으로
```

## .psqlrc 설정 파일

`~/.psqlrc`에 저장하면 psql 시작할 때마다 자동으로 적용됩니다.

```sql
-- 예쁜 프롬프트: 사용자@호스트:DB%
\set PROMPT1 '%[%033[1;32m%]%n@%m%[%033[0m%]:%[%033[1;34m%]%/%%\n%[%033[0m%]'
\pset null '∅'
\timing                   -- 항상 실행 시간 표시
\x auto                   -- 컬럼 많으면 자동으로 세로 모드
\set HISTSIZE 10000       -- 히스토리 1만개 보관
\set HISTCONTROL ignoredups  -- 중복 히스토리 제거
\set COMP_KEYWORD_CASE upper -- 자동완성 키워드 대문자
```

## 자주 쓰는 시스템 쿼리

```sql
-- 현재 실행 중인 쿼리 (1분 이상 실행 중인 것만)
SELECT
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state = 'active'
  AND query_start < now() - INTERVAL '1 minute'
ORDER BY duration DESC;

-- 오래 걸리는 쿼리 강제 종료
SELECT pg_cancel_backend(pid);    -- 쿼리만 취소 (연결 유지)
SELECT pg_terminate_backend(pid); -- 연결 자체 끊기

-- 테이블 크기 순위
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(tablename::regclass)) AS total_size,
  pg_size_pretty(pg_relation_size(tablename::regclass)) AS table_size,
  pg_size_pretty(pg_indexes_size(tablename::regclass)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(tablename::regclass) DESC;

-- DB 버전
SELECT version();

-- 현재 잠금 상태
SELECT pid, relation::regclass, mode, granted
FROM pg_locks
WHERE NOT granted;  -- 대기 중인 잠금
```

> **팁:** `pg_cancel_backend(pid)`는 현재 실행 중인 쿼리만 취소하고 연결은 유지합니다. 연결 자체를 끊으려면 `pg_terminate_backend(pid)`를 사용합니다. 운영 환경에서는 실수로 중요한 프로세스를 종료하지 않도록 pid를 먼저 확인하세요.
