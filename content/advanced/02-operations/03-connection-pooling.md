---
title: "연결 풀링 (PgBouncer)"
category: "운영 관리"
order: 3
description: "DB 연결 수 제한과 PgBouncer로 연결 풀 관리하기"
---

## 왜 연결 풀이 필요한가?

PostgreSQL은 연결마다 별도 프로세스를 생성합니다. 이는 안정성면에서 장점이지만, 연결이 많아지면 문제가 생깁니다:

- 연결당 메모리 ~5-10MB (500개 연결 = 2.5-5GB)
- Context switching 오버헤드
- `max_connections` 초과 시 연결 거부 에러

현대 웹 애플리케이션은 프레임워크 레벨에서 자체 연결 풀을 갖고 있지만(예: HikariCP, pgx), 서버 인스턴스가 여러 개라면 각각이 풀을 유지해서 총 연결 수가 급격히 늘어납니다.

```sql
-- 현재 연결 수와 상태 확인
SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;
-- idle: 놀고 있는 연결 (가장 많이 낭비됨)
-- active: 쿼리 실행 중
-- idle in transaction: 위험! 트랜잭션 열어둔 채 대기 중

-- 연결 출처 확인
SELECT client_addr, application_name, COUNT(*)
FROM pg_stat_activity
GROUP BY client_addr, application_name
ORDER BY COUNT(*) DESC;
```

> **idle in transaction 주의:** 트랜잭션을 열고 응답을 기다리는 연결은 잠금을 계속 보유합니다. `idle_in_transaction_session_timeout`을 설정해서 오래된 연결을 자동으로 끊어주세요.
> ```sql
> ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
> SELECT pg_reload_conf();
> ```

## PgBouncer 설치 및 설정

PgBouncer는 PostgreSQL 앞에 두는 경량 연결 풀러입니다. 수천 개 클라이언트 연결을 수십 개 DB 연결로 다중화합니다.

```ini
# /etc/pgbouncer/pgbouncer.ini

[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# 연결 풀 모드
pool_mode = transaction  # 트랜잭션 단위 (권장, 최고 효율)
# pool_mode = session    # 세션 단위 (SET, LISTEN 명령어 사용 시)
# pool_mode = statement  # 문장 단위 (autocommit 전용, 거의 안 씀)

# 풀 크기 설정
default_pool_size = 20        # PostgreSQL로 실제 연결 수
max_client_conn = 1000        # 클라이언트 최대 연결 수
reserve_pool_size = 5         # 예비 연결 (피크 시 임시 사용)
reserve_pool_timeout = 5      # 예비 풀 사용 전 대기 시간(초)

# 타임아웃
server_idle_timeout = 600     # 유휴 서버 연결 해제 (초)
client_idle_timeout = 0       # 클라이언트 유휴 타임아웃 (0=무제한)
query_timeout = 0             # 쿼리 타임아웃 (0=무제한)

# 로그
log_connections = 0           # 연결 로그 (0=비활성, 운영 성능 위해)
log_disconnections = 0
```

```bash
# 실행
pgbouncer -d /etc/pgbouncer/pgbouncer.ini

# 앱은 5432 대신 6432로 연결
DATABASE_URL=postgresql://user:pass@localhost:6432/mydb
```

## Transaction vs Session 모드

```
Transaction 모드 (권장):
클라이언트 ─┐                        PostgreSQL
            ├→ PgBouncer ──────────→ 연결 1
클라이언트 ─┤  (트랜잭션 완료마다      연결 2
            │   연결을 풀에 반납)      연결 3
클라이언트 ─┘                    (최대 20개)
1000 클라이언트, DB 연결 20개만 필요

Session 모드:
클라이언트 ─→ PgBouncer ──────────→ 연결 1개 고정
  (클라이언트 1개 = DB 연결 1개, 세션 상태 유지)
  SET 명령어, LISTEN/NOTIFY, advisory lock 사용 가능
```

> **Transaction 모드에서 쓸 수 없는 기능:** `SET` (세션 변수 설정), `LISTEN`/`NOTIFY`, `PREPARE` (prepared statements, pgbouncer `server_reset_query`로 우회 가능), advisory lock. 이 기능이 필요하다면 Session 모드를 쓰거나 해당 연결만 직접 PostgreSQL로 보내세요.

## PgBouncer 모니터링

```sql
-- PgBouncer 관리 콘솔 접속 (6432 포트, pgbouncer 데이터베이스)
psql -h 127.0.0.1 -p 6432 -U pgbouncer pgbouncer

SHOW STATS;    -- 초당 쿼리, 데이터 전송량, 평균 대기 시간
SHOW POOLS;    -- 풀 상태 (cl_active, cl_waiting, sv_active, sv_idle)
SHOW CLIENTS;  -- 연결된 클라이언트 목록
SHOW SERVERS;  -- PostgreSQL 연결 목록
SHOW CONFIG;   -- 현재 설정

-- 이상 신호:
-- cl_waiting > 0 → 대기 중인 클라이언트 있음 (pool_size 부족)
-- sv_idle = 0 → DB 연결이 모두 사용 중

-- 온라인 설정 변경 (재시작 없이)
SET default_pool_size = 30;
RELOAD;
```

## 적정 Pool Size 계산

```sql
-- 권장 공식 (SSD 기준)
-- default_pool_size ≈ CPU 코어 수 × 2 + 스토리지 I/O 병렬성
-- 예: 4코어 서버 → pool_size = 4 × 2 + 2 = 10 ~ 20

-- 과도한 pool_size는 오히려 성능 저하
-- (PostgreSQL 내부 경합 + context switching 증가)
```

## max_connections 튜닝

```sql
-- postgresql.conf 조정
-- PgBouncer 사용 시 max_connections는 낮게 유지
ALTER SYSTEM SET max_connections = 100;  -- PgBouncer pool_size * 2 정도
SELECT pg_reload_conf();
-- 변경 반영은 재시작 후: pg_ctl restart

-- max_connections를 높이면 생기는 문제
-- shared_buffers, work_mem 등이 연결 수에 비례해서 메모리를 사용
-- 1000개 연결 × work_mem 4MB = 4GB (정렬 작업 시)
```

> **PgBouncer 없이 max_connections를 높이는 것은 임시방편입니다.** 1000개 연결은 메모리만 5-10GB를 소비합니다. 연결 풀을 먼저 도입하고 `max_connections`는 낮게 유지하세요.

## 연결 풀 없이 할 수 있는 것

애플리케이션 레벨에서도 연결 관리를 할 수 있습니다.

```sql
-- 오래된 유휴 연결 자동 해제
ALTER SYSTEM SET tcp_keepalives_idle = 60;        -- 60초 유휴 후 keepalive 시작
ALTER SYSTEM SET tcp_keepalives_interval = 10;    -- 10초마다 확인
ALTER SYSTEM SET tcp_keepalives_count = 10;       -- 10번 실패 시 종료
ALTER SYSTEM SET idle_session_timeout = '10min';  -- 10분 유휴 연결 끊기
SELECT pg_reload_conf();
```
