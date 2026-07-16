type MetricCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: "default" | "green" | "yellow" | "red";
};

const toneClasses = {
  default: "border-kredo-line",
  green: "border-green-200 bg-green-50",
  yellow: "border-yellow-200 bg-yellow-50",
  red: "border-red-200 bg-red-50",
};

export function MetricCard({ label, value, helper, tone = "default" }: MetricCardProps) {
  return (
    <article className={`rounded-lg border bg-white p-4 ${toneClasses[tone]}`}>
      <p className="text-sm font-medium text-kredo-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-kredo-ink">{value}</p>
      {helper ? <p className="mt-1 text-xs text-kredo-muted">{helper}</p> : null}
    </article>
  );
}
