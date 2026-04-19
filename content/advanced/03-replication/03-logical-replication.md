---
title: "논리적 복제 (Logical Replication)"
category: "복제"
order: 3
description: "행 단위로 데이터를 복제하는 논리적 복제를 설정하고, 물리적 복제와의 차이점을 이해합니다."
---

## 논리적 복제 vs 물리적 복제

| 항목 | 물리적 복제 | 논리적 복제 |
|------|------------|------------|
| 복제 단위 | 바이트(WAL 블록) | 행(INSERT/UPDATE/DELETE) |
| 선택적 복제 | 불가 (전체 클러스터) | 가능 (특정 테이블) |
| 버전 간 복제 | 불가 | 가능 |
| OS/아키텍처 간 | 불가 | 가능 |
| Standby 읽기 | 가능 (Hot Standby) | 가능 |
| DDL 복제 | 자동 | 수동 필요 |
| 충돌 처리 | 없음 | 필요 |

## 논리적 복제 주요 사용 사례

- **버전 무중단 업그레이드**: 구 버전 → 신 버전으로 복제 후 전환
- **선택적 복제**: 특정 테이블만 다른 DB로 복제
- **이기종 DB 마이그레이션**: PostgreSQL → PostgreSQL 간 데이터 이전
- **OLTP → OLAP 복제**: 분석용 DB로 실시간 데이터 전송

## Publisher 설정 (원본)

```ini
# postgresql.conf
wal_level = logical   # 논리 복제에 필요
```

```sql
-- 복제 권한 부여
CREATE ROLE logical_repl LOGIN REPLICATION PASSWORD 'lrep_pw!';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO logical_repl;

-- Publication 생성 (복제할 테이블 정의)
CREATE PUBLICATION my_pub FOR TABLE users, orders, products;

-- 모든 테이블 복제
CREATE PUBLICATION all_tables_pub FOR ALL TABLES;

-- 특정 작업만 복제
CREATE PUBLICATION insert_only_pub
    FOR TABLE events
    WITH (publish = 'insert');  -- insert만 (delete 제외)
```

## Subscriber 설정 (대상)

```sql
-- 대상 서버에서 테이블 먼저 생성 (DDL 자동 복제 안 됨)
CREATE TABLE users (LIKE users_origin INCLUDING ALL);
CREATE TABLE orders (LIKE orders_origin INCLUDING ALL);

-- Subscription 생성
CREATE SUBSCRIPTION my_sub
    CONNECTION 'host=192.168.1.100 port=5432 dbname=myapp user=logical_repl password=lrep_pw!'
    PUBLICATION my_pub;

-- Subscription 상태 확인
SELECT subname, subenabled, subslotname FROM pg_subscription;
```

## 복제 상태 모니터링

```sql
-- Publisher에서
SELECT slot_name, plugin, active, confirmed_flush_lsn
FROM pg_replication_slots
WHERE slot_type = 'logical';

-- Subscriber에서
SELECT
    subname,
    pid,
    received_lsn,
    latest_end_lsn,
    latest_end_time
FROM pg_stat_subscription;
```

## 충돌 처리

논리적 복제에서는 PRIMARY KEY 중복 등의 충돌이 발생할 수 있습니다.

```sql
-- 충돌 발생 시 복제 worker가 중단됨
-- pg_subscription_rel에서 상태 확인
SELECT * FROM pg_subscription_rel;

-- 방법 1: 충돌 데이터 삭제 후 재개
DELETE FROM subscribers_table WHERE id = <conflicting_id>;

-- 방법 2: 오류 LSN 건너뛰기
SELECT pg_replication_origin_advance(
    'pg_' || (SELECT oid FROM pg_subscription WHERE subname = 'my_sub')::text,
    '<LSN값>'
);
```

## Publication 관리

```sql
-- 테이블 추가
ALTER PUBLICATION my_pub ADD TABLE new_table;

-- 테이블 제거
ALTER PUBLICATION my_pub DROP TABLE old_table;

-- Publication 삭제
DROP PUBLICATION my_pub;

-- Subscription 중지/재개
ALTER SUBSCRIPTION my_sub DISABLE;
ALTER SUBSCRIPTION my_sub ENABLE;

-- Subscription 삭제
DROP SUBSCRIPTION my_sub;
```

> Subscription 삭제 시 Publisher의 복제 슬롯도 자동으로 삭제됩니다. Publisher가 중단 상태라면 수동으로 슬롯을 삭제해야 합니다.
