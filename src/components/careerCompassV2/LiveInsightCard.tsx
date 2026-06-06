interface Props {
  text: string;
}

export default function LiveInsightCard({ text }: Props) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm" aria-hidden>💬</span>
      <p className="text-sm text-emerald-900 leading-relaxed">{text}</p>
    </div>
  );
}
