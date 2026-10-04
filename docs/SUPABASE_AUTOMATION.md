# Supabase 자동 반영 설정

GitHub Actions가 `supabase/migrations/`의 변경을 감지해서 Supabase DB에 자동 적용합니다.

## 최초 1회 설정

GitHub 저장소에서:

`Settings → Secrets and variables → Actions → New repository secret`

아래 3개를 추가합니다.

### SUPABASE_ACCESS_TOKEN

Supabase 계정의 Personal Access Token.

### SUPABASE_PROJECT_REF

Supabase 프로젝트 URL이

`https://sncvmxhhsocuamjjwqvz.supabase.co`

라면 Project Ref는:

`sncvmxhhsocuamjjwqvz`

### SUPABASE_DB_PASSWORD

Supabase 프로젝트를 만들 때 설정한 Database Password.

이 값들은 ChatGPT 대화창에 붙여넣지 말고 GitHub Repository Secret에 직접 저장하세요.

## 동작 방식

1. ChatGPT가 DB 변경용 SQL을 `supabase/migrations/`에 추가합니다.
2. main 브랜치에 커밋됩니다.
3. GitHub Actions가 자동 실행됩니다.
4. Supabase CLI가 프로젝트에 연결합니다.
5. 새 migration이 DB에 적용됩니다.

Secrets가 아직 설정되지 않은 경우 워크플로우는 DB 변경을 건너뜁니다.
