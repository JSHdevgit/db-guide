---
title: "커넥션 풀링 심화 — PgBouncer"
category: "운영 관리"
order: 7
description: "PgBouncer의 풀링 모드를 이해하고, 운영 환경에 맞게 설정을 최적화하는 방법을 배웁니다."
---

## 왜 커넥션 풀링이 필요한가?

PostgreSQL은 연결마다 별도의 프로세스를 생성합니다. 연결이 많아지면:
- 메모리 증가 (연결당 약 5~10MB)
- 컨텍스트 스위칭 증가
- 최대 연결 수(`max_connections`) 초과 오류

커넥션 풀러는 애플리케이션과 DB 사이에서 연결을 재사용합니다.

## PgBouncer 풀링 모드

| 모드 | 연결 반환 시점 | 특징 |
|------|--------------|------|
| **Session** | 클라이언트 연결 종료 시 | 가장 안전, 절약 효과 낮음 |
| **Transaction** | 트랜잭션 종료 시 | 추천, 대부분의 경우 적합 |
| **Statement** | 쿼리 완료 시 | 트랜잭션 불가, 거의 미사용 |

## pgbouncer.ini 설정

```ini
[databases]
myapp = host=127.0.0.1 port=5432 dbname=myapp

[pgbouncer]
listen_port = 6432
listen_addr = 127.0.0.1
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt

# 풀링 모드
pool_mode = transaction

# 풀 크기 설정
max_client_conn = 1000      # 클라이언트 최대 연결 수
default_pool_size = 25      # DB 실제 연결 수
min_pool_size = 5           # 최소 유지 연결 수
reserve_pool_size = 5       # 예비 연결 수
reserve_pool_timeout = 3    # 예비 풀 사용 대기 시간(초)

# 연결 수명 관리
server_lifetime = 3600      # DB 연결 최대 유지 시간 (초)
server_idle_timeout = 600   # 유휴 연결 정리 시간 (초)
client_idle_timeout = 0     # 클라이언트 유휴 제한 (0=무제한)

# 타임아웃
query_timeout = 30          # 쿼리 최대 실행 시간 (초)
connect_timeout = 5         # DB 연결 타임아웃

# 로깅
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid

# 관리 인터페이스
admin_users = pgbouncer_admin
stats_users = monitoring_user
```

## 적정 풀 크기 계산

```
권장 공식:
default_pool_size ≈ (CPU 코어 수 × 2) + 디스크 수

예: 8코어, SSD 1개
default_pool_size = (8 × 2) + 1 = 17 → 20으로 반올림
```

> `max_connections`(postgresql.conf)는 `default_pool_size × DB 수 + 슈퍼유저 예약`으로 설정합니다.

## Transaction 모드의 제약

Transaction 풀링 모드에서는 연결 상태를 보존할 수 없어 다음을 사용할 수 없습니다.

```sql
-- 사용 불가 (연결 상태 유지 필요)
SET search_path = myschema;    -- 세션 변수
LISTEN channel_name;            -- LISTEN/NOTIFY
PREPARE stmt AS SELECT ...;     -- Prepared statements (server-side)
WITH HOLD CURSOR ...;           -- 트랜잭션 넘나드는 커서
```

## PgBouncer 상태 모니터링

```bash
# 관리 DB에 접속
psql -h 127.0.0.1 -p 6432 -U pgbouncer_admin pgbouncer

# 풀 상태
SHOW POOLS;
-- database | user | cl_active | cl_waiting | sv_active | sv_idle | sv_used

# 통계
SHOW STATS;

# 클라이언트 목록
SHOW CLIENTS;

# 설정 재로드 (다운타임 없음)
RELOAD;
```

## 연결 수 비교

```
Before PgBouncer: 500 앱 인스턴스 × 5 연결 = 2,500 DB 연결
After  PgBouncer: 500 앱 인스턴스 → PgBouncer 25 DB 연결
```

## Odyssey — 대안 도구

Yandex가 개발한 PgBouncer 대안으로 멀티스레드 아키텍처를 사용합니다.

```bash
# 고부하 환경에서 PgBouncer 대비 장점
# - 멀티코어 활용
# - 더 낮은 지연
# - TLS 기본 지원
```
