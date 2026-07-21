# 카카오톡 링크 미리보기 — 없는 문구를 코드에서 찾지 말 것 (OG 폴백)

날짜: 2026-07-21

## 해결한 문제

카카오톡 공유 시 미리보기 제목이 "Career Compass — 커리어 선택지 분석기", 설명이 "여기를 눌러 링크를 확인하세요."로 나오는 것을 개선해야 했다.

## 사용자에게 나타난 증상

메신저 공유 카드에 서비스 성격이 드러나지 않는 제목과, 아무 정보가 없는 안내 문구가 표시됨. 대표 이미지도 없음.

## 확인된 근본 원인

- **`"여기를 눌러 링크를 확인하세요."`는 이 저장소 어디에도 없다**(전체 grep 0건). `og:description`이 없을 때 **카카오톡이 자동으로 채우는 기본 문구**다. 코드에서 찾아 지우려 하면 시간만 버린다.
- 미리보기 제목은 `index.html`의 `<title>`. `og:title`이 없어 크롤러가 `<title>`로 폴백한 것.
- 근본 원인은 단순했다: **`index.html`에 `og:*`/`twitter:*` 태그가 0개**였다. 지울 것이 아니라 채울 것이 없던 상태.

## 고려하거나 시도한 접근법

- React 런타임(useEffect 등)에서 메타태그 주입 — 채택하지 않음. 카카오/페이스북 크롤러는 JS를 실행하지 않고 **최초 HTML 응답만** 읽으므로 Vite SPA에서는 무의미하다.
- 코드에서 폴백 문구 검색·제거 — 애초에 존재하지 않아 불가능(위 근본 원인).

## 최종 해결 방법과 선택 이유

`index.html`에 OG/Twitter 태그를 **정적으로** 작성(빌드 산출물에 그대로 실림). 대표 이미지는 Pillow로 1200×630 PNG를 생성해 `public/`에 두고 **절대 HTTPS URL**로 참조. `meta description`도 og:description과 같은 문구로 통일해 검색/공유 메시지를 일치시켰다.

이미지 제작: 이 환경에는 sharp/puppeteer/ImageMagick/rsvg가 없고 **Pillow(PIL)와 macOS의 `AppleSDGothicNeo.ttc`(Bold/SemiBold 포함)** 는 있다. 한글 OG 이미지가 필요하면 이 조합으로 바로 만들 수 있다(TTC는 `ImageFont.truetype(path, size, index=6)` = Bold).

## 변경된 주요 파일

- `index.html` — OG 13종 + canonical + description 통일.
- `public/og-career-compass.png` — 1200×630 신규.

## 검증 방법과 결과

- 빌드 산출물과 **production 원본 HTML을 `curl`로 직접 받아** 태그 개수/중복/절대 URL 검증(각 1개, 중복 0). 브라우저 DOM이 아니라 raw 응답을 봐야 크롤러 관점과 일치한다.
- 카카오 크롤러 UA(`kakaotalk-scrap/1.0`)로도 동일 응답 확인.
- OG 이미지 production 200 / `image/png` / 1200×630 확인.
- 앱 코드 diff 0(`src api db vercel.json`), 33 스위트 2087 PASS.

## 재발 방지 원칙

- 메신저 미리보기 문구가 이상하면 **먼저 `curl`로 raw HTML의 og 태그 유무를 본다.** 화면에 보이는 문구가 코드에 있다고 가정하지 말 것 — 상당수는 크롤러/메신저의 폴백이다.
- SPA에서 공유 메타태그는 반드시 `index.html`에 정적으로. 런타임 주입은 크롤러에 보이지 않는다.
- OG 이미지·URL은 항상 절대 HTTPS. 상대 경로는 카카오에서 무시된다.
- **배포해도 즉시 반영되지 않는다.** 카카오는 URL 단위로 캐싱하므로 [카카오 개발자 도구의 캐시 초기화](https://developers.kakao.com/tool/clear/og)를 먼저 실행하고, **새 채팅방**에서 재전송해 확인한다(기존 대화방의 카드는 갱신되지 않음). 캐시를 지우기 전에 코드를 다시 고치면 헛수정이 된다.

## 남은 위험 / 후속 작업

- 카카오 캐시 초기화는 개발자 계정 로그인이 필요해 자동화 불가 — 사용자가 수동 수행해야 한다.
- 현재 OG는 루트 URL 기준 1종. 결과 공유(개인별 카드) 같은 URL별 미리보기가 필요해지면 SSR/Edge 함수나 정적 라우트별 HTML이 필요하다.
