---
title: "장애 조치(Failover)와 복구"
category: "복제"
order: 4
description: "Primary 장애 발생 시 Standby를 승격하는 절차와 자동 Failover 도구를 설명합니다."
---

## Failover 개요

Primary 서버 장애 발생 시:

```
정상 상태:     Primary ──WAL──▶ Standby
장애 발생:     Primary ✗         Standby (복제 중단)
Failover:                        Standby ──승격──▶ 새 Primary
```

## 수동 Failover

```bash
# 1. Primary 장애 확인
pg_ctl status -D /primary/data

# 2. Standby에서 승격
pg_ctl promote -D /standby/data
# 또는
touch /standby/data/promote.signal  # PostgreSQL 12+

# 3. 승격 확인
psql -h standby -c "SELECT pg_is_in_recovery();"
-- f (false = Primary 모드)

# 4. 애플리케이션 연결 전환
# DB 연결 문자열을 standby IP로 변경
```

## 이전 Primary 재연결 — pg_rewind

Primary가 복구되면 새 Primary의 Standby로 합류시킵니다.

```bash
# 1. 이전 Primary 중단 확인
pg_ctl stop -D /old_primary/data -m fast

# 2. pg_rewind로 데이터 동기화 (분기점 이후 WAL 교체)
pg_rewind \
    --target-pgdata=/old_primary/data \
    --source-server="host=new_primary user=postgres"

# 3. recovery 설정 추가
cat >> /old_primary/data/postgresql.auto.conf << EOF
primary_conninfo = 'host=new_primary port=5432 user=replicator'
EOF
touch /old_primary/data/standby.signal

# 4. 이전 Primary를 새 Standby로 시작
pg_ctl start -D /old_primary/data
```

> `pg_rewind`를 사용하려면 Primary가 `wal_log_hints = on` 또는 체크섬이 활성화되어 있어야 합니다.

## 자동 Failover — Patroni

Patroni는 PostgreSQL HA를 위한 오픈소스 도구입니다. etcd/Consul/ZooKeeper를 DCS(분산 설정 저장소)로 사용합니다.

```yaml
# patroni.yml
scope: myapp-cluster
namespace: /db/
name: node1

restapi:
  listen: 0.0.0.0:8008
  connect_address: 192.168.1.100:8008

etcd:
  hosts: etcd1:2379,etcd2:2379,etcd3:2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576  # 1MB

postgresql:
  listen: 0.0.0.0:5432
  connect_address: 192.168.1.100:5432
  data_dir: /var/lib/postgresql/data
  pg_hba:
    - host replication replicator 0.0.0.0/0 md5
    - host all all 0.0.0.0/0 md5
  parameters:
    max_connections: 200
    wal_level: replica
    hot_standby: on
    max_wal_senders: 10

tags:
  nofailover: false
  noloadbalance: false
```

```bash
# Patroni 클러스터 상태 확인
patronictl -c /etc/patroni.yml list

# 수동 Failover (계획된 전환)
patronictl -c /etc/patroni.yml failover myapp-cluster \
    --master node1 --candidate node2 --force
```

## HAProxy + Patroni 연동

```
애플리케이션 → HAProxy → Patroni REST API 헬스체크
                ├── Primary (포트 5432 읽기/쓰기)
                └── Standby (포트 5433 읽기 전용)
```

```ini
# haproxy.cfg
frontend pg_primary
    bind *:5432
    default_backend primary_backend

backend primary_backend
    option httpchk GET /primary
    server node1 192.168.1.100:5432 check port 8008
    server node2 192.168.1.101:5432 check port 8008

frontend pg_replica
    bind *:5433
    default_backend replica_backend

backend replica_backend
    option httpchk GET /replica
    server node1 192.168.1.100:5432 check port 8008
    server node2 192.168.1.101:5432 check port 8008
```

## Failover 체크리스트

| 단계 | 항목 |
|------|------|
| 사전 | 복제 슬롯 모니터링, 복제 지연 알림 설정 |
| 장애 감지 | 복제 지연 임계값, Primary 헬스체크 |
| Failover | Standby 승격, 복제 슬롯 정리 |
| 사후 | 이전 Primary 재연결, 알림 발송, 사후 분석 |
