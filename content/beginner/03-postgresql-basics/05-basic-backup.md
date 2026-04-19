---
title: "기본 백업과 복구"
category: "PostgreSQL 기초"
order: 5
description: "pg_dump와 pg_restore를 사용해 데이터베이스를 백업하고 복구하는 기본 방법을 익힙니다."
---

## 백업의 중요성

데이터베이스 백업은 실수로 인한 데이터 삭제, 하드웨어 장애, 마이그레이션 등에 대비하는 필수 작업입니다.

## pg_dump — 논리 백업

`pg_dump`는 SQL 형식으로 데이터베이스를 덤프합니다.

```bash
# 기본 백업 (SQL 형식)
pg_dump -U postgres -d myapp > myapp_backup.sql

# 압축 커스텀 형식 (추천)
pg_dump -U postgres -d myapp -F c -f myapp_backup.dump

# 특정 테이블만 백업
pg_dump -U postgres -d myapp -t users -t orders -F c -f partial_backup.dump

# 스키마만 백업 (데이터 제외)
pg_dump -U postgres -d myapp --schema-only -f schema.sql

# 데이터만 백업 (구조 제외)
pg_dump -U postgres -d myapp --data-only -f data.sql
```

## pg_dumpall — 전체 클러스터 백업

```bash
# 모든 데이터베이스 + 역할/권한 포함
pg_dumpall -U postgres > full_cluster_backup.sql
```

## 복구 — psql / pg_restore

```bash
# SQL 형식 복구
psql -U postgres -d myapp < myapp_backup.sql

# 커스텀 형식 복구
pg_restore -U postgres -d myapp -F c myapp_backup.dump

# 새 데이터베이스에 복구
createdb -U postgres myapp_restored
pg_restore -U postgres -d myapp_restored myapp_backup.dump

# 특정 테이블만 복구
pg_restore -U postgres -d myapp -t users myapp_backup.dump
```

## 백업 파일 형식 비교

| 형식 | 옵션 | 장점 | 단점 |
|------|------|------|------|
| SQL 텍스트 | `-F p` | 사람이 읽기 쉬움 | 파일 크고 느림 |
| 커스텀 | `-F c` | 압축·선택적 복구 | pg_restore 필요 |
| 디렉터리 | `-F d` | 병렬 처리 가능 | 여러 파일 생성 |
| tar | `-F t` | 스트리밍 가능 | 병렬 불가 |

> 운영 환경에서는 커스텀 형식(`-F c`)을 권장합니다. 압축률이 높고 선택적 복구가 가능합니다.

## 자동 백업 스크립트 예시

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/postgresql"
DB_NAME="myapp"

mkdir -p "$BACKUP_DIR"

pg_dump -U postgres -d "$DB_NAME" -F c \
    -f "$BACKUP_DIR/${DB_NAME}_${DATE}.dump"

# 7일 이전 백업 삭제
find "$BACKUP_DIR" -name "*.dump" -mtime +7 -delete

echo "백업 완료: ${DB_NAME}_${DATE}.dump"
```

```bash
# cron에 등록 (매일 새벽 2시 실행)
# 0 2 * * * /path/to/backup.sh >> /var/log/pg_backup.log 2>&1
```

## 백업 검증

```bash
# 백업 파일 내용 확인
pg_restore --list myapp_backup.dump

# 테스트 복구 (실제 DB에 영향 없이 검증)
createdb -U postgres test_restore
pg_restore -U postgres -d test_restore myapp_backup.dump
psql -U postgres -d test_restore -c "SELECT COUNT(*) FROM users;"
dropdb -U postgres test_restore
```
