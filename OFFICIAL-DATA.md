# 공식 리그 데이터 연결 현황

확인일: 2026-10-01. 링크를 등록했다는 뜻과 앱에서 자동 조회한다는 뜻을 구분합니다.

| 리그 | 공식 홈페이지·기록 | 앱 연결 범위 |
|---|---|---|
| KBO | https://www.koreabaseball.com/ | 네이버 스포츠 일정·결과·순위·라인업·중계·경기기록 유지, 공식 링크 추가 |
| NPB | https://npb.jp/ | 스포나비 일정·결과·순위·라인업·중계·경기기록 유지, 공식 링크 추가 |
| MLB | https://www.mlb.com/ | MLB Stats API 일정·결과·순위·라인업·중계·경기기록 유지 |
| LMB | https://lmb.com.mx/ | MLB Stats API 유지 |
| LIDOM | https://lidom.com/ | MLB Stats API 유지 |
| LBPRC | https://www.ligapr.com/ | MLB Stats API 유지 |
| LVBP | https://lvbp.com/ | MLB Stats API 유지 |
| ABL | https://theabl.com.au/ | MLB Stats API 유지 |
| CPBL | https://www.cpbl.com.tw/ | 기존 공식 일정·순위 연결 코드 유지. 제공처 접근 제한으로 이번 환경에서 완전 검증하지 못함 |
| DBL | https://www.baseball-softball.de/spielbetrieb/deutsche-baseball-liga/ | **신규: 공식 일정·결과·북부/남부 순위**. 인터리그·와일드카드·플레이오프 일정 포함 |
| Extraliga | https://baseball.cz/competition/detail/1 | **신규: 공식 일정·결과·정규시즌 순위**. 승강전 팀의 한국어 이름도 보완 |
| SNB | https://www.beisbolcubano.cu/general/calendario.aspx | **신규: 공식 예정 일정·구장·한국 시간**. 결과·순위·문자중계는 미연결 |
| Serie A Gold | https://www.fibs.it/it/disciplines/baseball | 공식 링크. 직접 요청 403으로 자동 연결 미완료 |
| Division 1 | https://ffbs.fr/division-1-baseball/ / https://ffbs.wbsc.org/ | 공식 링크. FFBS가 안내한 공식 기록 서비스 외부 접근 403으로 자동 연결 미완료 |
| Hoofdklasse | https://www.knbsb.nl/competities/uitslagen/ | 공식 링크. 직접 요청 403으로 자동 연결 미완료 |
| División de Honor Oro | https://www.rfebs.es/es/disciplines/baseball | 공식 링크. 직접 요청 403으로 자동 연결 미완료 |
| CBL | http://baseball.sport.org.cn/ | 중국올림픽위원회가 안내한 협회 공식 링크. 사이트 응답 실패, 자동 연결 미완료 |
| WPBL | https://www.womensprobaseballleague.com/schedule/ | 공식 링크. 홈페이지 직접 요청 403, 별도 공식 통계 서비스 401로 자동 연결 미완료 |

KBO/NPB 중계는 사용자가 기존에 요청한 네이버/스포나비 연결을 유지했습니다. 공식 홈페이지를 제공처와 혼동해서 표시하지 않습니다. MLB Stats 계열의 상세 항목은 리그·경기별로 제공 범위가 다릅니다.

## 검증한 실제 자료
- DBV 2026 북부·남부·인터리그·와일드카드·플레이오프 HTML을 모두 직접 받아 파싱했습니다. 북부·남부 순위는 12팀으로 확인했습니다.
- 체코 협회의 시즌 선택값에서 2026을 찾아 전체 일정 206개를 파싱하고, 정규시즌 8팀 순위를 확인했습니다. 현재 선택된 플레이오프 순위를 정규시즌으로 오인하지 않습니다.
- 쿠바 공식 2026–27 예정 일정에서 현지 10월 4일 13:30 경기는 한국 10월 5일 02:30으로 표시하며, 첫날 8경기와 구장을 확인했습니다.
- 독일 4월 경기의 다음 한국 날짜와 여름/겨울 시간 차이를 검사했습니다.
- 쿠바 공식 HTML은 예정 경기에도 `final` CSS 클래스를 붙입니다. 이 클래스를 경기 종료로 해석하지 않고, 예정 시각 `13:30`도 13 대 30 점수로 해석하지 않습니다. 결과 형식이 달라지면 원문을 안내하며 임의 점수를 만들지 않습니다.

## 운영 방식과 제한
- 공식 HTML은 서버에서 최대 5분 캐시합니다. 화면의 새로고침 간격과 원본 반영 간격은 다를 수 있습니다.
- 원본 오류, 팀명 변경, 선택한 시즌 미공개를 빈 경기 목록으로 바꾸지 않습니다. 홈의 실패 안내와 공식 링크를 사용합니다.
- 독일은 공식 메인 페이지가 안내하는 현재 시즌을 자동으로 발견합니다. 다른 연도의 자료를 요청했을 때 현재 시즌 자료를 대신 보여주지 않습니다.
- 쿠바는 공식 홈페이지의 현재 시즌 예정 일정만 제공합니다. 과거 시즌 아카이브와 결과 데이터는 아직 연결하지 않았습니다.
- 독일·체코의 타자/투수 경기기록과 문자중계는 앱에 아직 연결하지 않았습니다. 상세 화면의 공식 경기 링크에서 확인할 수 있습니다.
- 직접 HTTP 수집으로 원본 접근과 파싱을 확인했습니다. 이 실행 환경의 Node 외부 요청은 시간 초과되어, Node의 전체 흐름은 수집한 실제 응답을 재생해 검증했습니다. 실제 Vercel에서의 외부 접속은 Preview 배포 후 확인해야 합니다.

## 공식 출처 확인 근거
- 중국 협회: https://www.olympic.cn/sports/union/domestic/2021/0819/389345.html
- 프랑스 공식 통계 안내: https://ffbs.fr/evenements/opening-day-division-1-baseball-2026/
- WPBL 통계 서비스: https://stats.womensprobaseballleague.com/
- 무료 번역 사양/한도: https://mymemory.translated.net/doc/spec.php / https://mymemory.translated.net/doc/usagelimits.php

접근 제한을 우회하거나 비공식 복제 사이트를 공식 출처로 사용하지 않았습니다.
