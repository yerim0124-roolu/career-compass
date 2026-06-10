# 손그림 일러스트 생성 프롬프트 (GPT / 이미지 생성 모델용)

## 사용법

그림체 통일이 가장 중요. 아래 **[공통 스타일]** 을 모든 프롬프트 앞에 똑같이 붙인다.
한 번에 여러 개를 같은 대화에서 뽑으면 스타일이 더 잘 유지된다.
배경은 반드시 **투명(transparent PNG)** 으로 요청.

---

## [공통 스타일] — 모든 프롬프트 앞에 붙일 것

```
Minimalist hand-drawn doodle in a cute Korean diary style.
Thin black pen outline (about 2px), loose and slightly wobbly lines.
Only partial pastel watercolor fill, soft and light, leaving white space.
Flat, no shadows, no gradients background. Transparent background (PNG).
Childlike, warm, gentle aesthetic. Single small object, centered.
```

영문 프롬프트를 권장(이미지 모델이 더 정확). 아래 개별 항목만 바꿔 붙인다.

---

## 개별 일러스트 (12종)

### 1. 점선 말풍선 구름
```
[공통 스타일]
A small thought-bubble cloud drawn with a dotted/dashed outline,
with three tiny dots inside, like a daydream bubble.
```

### 2. 파란 구름
```
[공통 스타일]
A small puffy cloud with light blue watercolor fill.
```

### 3. 노란 별 (채색)
```
[공통 스타일]
A small five-pointed star filled with soft yellow watercolor.
```

### 4. 빈 별 (윤곽선만)
```
[공통 스타일]
A small five-pointed star, outline only, no fill, just thin black pen line.
```

### 5. 주황 하트
```
[공통 스타일]
A small heart filled with soft coral-orange watercolor.
```

### 6. 반짝임 / 스파클
```
[공통 스타일]
A tiny four-point sparkle/twinkle mark, outline with a touch of yellow.
```

### 7. 곡선 장식선
```
[공통 스타일]
A small decorative swirly curved line, like a gentle flourish, black pen only.
```

### 8. 꽃병에 담긴 꽃
```
[공통 스타일]
A small simple vase holding two or three flowers,
one orange flower and green leaves, soft watercolor fill.
```

### 9. 단독 꽃 (주황)
```
[공통 스타일]
A single small flower with orange watercolor petals and a thin stem with leaves.
```

### 10. 새싹
```
[공통 스타일]
A tiny sprout with two small green leaves coming out of the ground, soft green fill.
```

### 11. 보라 별
```
[공통 스타일]
A small five-pointed star filled with soft lavender-purple watercolor.
```

### 12. 달력 체크
```
[공통 스타일]
A small desk calendar icon with a check mark, light outline, minimal.
```

---

## 추출 팁

1. **한 번에 같은 대화에서** 1→12 순서로 연속 생성하면 그림체가 가장 일정.
2. 만약 모델이 한 이미지에 여러 개를 그리면 "single object only, one item, centered" 강조.
3. 배경이 흰색으로 나오면 생성 후 배경 제거 툴(remove.bg 등)로 투명 처리.
   또는 프롬프트에 "isolated on pure white background, easy to cut out" 추가.
4. 생성 후 파일명을 가이드와 맞춰 저장:
   cloud-dotted.png / cloud-blue.png / star-yellow.png / star-outline.png /
   heart-coral.png / sparkle.png / swirl.png / vase-flowers.png /
   flower-orange.png / sprout.png / star-purple.png / calendar-check.png
5. 이 PNG들을 작업 폴더 `public/assets/deco/` 에 넣고,
   APPLY_GUIDE.md의 배치 CSS대로 position absolute로 얹는다.

---

## 헤더 수채 배경 (선택 — 1번의 보라 헤더용)

헤더 보라색을 1번처럼 수채 번짐으로 하려면 이것도 생성:
```
[공통 스타일 중 색만 바꿈]
A soft watercolor wash rectangle in light lavender purple,
uneven painterly edges, gentle bleeding, horizontal banner shape.
Transparent background outside the wash.
```
이걸 헤더 div의 background-image로 깔고 위에 텍스트.
단 텍스트 길이 변하면 늘어나므로, 단색 라벤더(#C9B8E8) + 손그림 테두리로 대체해도 충분.
```
