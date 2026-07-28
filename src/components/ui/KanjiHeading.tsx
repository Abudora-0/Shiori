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
    <div className="relative mb-5 pt-3 md:mb-8 md:pt-6">
      <span className="kanji-watermark -top-3 left-0 text-[4.5rem] md:-top-6 md:text-[9rem]">
        {kanji}
      </span>
      <h1 className="relative z-10 font-display text-2xl font-bold tracking-wide md:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="relative z-10 mt-1.5 max-w-xl text-xs text-muted md:mt-2 md:text-sm">
          {subtitle}
        </p>
      )}
      <div className="torii-rule relative z-10 mt-3 w-32 md:mt-5 md:w-44" />
    </div>
  );
}
