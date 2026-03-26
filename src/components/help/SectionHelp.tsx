type Props = {
  text: string;
};

export function SectionHelp({ text }: Props) {
  return <p className="text-sm text-[var(--text-muted)]">{text}</p>;
}
