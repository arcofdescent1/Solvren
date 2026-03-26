type Props = {
  text: string;
};

export function WhySurfacedText({ text }: Props) {
  return <p className="text-xs text-[var(--text-muted)]">Why this surfaced: {text}</p>;
}
