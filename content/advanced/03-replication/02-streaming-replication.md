---
title: "스트리밍 복제 설정"
category: "복제"
order: 2
description: "PostgreSQL 스트리밍 복제를 직접 구성하고, 복제 상태를 모니터링하는 방법을 단계별로 배웁니다."
---

## 스트리밍 복제 아키텍처

```
Primary (읽기/쓰기)
    │ WAL 스트림 전송
    ▼
Standby (읽기 전용, Hot Standby)
    │
    ├── 읽기 쿼리 분산
    └── 장애 조치(Failover) 후 Primary 승격
```

## Primary 서버 설정

```ini
# postgresql.conf
wal_level = replica              # 또는 logical (복제에 필요)
max_wal_senders = 5              # standby 연결 허용 수
wal_keep_size = 1GB              # standby 지연 대비 WAL 보존
hot_standby = on                 # standby에서 SELECT 허용

# 선택: 동기 복제 (데이터 손실 0)
# synchronous_commit = remote_apply
# synchronous_standby_names = 'standby1'
```

```
# pg_hba.conf — 복제 접속 허용
host  replication  replicator  192.168.1.101/32  md5
```

```sql
-- 복제 전용 사용자 생성
CREATE ROLE replicator LOGIN REPLICATION PASSWORD 'rep_pw!';
```

## Standby 서버 초기화

```bash
# 1. Primary에서 기본 백업 생성
pg_basebackup \
    -h 192.168.1.100 \
    -U replicator \
    -D /var/lib/postgresql/data \
    -P --wal-method=stream \
    -R  # standby.signal + postgresql.auto.conf 자동 생성

# -R 옵션이 생성하는 파일:
# - standby.signal (복제 모드 신호)
# - postgresql.auto.conf에 primary_conninfo 추가
```

```ini
# postgresql.auto.conf (자동 생성됨)
primary_conninfo = 'host=192.168.1.100 port=5432 user=replicator password=rep_pw! application_name=standby1'
```

```bash
# 2. Standby 서버 시작
pg_ctl start -D /var/lib/postgresql/data
```

## 복제 상태 모니터링

```sql
-- Primary에서 확인
SELECT
    client_addr,
    application_name,
    state,             -- streaming, catchup, startup
    sent_lsn,
    write_lsn,
    flush_lsn,
    replay_lsn,
    write_lag,
    flush_lag,
    replay_lag,
    sync_state         -- async, sync, potential
FROM pg_stat_replication;

-- Standby에서 확인
SELECT
    pg_is_in_recovery()                    AS is_standby,
    pg_last_wal_receive_lsn()              AS received_lsn,
    pg_last_wal_replay_lsn()               AS replayed_lsn,
    now() - pg_last_xact_replay_timestamp() AS replication_lag;
```

## 복제 슬롯 — WAL 보존 보장

```sql
-- 복제 슬롯 생성 (WAL이 standby 소비 전 삭제 방지)
SELECT pg_create_physical_replication_slot('standby1_slot');

-- standby postgresql.conf에 추가
-- primary_slot_name = 'standby1_slot'

-- 슬롯 상태 확인
SELECT slot_name, active, restart_lsn FROM pg_replication_slots;

-- 슬롯 삭제 (standby 중단 시 필수!)
SELECT pg_drop_replication_slot('standby1_slot');
```

> 복제 슬롯을 삭제하지 않으면 WAL이 무한정 쌓여 디스크가 가득 찰 수 있습니다.

## 동기 복제 설정

```ini
# Primary postgresql.conf
synchronous_commit = remote_apply  # 가장 강한 보장
# remote_apply: Standby에 적용 완료 후 커밋 응답
# remote_write: Standby OS 버퍼 기록 후 커밋 응답
# local: Primary 로컬 완료 후 커밋 응답 (기본)

synchronous_standby_names = 'ANY 1 (standby1, standby2)'
# ANY 1: 하나 이상이면 동기 처리 (쿼럼 동기)
```

## 읽기 부하 분산

```python
# 애플리케이션에서 읽기를 Standby로 분산
import psycopg2

primary_conn = psycopg2.connect("host=192.168.1.100 ...")
standby_conn = psycopg2.connect("host=192.168.1.101 ...")

# 쓰기 → Primary, 읽기 → Standby
def get_user(user_id):
    cur = standby_conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
    return cur.fetchone()
```

> 복제 지연이 있으므로 Standby 읽기는 최신 데이터가 아닐 수 있습니다. 지연에 민감한 쿼리는 Primary를 사용하세요.
