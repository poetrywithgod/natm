export default function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="font-ui text-xs text-slate-400 uppercase tracking-wide">{label}</span>
        <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <Icon size={16} className="text-amber-500" />
        </div>
      </div>
      <p className="font-display text-2xl lg:text-3xl font-extrabold text-slate-100 truncate">{value}</p>
    </div>
  );
}
