// Shown while a lazy-loaded page's code is still downloading.
export default function PageSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-6 w-40 rounded bg-slate-800" />
      <div className="h-4 w-24 rounded bg-slate-800" />
      <div className="space-y-3 mt-6">
        <div className="h-16 rounded-2xl bg-slate-900" />
        <div className="h-16 rounded-2xl bg-slate-900" />
        <div className="h-16 rounded-2xl bg-slate-900" />
      </div>
    </div>
  );
}
