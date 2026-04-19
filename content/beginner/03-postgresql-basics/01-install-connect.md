---
title: "PostgreSQL 설치와 연결"
category: "PostgreSQL 기초"
order: 1
description: "로컬 환경 설치, Docker로 빠르게 시작하기, 연결 설정"
---

## Docker로 빠르게 시작 (권장)

로컬 개발에는 Docker가 가장 편합니다. 설치/삭제가 간단하고, 버전 전환도 쉽습니다.

```bash
# PostgreSQL 컨테이너 실행
docker run -d \
  --name postgres-dev \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=mydb \
  -p 5432:5432 \
  postgres:16

# 접속 확인
docker exec -it postgres-dev psql -U postgres -d mydb
```

### docker-compose로 프로젝트에 포함하기

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: myapp
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data  # 데이터 영구 저장
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user -d myapp"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

```bash
docker-compose up -d     # 시작
docker-compose down      # 중지 (데이터 유지)
docker-compose down -v   # 중지 + 데이터 삭제
```

> **팁:** `volumes`로 데이터를 마운트하지 않으면 컨테이너를 삭제할 때 데이터도 사라집니다. 개발 DB라도 volumes는 항상 설정하세요.

## macOS 설치 (Homebrew)

```bash
brew install postgresql@16
brew services start postgresql@16

# 기본 DB 생성
createdb mydb

# 접속
psql mydb
```

## Ubuntu/Debian 설치

```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# postgres 사용자로 접속
sudo -u postgres psql
```

## 연결 문자열

대부분의 DB 드라이버와 ORM에서 연결 문자열 하나로 연결 정보를 전달합니다.

```
postgresql://username:password@host:port/database

# 예시
postgresql://postgres:mypassword@localhost:5432/mydb
postgresql://app_user:secret@db.example.com:5432/production

# 옵션 포함
postgresql://app_user:secret@localhost:5432/mydb?sslmode=require&connect_timeout=10
```

> **팁:** 연결 문자열에 비밀번호를 코드에 하드코딩하지 마세요. 환경 변수(`DATABASE_URL`)로 주입하고, `.env` 파일은 `.gitignore`에 추가하세요.

## 사용자와 데이터베이스 생성

```sql
-- psql에서 실행 (postgres 슈퍼유저로 접속 후)
CREATE USER app_user WITH PASSWORD 'secure_password';
CREATE DATABASE myapp OWNER app_user;
GRANT ALL PRIVILEGES ON DATABASE myapp TO app_user;

-- 특정 스키마 권한 부여
GRANT USAGE ON SCHEMA public TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 앞으로 생성될 테이블에도 자동 권한 부여
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO app_user;
```

> **보안 팁:** 애플리케이션에서 슈퍼유저(`postgres`)로 DB에 접근하지 마세요. 전용 앱 사용자를 만들고 필요한 권한만 부여하세요. 읽기 전용 API라면 SELECT만 부여한 별도 사용자를 쓰는 것도 좋습니다.

## pg_hba.conf — 접근 제어

`pg_hba.conf`는 누가 어떤 방식으로 접속할 수 있는지 제어하는 방화벽 역할을 합니다.

`/etc/postgresql/16/main/pg_hba.conf` (Ubuntu) 또는
`/usr/local/var/postgresql@16/pg_hba.conf` (macOS)

```
# TYPE  DATABASE  USER     ADDRESS       METHOD
local   all       postgres               peer          # 로컬 소켓
host    myapp     app_user 127.0.0.1/32  scram-sha-256 # 로컬호스트
host    myapp     app_user 10.0.0.0/8    scram-sha-256 # 내부 네트워크
host    all       all      0.0.0.0/0     reject        # 외부 전체 차단
```

설정 변경 후: `sudo systemctl reload postgresql`

> **주의:** `host all all 0.0.0.0/0 md5` 같은 설정으로 외부 접근을 허용하면 DB가 인터넷에 노출됩니다. VPN이나 SSH 터널을 통해서만 접근하고, 직접 외부 노출은 피하세요.

## 연결 상태 확인

```sql
-- 현재 어떤 DB에 어떤 사용자로 접속 중인지
SELECT current_user, current_database();

-- 서버 버전
SELECT version();

-- 현재 연결 수
SELECT COUNT(*) FROM pg_stat_activity;
```
