---
title: "로그 설정과 분석"
category: "운영 관리"
order: 6
description: "PostgreSQL 로그를 올바르게 설정하고 pgBadger 등의 도구로 분석해 성능 문제를 진단하는 방법을 배웁니다."
---

## 로그 설정 — postgresql.conf

```ini
# 로그 목적지
log_destination = 'csvlog'          # stderr, csvlog, syslog, eventlog
logging_collector = on              # 백그라운드 로그 수집 활성화
log_directory = 'pg_log'           # $PGDATA 하위 경로
log_filename = 'postgresql-%Y-%m-%d.log'
log_rotation_age = 1d              # 하루마다 새 파일
log_rotation_size = 1GB

# 로그 레벨
log_min_messages = warning         # DEBUG5 ~ PANIC
log_min_error_statement = error    # 오류 쿼리 기록 시작 레벨

# 느린 쿼리 로깅 (핵심!)
log_min_duration_statement = 1000  # 1000ms 이상 쿼리 기록 (ms 단위)
# -1: 비활성화, 0: 전체 기록

# 추가 정보 기록
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = off              # 운영환경 off 권장 (대량 로그)
log_disconnections = off
log_lock_waits = on                # 락 대기 기록
deadlock_timeout = 1s
log_temp_files = 10240             # 10MB 이상 임시 파일 기록 (정렬 스필)
```

## 세션 단위 로그 조정

```sql
-- 특정 세션에서 모든 쿼리 기록 (디버깅용)
SET log_min_duration_statement = 0;

-- 운영 DB에서 특정 사용자만 느린 쿼리 기록
ALTER ROLE analyst SET log_min_duration_statement = 500;
```

## 로그 파일 직접 분석

```bash
# 슬로우 쿼리 추출
grep "duration:" /var/log/postgresql/postgresql-2024-01-15.log \
    | sort -t= -k2 -rn | head -20

# 오류 패턴 확인
grep -E "ERROR|FATAL|PANIC" /var/log/postgresql/postgresql-2024-01-15.log \
    | awk '{print $NF}' | sort | uniq -c | sort -rn
```

## pgBadger — 로그 분석 리포트

```bash
# 설치
apt install pgbadger
# 또는
cpan pgBadger

# 단일 파일 분석
pgbadger /var/log/postgresql/postgresql-2024-01-15.log \
    -o /tmp/report.html

# 여러 파일 분석
pgbadger /var/log/postgresql/postgresql-2024-*.log \
    --format csv \
    -o /var/www/html/pg_report.html \
    --jobs 4

# 증분 분석 (매일 cron)
pgbadger /var/log/postgresql/postgresql-$(date +%Y-%m-%d).log \
    --last-parsed /tmp/pgbadger.last \
    -o /var/www/html/daily_report.html
```

pgBadger 리포트에서 확인할 주요 항목:
- Top 10 슬로우 쿼리
- 가장 자주 실행된 쿼리
- 가장 많은 CPU를 사용한 쿼리
- 연결 수 추이
- 오류 빈도

## pg_log를 SQL로 조회 — csvlog

```sql
-- csvlog 형식일 때 테이블로 임포트
CREATE TABLE pg_log (
    log_time              TIMESTAMP WITH TIME ZONE,
    user_name             TEXT,
    database_name         TEXT,
    process_id            INT,
    connection_from       TEXT,
    session_id            TEXT,
    session_line_num      BIGINT,
    command_tag           TEXT,
    session_start_time    TIMESTAMP WITH TIME ZONE,
    virtual_transaction_id TEXT,
    transaction_id        BIGINT,
    error_severity        TEXT,
    sql_state_code        TEXT,
    message               TEXT,
    detail                TEXT,
    hint                  TEXT,
    internal_query        TEXT,
    internal_query_pos    INT,
    context               TEXT,
    query                 TEXT,
    query_pos             INT,
    location              TEXT,
    application_name      TEXT
);

COPY pg_log FROM '/var/log/postgresql/postgresql-2024-01-15.csv' CSV;

-- 슬로우 쿼리 분석
SELECT
    user_name,
    database_name,
    regexp_replace(message, 'duration: (\d+\.\d+) ms', '\1')::float AS duration_ms,
    query
FROM pg_log
WHERE message LIKE 'duration:%'
ORDER BY duration_ms DESC
LIMIT 20;
```

## 체크포인트 경고 해석

```
LOG: checkpoint complete: wrote 2847 buffers (17.4%);
     0 WAL file(s) added, 0 removed, 2 recycled;
     write=28.901 s, sync=0.007 s, total=28.909 s;
     sync files=22, longest=0.005 s, average=0.000 s;
     distance=36741 kB, estimate=37000 kB
```

- `wrote 17.4%`: 버퍼의 17.4%를 기록 (높으면 checkpoint_completion_target 조정)
- `write=28.901 s`: 체크포인트에 28초 소요 (길면 I/O 병목)
- 자주 발생하면 `max_wal_size` 증가 검토
