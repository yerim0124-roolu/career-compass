# 손그림 결과지 — 에셋 & 적용 가이드

## 전체 워크플로우

```
[1] 손그림 테두리 SVG      → Cowork에서 바로 적용 (코드 제공됨)
[2] Gaegu 폰트             → Cowork에서 바로 적용 (Google Fonts)
[3] 크림 배경 + 종이질감    → Cowork에서 바로 적용 (CSS)
[4] 일러스트 (구름/별/꽃 등) → GPT로 생성 후 투명 PNG로 폴더에 넣기
```

테두리·폰트·배경은 코드라 Cowork가 바로 함.
일러스트만 GPT 생성이 필요(그림체 통일 때문).

---

## [1] 손그림 테두리 — border-frame.svg

두 가지 적용법. **방법 B(border-image) 권장** — 텍스트 길이 변해도 안 깨짐.

### 방법 A: 배경처럼 깔기 (간단, 살짝 늘어남)
```css
.handdrawn-card {
  background-color: #FBF8F0;
  border: none;
  background-image: url('/assets/border-frame.svg');
  background-size: 100% 100%;   /* 카드 크기에 맞춰 늘어남 */
  background-repeat: no-repeat;
  padding: 28px 24px;
  border-radius: 24px;          /* SVG 모양과 맞춤 */
}
```

### 방법 B: border-image 9-slice (모서리 안 늘어남, 권장)
```css
.handdrawn-card {
  background-color: #FBF8F0;
  border: 14px solid transparent;
  border-image-source: url('/assets/border-frame.svg');
  border-image-slice: 30 fill;   /* 모서리 30px 고정, 변만 늘어남 */
  border-image-width: 14px;
  border-image-repeat: stretch;
  padding: 16px 14px;
}
```

### 딱딱함 제거 (선택)
```css
.handdrawn-card {
  transform: rotate(-0.25deg);   /* 아주 살짝 비뚤게 */
}
.handdrawn-card:nth-child(even) {
  transform: rotate(0.25deg);    /* 카드마다 방향 교차 */
}
```

---

## [2] Gaegu 폰트 (개구) — Google Fonts, 무료

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&display=swap" rel="stylesheet">
```
```css
body, .handdrawn-card {
  font-family: 'Gaegu', sans-serif;
  letter-spacing: 0.01em;
  line-height: 1.85;          /* 손글씨는 줄간격 넉넉히 */
}
h1, .card-title { font-weight: 700; }
```

> 본문 가독성이 걱정되면: 제목만 Gaegu, 본문은 Pretendard 유지하는 하이브리드도 가능.
> 단 1번 이미지 느낌을 100% 내려면 본문도 Gaegu.

---

## [3] 크림 배경 + 종이 질감

```css
body {
  background-color: #FBF8F0;
  /* 종이 질감 (선택): 미세 노이즈 SVG 필터 */
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

---

## 색 팔레트 (1번 이미지 기준)

```
배경 크림        #FBF8F0
테두리 차콜      #3A3A3A
헤더 라벤더      #C9B8E8  (수채 느낌 — 연하게)
민트 카드        #DDEBDD  (현재 우선순위)
라벤더 카드      #E7E0F2  (확인할 방향)
그레이 카드      #ECECEF  (판단 시점)
포인트 주황      #F5946B  (하트/꽃)
포인트 노랑      #F2C94C  (별)
본문 글자        #3F3F46
```

---

## 일러스트 배치 위치 (1번 기준)

| 일러스트 | 위치 | z-index |
|---|---|---|
| 점선 구름 | 헤더 좌상단 | 헤더 위 |
| 파란 구름 | 헤더 좌측 | 헤더 위 |
| 노란 별 ×2 | 헤더 우상단/여백 | 위 |
| 빈 별 ×2 | 여백 곳곳 | 위 |
| 주황 하트 | 헤더 좌하단 | 위 |
| 곡선 장식 | 우측 여백 | 위 |
| 새싹 | 현재우선순위 카드 우하단 | 카드 위 |
| 보라 별 | 확인할방향 카드 우하단 | 카드 위 |
| 달력 체크 | 판단시점 카드 우하단 | 카드 위 |
| 별(제목옆) | "맞춤 분석" 좌측 | 위 |
| 꽃병+꽃 | 본문 카드 우하단 | 카드 위 |
| 단독 꽃 | 본문 카드 좌하단 | 카드 위 |
| 작은 하트 | 본문 곳곳 | 위 |

배치는 `position: absolute` + 부모 `position: relative`.
일러스트는 `pointer-events: none`로 클릭 방해 안 하게.

```css
.deco {
  position: absolute;
  pointer-events: none;
  user-select: none;
}
.deco-cloud-1 { top: 8%; left: 6%; width: 64px; }
.deco-star-1  { top: 10%; right: 8%; width: 40px; }
/* ... 위치별로 */
```
