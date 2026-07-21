export function KanjiHeading({
  kanji,
  title,
  subtitle,
}: {
  kanji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="relative mb-8 pt-6">
      <span className="kanji-watermark -top-6 left-0 text-[7rem] md:text-[9rem]">
        {kanji}
      </span>
      <h1 className="relative z-10 font-display text-3xl font-bold tracking-wide md:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="relative z-10 mt-2 max-w-xl text-sm text-muted">{subtitle}</p>
      )}
      <div className="torii-rule relative z-10 mt-5 w-44" />
    </div>
  );
}
