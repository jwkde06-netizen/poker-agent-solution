# Dream Poker 전광판 → 홍보자료실 연결

전광판 URL: `http://192.168.1.9:5855/MEDIA`

## Windows 매장 PC 빠른 실행

1. 매장 PC가 `http://192.168.1.9:5855/MEDIA`를 열 수 있는지 확인합니다.
2. Python 3.10 이상을 설치합니다.
3. 이 저장소의 `tools/START_LIVE_MONITOR_WINDOWS.bat`를 **저장소 폴더 안에서** 더블클릭합니다.
4. 첫 실행 시 라이브러리 및 Chromium이 자동 설치됩니다.
5. Supabase 프로젝트 URL과 service-role 키를 입력합니다. 키는 별도로 저장되지 않으며 화면에 표시되지 않습니다. 키를 공개하거나 채팅으로 보내지 마세요.
6. 수집 프로그램 창을 계속 켜 둡니다. 종료하려면 Ctrl+C를 누릅니다.

**주의:** DB 테이블 생성 SQL (`supabase/live_monitor_snapshot.sql`)은 관리자가 최초 1회 실행해야 합니다. 실제 Events 팝업 제어 및 LEVEL·ENTRIES 추출은 아직 매장 장치에서 검증되지 않았습니다. `Ready` 배포는 매장 내 수집기 실행을 의미하지 않습니다.

## 준비

1. 전광판과 같은 매장 Wi-Fi/LAN에 연결된 **항상 켜져 있는 PC**를 사용합니다.
2. Supabase SQL Editor에서 `supabase/live_monitor_snapshot.sql` 실행 (한 번만).
3. PC에 Python 3.10+ 설치한 뒤 저장소에서 아래 실행:

```bash
pip install playwright supabase
python -m playwright install chromium
```

4. 터미널의 **개인 환경 변수**로 `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 설정합니다. *service-role 키를 웹사이트 코드나 채팅에 공유하지 마세요.*
5. `python tools/live_monitor_bridge.py` 실행.

## 동작
- Events 목록에서 각 경기명을 클릭하고, 같은 URL 내 전광판의 LEVEL, ENTRIES, BLINDS를 읽습니다.
- 추출에 성공한 경우에만 Supabase `live_monitor_snapshot`에 기록합니다.
- 홍보자료실 → 현황 포스터 생성기 → '레벨·엔트리 반영'으로 공지문에 가져옵니다.
- 전광판 값이 2분 이상 갱신되지 않았거나 아직 설정되지 않으면 자동 적용을 제한합니다.

## 현장 테스트가 필요한 부분
- 경기 목록 팝업을 여는 UI가 사이트 버전에 따라 다를 수 있습니다.
- Entries의 `9/9`는 문자열과 첫 번째 숫자를 모두 저장하지만, 첫 번째/두 번째 숫자의 의미는 확인이 필요합니다.
- 'CLASH 5 No.8'은 **경기 이름/회차**입니다. 실제 물리적 테이블 번호로 추측해 저장하지 않습니다.
- 현재 수집기는 DOM 텍스트 기반이므로, 전광판이 Canvas 또는 이미지에 값 전체를 그리는 경우에는 앱의 네트워크 응답/API 구조를 조사해 데이터 수집기를 조정해야 합니다.

서버 배포와 **매장 PC에서의 수집기 실행은 별개**입니다. 매장 PC에 설치되기 전에는 실시간 동기화가 완료되지 않습니다.
