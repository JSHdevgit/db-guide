---
title: "복제 기초 (Replication)"
category: "복제 & 고가용성"
order: 1
description: "Streaming Replication으로 읽기 부하 분산과 고가용성 구성하기"
---

## 왜 복제가 필요한가?

- **고가용성 (HA)**: Primary 장애 시 Replica로 빠르게 전환 (Failover). 다운타임 최소화
- **읽기 분산**: SELECT 쿼리를 Replica로 분산해서 Primary 부하 감소. 보고서, 분석 쿼리에 효과적
- **백업**: Replica에서 `pg_dump` 실행 — Primary에 영향 없이 백업 가능
- **지리적 분산**: 다른 지역에 Replica를 두어 사용자 레이턴시 감소

## Streaming Replication 동작 원리

Primary는 모든 변경 사항을 WAL(Write-Ahead Log)에 기록합니다. Replica는 Primary에 연결해서 WAL을 실시간으로 받아서 적용합니다. Replica에서는 SELECT만 가능하고, 복제 지연(replication lag)이 발생할 수 있습니다.

### Primary 설정 (postgresql.conf)

```ini
wal_level = replica           # WAL 레벨 (replica 이상이어야 복제 가능)
max_wal_senders = 5           # 복제 연결 최대 수 (Replica 수 + 여유분)
wal_keep_size = 1GB           # WAL 파일 보관 크기 (Replica 재연결 시 필요)
hot_standby = on              # Replica에서 읽기 가능하게
```

### pg_hba.conf — 복제 사용자 허용

```
# TYPE  DATABASE    USER         ADDRESS       METHOD
host    replication replicator   10.0.0.2/32   scram-sha-256
```

### 복제 사용자 생성

```sql
-- REPLICATION 권한을 가진 전용 사용자 생성
CREATE ROLE replicator REPLICATION LOGIN PASSWORD 'repl_password';
-- 최소 권한 원칙: REPLICATION만, SUPERUSER는 주지 않음
```

### Replica 초기화

```bash
# Replica 서버에서 Primary 데이터 복사
pg_basebackup -h primary-host -U replicator -D /var/lib/postgresql/16/main \
  -Fp -Xs -P -R
# -Fp: 파일 포맷 (디렉토리 구조 유지)
# -Xs: WAL을 스트리밍으로 함께 복사
# -R: standby.signal 파일 + postgresql.auto.conf 자동 생성
# -P: 진행 상황 표시
```

### Replica postgresql.conf

```ini
primary_conninfo = 'host=primary-host port=5432 user=replicator password=repl_password'
hot_standby = on
hot_standby_feedback = on   # Replica의 쿼리 실행 중 Primary가 vacuum으로 필요한 행을 지우지 않도록
```

## 복제 상태 모니터링

```sql
-- Primary에서: Replica 연결 및 지연 확인
SELECT
  client_addr,
  application_name,
  state,               -- streaming: 정상, catchup: 따라가는 중
  sent_lsn,
  write_lsn,
  flush_lsn,
  replay_lsn,
  write_lag,           -- Primary → Replica 전송 지연
  flush_lag,           -- Replica 디스크 기록 지연
  replay_lag           -- Replica 적용 지연 (가장 중요)
FROM pg_stat_replication;

-- Replica에서: 복제 지연 (1초 이하가 정상)
SELECT
  now() - pg_last_xact_replay_timestamp() AS replication_lag,
  pg_is_in_recovery()   AS is_standby,
  pg_last_wal_replay_lsn() AS replay_position;

-- 복제 지연이 크다면: Replica 서버 부하, 네트워크 문제, 또는 hot_standby_feedback 확인
```

> **복제 지연 모니터링:** `replay_lag`가 지속적으로 증가한다면 Replica가 Primary의 변경 속도를 따라가지 못하는 것입니다. 원인은 보통 ① Replica에서 무거운 쿼리 실행, ② 네트워크 대역폭, ③ Replica 디스크 I/O 포화입니다. 알람을 설정해서 lag이 30초를 넘으면 알림을 받도록 하세요.

## 읽기 전용 Replica 활용

```sql
-- Replica에서는 SELECT만 가능
SELECT * FROM orders WHERE created_at > NOW() - INTERVAL '1 day';

-- 쓰기 시도 시 에러
INSERT INTO users (name) VALUES ('test');
-- ERROR: cannot execute INSERT in a read-only transaction
```

애플리케이션에서 읽기/쓰기 분리:
- 쓰기 작업 (INSERT/UPDATE/DELETE, 트랜잭션): Primary
- 읽기 작업 (SELECT, 보고서, 분석): Replica

## 동기 복제 vs 비동기 복제

```ini
# 기본: 비동기 복제 (Primary는 Replica 확인 없이 즉시 COMMIT)
# 성능 우선, 장애 시 Replica에 없는 데이터가 있을 수 있음

# 동기 복제 (적어도 Replica 하나에 확인 후 COMMIT)
synchronous_commit = on
synchronous_standby_names = 'replica1'  # 특정 Replica 지정
# 또는
synchronous_standby_names = 'ANY 1 (replica1, replica2)'  # 하나라도 확인
```

> **동기 복제 성능 영향:** 동기 복제는 데이터 손실 없음을 보장하지만, 모든 COMMIT이 Replica 확인을 기다리므로 레이턴시가 증가합니다. 금융 거래처럼 데이터 손실을 절대 허용할 수 없는 경우에만 사용하세요.

## Failover 절차

```bash
# 1. Primary 장애 확인
# 2. Replica를 Primary로 승격

# 방법 1: pg_promote()
psql -c "SELECT pg_promote();"  -- PostgreSQL 12+

# 방법 2: pg_ctl
pg_ctl promote -D /var/lib/postgresql/16/main

# 3. 앱 연결 문자열을 새 Primary로 변경
# 4. 나머지 Replica들이 새 Primary를 바라보도록 설정
```

수동 Failover는 다운타임이 수 분에 달할 수 있습니다. 자동화가 필요하다면 Patroni를 사용하세요.

## Patroni — 자동 Failover

Patroni는 etcd/Consul/ZooKeeper를 사용해서 자동으로 Primary를 선출하고 Failover를 처리합니다.

```yaml
# patroni.yml 핵심 설정
scope: my-cluster
restapi:
  listen: 0.0.0.0:8008
etcd3:
  host: etcd-host:2379
postgresql:
  listen: 0.0.0.0:5432
  data_dir: /var/lib/postgresql/16/main
  parameters:
    max_connections: 100
    wal_level: replica
    hot_standby: "on"
```

## 논리적 복제 (Logical Replication)

Streaming Replication은 전체 DB를 복제하지만, Logical Replication은 특정 테이블만 복제할 수 있습니다. 다른 PostgreSQL 버전 간 복제, 마이그레이션, 특정 테이블만 다른 DB로 동기화할 때 씁니다.

```sql
-- Primary: 발행(Publication)
CREATE PUBLICATION my_pub FOR TABLE users, orders;

-- Replica: 구독(Subscription)
CREATE SUBSCRIPTION my_sub
  CONNECTION 'host=primary-host dbname=mydb user=replicator password=...'
  PUBLICATION my_pub;
```

> **소규모 시작 팁:** 직접 복제 구성은 복잡합니다. 소규모에서 시작한다면 AWS RDS Multi-AZ, Supabase, Neon 같은 관리형 서비스가 복제와 Failover를 대신 처리해줍니다. 트래픽이 늘어나고 커스터마이징이 필요해지면 직접 구성을 고려하세요.
