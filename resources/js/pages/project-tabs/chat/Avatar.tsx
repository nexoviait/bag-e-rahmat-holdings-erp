// Initials-in-circle avatar — avatar_path exists on the schema (users +
// conversations) but no upload UI/endpoint exists yet in this pass, so every
// avatar renders from initials today. Swapping in a real <img> once uploads
// exist only touches this one component.
const PALETTE = [
  "bg-rose-500/20 text-rose-300",
  "bg-amber-500/20 text-amber-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-sky-500/20 text-sky-300",
  "bg-violet-500/20 text-violet-300",
  "bg-pink-500/20 text-pink-300",
  "bg-teal-500/20 text-teal-300",
];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  size = 36,
  online,
}: {
  name: string;
  size?: number;
  online?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className={`grid h-full w-full place-items-center rounded-full font-semibold ${colorFor(name || "?")}`}
        style={{ fontSize: size * 0.38 }}
      >
        {initialsFor(name || "?")}
      </div>
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 rounded-full ring-2 ring-background ${
            online ? "bg-emerald-500" : "bg-muted-foreground/50"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
