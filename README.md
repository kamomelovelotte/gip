# GIP (집)

야구가 있는 곳, 어디든 우리 집. Next.js 16 App Router, React, TypeScript, Vinext 기반의 야구 경기·기록 웹사이트입니다.

## GitHub 웹사이트에 올리기 — Windows, 두 번에 나눠 업로드

이 프로젝트의 소스 파일은 총 147개입니다. GitHub 웹사이트는 한 번에 파일 100개까지 받을 수 있으므로, 전체 코드를 파일 내용 변경 없이 두 ZIP으로 나눴습니다. `GIP-01-GitHub-web-upload.zip`에는 65개, `GIP-02-GitHub-web-upload.zip`에는 82개가 들어 있습니다. **둘 다 같은 GitHub 저장소의 첫 화면(최상위 위치)에 업로드**해야 완성됩니다. ZIP 자체는 올리지 마세요.

1. GitHub에서 빈 저장소를 만듭니다. 처음 만드는 경우 저장소 이름은 `gip-baseball`로 적고 README, `.gitignore`, 라이선스 생성은 선택하지 않습니다. 이미 **빈** 저장소를 만들었다면 그것을 쓰세요.
2. `GIP-01-GitHub-web-upload.zip`을 다운로드하고 파일 탐색기에서 마우스 오른쪽 버튼 → **모두 압축 풀기**를 누릅니다. 풀린 폴더 **안**을 열면 `README.md`, `app`, `lib`, `public`, `package.json` 등이 보입니다.
3. GitHub 저장소 첫 화면에서 **Add file → Upload files**를 누릅니다. Windows 파일 탐색기에서 1번 압축을 푼 폴더 **안의 모든 항목**을 `Ctrl+A`로 선택해 GitHub 웹페이지의 업로드 영역으로 **드래그해서 놓습니다**. **Choose your files로 ZIP 파일 하나를 선택하면 안 됩니다.** 파일들이 표시되면 아래의 **Commit changes**를 눌러 첫 번째 업로드를 완료합니다.
4. `GIP-02-GitHub-web-upload.zip`도 **모두 압축 풀기**를 누릅니다. **같은 GitHub 저장소의 첫 화면**에서 다시 **Add file → Upload files**를 누르고, 두 번째 압축을 푼 폴더 **안의 모든 항목**을 드래그해서 놓은 다음 **Commit changes**를 누릅니다. 첫 번째 폴더 안에 두 번째 폴더를 붙여 넣지 마세요.
5. 저장소 첫 화면에 `README.md`, `package.json`, `app`, `lib`, `public`, `components`가 나란히 보이면 완료입니다. `gip-baseball`이나 `GIP-01-GitHub-web-upload` 같은 폴더가 한 겹 더 나타나면 위치를 잘못 올린 것입니다.

`app`은 웹 화면과 데이터 API, `lib`는 데이터 처리, `public`은 캐릭터·폰트, `components`는 화면 구성 요소입니다. 첨부된 `tsconfig.json`도 필요한 설정 파일 하나이므로 그것만 따로 올리지 않습니다. `node_modules`, `.next`, `dist`, `out`, `.env`는 넣지 않습니다.

GitHub에 업로드해도 현재 Sites 주소가 자동으로 갱신되지는 않습니다. `/api/baseball` 서버 경로가 필요하므로 GitHub Pages 같은 정적 파일 전용 호스팅에서는 경기 데이터가 작동하지 않습니다. 이미 코드가 들어 있는 저장소에 업로드한다면 파일이 겹칠 수 있으니 어떤 파일이 올라가 있는지 먼저 확인하세요.

## 로컬 실행

Node.js 22.13 이상과 pnpm 11.25가 필요합니다.

```sh
pnpm install --frozen-lockfile
pnpm dev --port 3000
```

브라우저에서 `http://localhost:3000`을 여세요. 빌드 확인은 `pnpm typecheck`와 `pnpm build`로 할 수 있습니다. 빌드한 결과를 실행할 때는 `pnpm start`를 사용합니다.

## 주요 기능과 데이터

- 홈 / 순위 / 기록 / 마이, 대륙·리그별 경기와 순위, 여러 응원팀 선택
- 경기 전에는 우리 집 경기 카드에 `경기 전`을 표시하고 카드 가운데에 시작 시간을 유지
- 한줄평과 직관 후기 작성·수정·삭제, 사진 첨부, 우리 캐릭터 성장
- KBO 일정·순위: 네이버 스포츠. NPB 일정·순위: Yahoo! JAPAN 스포나비. CPBL 순위: CPBL 공식 팀별 상·하반기 기록 합산.
- MLB 및 지원하는 일부 해외 리그 일정·순위: MLB Stats API. 아직 연결되지 않은 리그는 준비 상태로 표시합니다.
- 경기 시간은 한국 시간 기준이며, 홈 화면은 열려 있는 동안 약 60초마다 새로 확인합니다. 제공처 응답이 실패하면 예시 경기로 대체하지 않습니다.

경기 데이터 어댑터는 `lib/gip/live-baseball.ts`, KBO·NPB·CPBL 서버 경로는 `app/api/baseball/route.ts`에 있습니다. `lib/gip/catalog.ts`는 화면에 표시할 팀 이름과 내부 ID를 관리합니다.

## 계정과 운영 시 참고 사항

현재 GIP CODE, 응원팀, 후기, 사진은 **사용 중인 브라우저의 localStorage에만 저장**됩니다. 다른 기기와 동기화되지 않고 브라우저 데이터를 지우면 복구할 수 없습니다. 비밀번호는 원문 대신 솔트와 PBKDF2 검증값을 저장하지만, 브라우저 저장소 자체는 서버 인증·권한 시스템이 아닙니다. 알림 설정은 저장되지만 실제 알림은 발송하지 않습니다.

`/terms`와 `/privacy` 페이지가 있습니다. 공개 운영자명과 문의처는 아직 제공되지 않아 정식 운영 문서를 완성하려면 해당 내용을 채워야 합니다. `supabase/schema.sql`은 미래의 서버 계정 설계를 위한 초안이며 현재 서비스에서 사용하지 않습니다.

`.openai/hosting.json`은 **기존 GIP Sites 프로젝트**의 설정입니다. 다른 Sites 프로젝트를 만드는 경우 이 프로젝트 ID를 그대로 사용하지 마세요. `legacy/`는 이전 화면과 API의 비활성 참고 자료입니다.

## 라이선스

Pretendard Variable: SIL Open Font License 1.1 (`public/fonts/OFL.txt`). Lucide React: ISC (`LICENSES/lucide.txt`).
