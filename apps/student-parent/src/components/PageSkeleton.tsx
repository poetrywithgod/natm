// Shown while a lazy-loaded page's code is still downloading. Matches the
// Abyssal Nova theme so it reads as "loading" rather than a broken layout.
export default function PageSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-4 animate-pulse">
      <div className="h-6 w-40 rounded bg-abyssal-700" />
      <div className="h-4 w-24 rounded bg-abyssal-700" />
      <div className="space-y-3 mt-6">
        <div className="h-16 rounded-lg bg-abyssal-900" />
        <div className="h-16 rounded-lg bg-abyssal-900" />
        <div className="h-16 rounded-lg bg-abyssal-900" />
      </div>
    </div>
  );
}
