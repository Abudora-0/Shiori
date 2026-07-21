export function Chip({
  children,
  color,
  active,
  onClick,
}: {
  children: React.ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-vermillion bg-vermillion/15 text-vermillion-bright"
          : "border-line-strong bg-ink-800 text-muted"
      } ${onClick ? "cursor-pointer hover:border-vermillion/60 hover:text-text" : ""}`}
      style={color && !active ? { color } : undefined}
    >
      {children}
    </Tag>
  );
}
