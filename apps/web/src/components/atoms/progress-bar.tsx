export function ProgressBar({ percent }: { percent: number }): JSX.Element {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
      <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${clamped}%` }} />
    </div>
  );
}
