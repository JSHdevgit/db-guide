---
title: "백업 전략과 복구 계획"
category: "운영 관리"
order: 4
description: "운영 환경에서 사용하는 다양한 백업 전략의 장단점을 비교하고, RPO/RTO 목표에 맞는 방식을 선택하는 방법을 배웁니다."
---

## 핵심 지표 — RPO와 RTO

| 지표 | 의미 | 예시 |
|------|------|------|
| **RPO** (Recovery Point Objective) | 허용 가능한 최대 데이터 손실 시간 | "1시간치 데이터 손실 허용" |
| **RTO** (Recovery Time Objective) | 허용 가능한 최대 복구 시간 | "30분 내 복구 완료" |

RPO/RTO 요구사항이 엄격할수록 복잡하고 비용이 높은 전략이 필요합니다.

## 백업 유형 비교

### 1. 논리 백업 (pg_dump)

```bash
# 커스텀 형식 (권장)
pg_dump -Fc -d myapp -f /backups/myapp_$(date +%Y%m%d).dump

# 병렬 백업 (-j: 병렬 수)
pg_dump -Fd -j 4 -d myapp -f /backups/myapp_dir/
```

| 장점 | 단점 |
|------|------|
| 간단하고 이식성 높음 | 대용량 DB에서 느림 |
| 선택적 복구 가능 | 복구도 느림 |
| 크로스 버전 호환 | 포인트-인-타임 복구 불가 |

### 2. 물리 백업 — pg_basebackup

```bash
# 전체 클러스터 물리 백업
pg_basebackup -h localhost -U replicator \
    -D /backups/base_$(date +%Y%m%d) \
    -Ft -z -P --wal-method=stream
```

| 장점 | 단점 |
|------|------|
| 빠른 백업·복구 | PostgreSQL 버전 간 이식 불가 |
| PITR 가능 | 선택적 복구 어려움 |
| 대용량에 적합 | 전체 클러스터 단위 |

### 3. PITR — Point-in-Time Recovery

```bash
# postgresql.conf 설정
archive_mode = on
archive_command = 'cp %p /wal_archive/%f'
# 또는 S3로
archive_command = 'aws s3 cp %p s3://my-bucket/wal/%f'
```

특정 시점(예: 실수로 DROP TABLE 직전)으로 복구할 수 있습니다.

## WAL 아카이빙 + PITR 복구

```bash
# 복구 대상 서버에서
# 1. base backup 복원
tar -xzf base_backup.tar.gz -C $PGDATA

# 2. recovery.conf 또는 postgresql.conf 설정 (v12+)
cat >> $PGDATA/postgresql.conf << EOF
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = '2024-01-15 14:30:00'
recovery_target_action = 'promote'
EOF

touch $PGDATA/recovery.signal  # PostgreSQL 12+

# 3. 서버 시작 → WAL 재생 → 지정 시점에서 자동 중단
pg_ctl start -D $PGDATA
```

## 백업 도구 비교

| 도구 | 특징 | 적합한 규모 |
|------|------|------------|
| pg_dump | 논리 백업, 기본 제공 | 수십 GB 이하 |
| pg_basebackup | 물리 백업, 기본 제공 | 수백 GB |
| pgBackRest | 증분 백업, S3 지원, 병렬 | 수 TB |
| Barman | 원격 백업, 모니터링 | 엔터프라이즈 |
| WAL-G | 경량, S3/GCS/Azure | 클라우드 환경 |

## pgBackRest 간단 예시

```bash
# 설정 파일 (/etc/pgbackrest/pgbackrest.conf)
[global]
repo1-path=/var/lib/pgbackrest
repo1-retention-full=2

[myapp]
pg1-path=/var/lib/postgresql/data

# 전체 백업
pgbackrest --stanza=myapp backup --type=full

# 증분 백업
pgbackrest --stanza=myapp backup --type=incr

# 복구
pgbackrest --stanza=myapp restore \
    --target="2024-01-15 14:30:00" \
    --target-action=promote
```

## 백업 전략 권장사항

```
일일 백업 정책 예시:
- 매일 새벽 2시: pg_dump 전체 백업 (논리)
- 매주 일요일: pg_basebackup 물리 백업
- 실시간: WAL 아카이빙 (PITR용)
- 보존 기간: 일간 7일, 주간 4주, 월간 6개월
```

> **3-2-1 규칙**: 데이터 3개 복사본, 2가지 미디어 유형, 1개 오프사이트 저장소.
