export function DocsHero({
  title,
  description,
  searchSlot,
}: {
  title?: string;
  description?: string;
  searchSlot?: React.ReactNode;
}) {
  return (
    <header className="border-b border-white/10 pb-10">
      <h1 className="text-3xl font-bold tracking-tight text-white">
        {title ?? "Solvren Documentation"}
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl text-lg text-slate-300">
          {description}
        </p>
      )}
      {searchSlot && <div className="mt-6">{searchSlot}</div>}
    </header>
  );
}
