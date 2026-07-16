type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-4">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.16em] text-kredo-primary">{eyebrow}</p> : null}
      <h1 className="mt-1 text-2xl font-bold leading-tight text-kredo-ink">{title}</h1>
      {description ? <p className="mt-2 text-sm leading-6 text-kredo-muted">{description}</p> : null}
    </div>
  );
}
