// Shown instantly while a page's data loads, shaped like the page so nothing jumps when it arrives.
export default function Loading() {
  return (
    <div className="stack" aria-busy="true" aria-label="Loading">
      <div className="page-head">
        <div className="grid gap-2">
          <div className="skeleton h-7 w-40" />
          <div className="skeleton h-4 w-64 max-w-[70vw]" />
        </div>
      </div>
      <div className="skeleton h-44 rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton h-24 rounded-2xl" />
        <div className="skeleton col-span-2 h-24 rounded-2xl lg:col-span-1" />
      </div>
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  );
}
