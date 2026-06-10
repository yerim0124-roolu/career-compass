// 배경 아이보리는 컷아웃해 투명으로 — 그 아래 라디얼 그라데이션을 깔아 '가장자리 흰색 →
// 중앙 진한 아이보리'를 만든다(이미지 안에 색을 굽지 않음).
import cutoutImage from '../../assets/closing-illustration-cutout.png';

// 마무리 인용 카드 — 글자 없는 손그림(투명 배경) 1장 재사용 + CSS 그라데이션 배경 위에 텍스트만 오버레이.
//  · 배경: 라디얼 그라데이션(가장자리 흰색 → 중앙 진한 아이보리) + 그 위에 투명 컷아웃 일러스트(burn-in 금지)
//  · 텍스트: props.message (줄바꿈은 \n 으로, white-space: pre-line 보존)
//  · 인물(시선 위) 윗 빈 공간(상단 ~46%)에 가운데 정렬, 폭 70%, 반응형 font-size(clamp)
//  · Pretendard, 색 #3f3f46, 줄간격 1.9
//
// 배경 일러스트 비율 1672×941 (≈16:9). 인물 윤곽은 ≈47% 지점부터라 텍스트 영역은 상단 0~46%.
export default function ClosingQuoteCard({ message }: { message: string }) {
  return (
    <div
      className="relative mx-auto w-full max-w-2xl"
      style={{
        containerType: 'inline-size', // cqi(font clamp)를 카드 폭 기준으로
        aspectRatio: '1672 / 941',
        // 다중 배경: 맨 앞(위)이 컷아웃, 그 아래가 그라데이션.
        // 농도 30% 연하게(크림색을 흰색 쪽으로) + 중앙 밀집형(반경 축소).
        backgroundImage: `url(${cutoutImage}), radial-gradient(46% 48% at 50% 46%, #FCF5E9 0%, #FEF9F2 55%, #FFFFFF 100%)`,
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        backgroundRepeat: 'no-repeat, no-repeat',
      }}
      role="img"
      aria-label={message.replace(/\n/g, ' ')}
    >
      {/* 텍스트 오버레이 — 인물 위 빈 공간(상단 영역)에 세로 가운데 */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: '44%' }}>
        <p
          style={{
            width: '74%',
            whiteSpace: 'pre-line',
            textAlign: 'center',
            color: '#3f3f46',
            fontWeight: 600,
            lineHeight: 1.72,
            letterSpacing: '-0.01em',
            // 문구는 그대로, 글자만 살짝 줄여 일러스트가 감성 anchor로 더 보이게(카드 폭 기준 반응형)
            fontSize: 'clamp(13px, 2.6cqi, 21px)',
          }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
