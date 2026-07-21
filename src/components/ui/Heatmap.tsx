"use client";

/** GitHub-style yearly activity heatmap in Midnight Ink colors. */
export function Heatmap({ data }: { data: Map<string, number> }) {
  // Grid: columns = weeks (53), rows = Sun..Sat. Start from the Sunday
  // 52 weeks before this week's Sunday.
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() - 52 * 7);

  const cells: { date: string; count: number; future: boolean }[] = [];
  const cursor = new Date(start);
  for (let i = 0; i < 53 * 7; i++) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    cells.push({
      date: key,
      count: data.get(key) ?? 0,
      future: cursor > today,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const max = Math.max(1, ...cells.map((c) => c.count));
  const total = cells.reduce((s, c) => s + c.count, 0);

  const color = (count: number): string => {
    if (count === 0) return "var(--ink-800)";
    const level = Math.min(4, Math.ceil((count / max) * 4));
    return [
      "rgba(230, 57, 70, 0.25)",
      "rgba(230, 57, 70, 0.45)",
      "rgba(230, 57, 70, 0.7)",
      "var(--vermillion)",
    ][level - 1];
  };

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid w-max grid-flow-col gap-[3px]"
          style={{ gridTemplateRows: "repeat(7, 10px)" }}
        >
          {cells.map((c) => (
            <div
              key={c.date}
              title={`${c.date} — ${c.count} ${c.count === 1 ? "update" : "updates"}`}
              className="h-[10px] w-[10px] rounded-[2px]"
              style={{
                background: c.future ? "transparent" : color(c.count),
              }}
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-faint">
        <span>{total} updates in the last year</span>
        <span className="flex items-center gap-1">
          Less
          {[0, 1, 2, 3, 4].map((lvl) => (
            <span
              key={lvl}
              className="h-[9px] w-[9px] rounded-[2px]"
              style={{
                background:
                  lvl === 0
                    ? "var(--ink-800)"
                    : [
                        "rgba(230,57,70,0.25)",
                        "rgba(230,57,70,0.45)",
                        "rgba(230,57,70,0.7)",
                        "var(--vermillion)",
                      ][lvl - 1],
              }}
            />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
