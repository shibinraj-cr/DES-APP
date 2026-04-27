export default function DashboardLoading() {
  return (
    <div className="h-full flex flex-col animate-pulse">
      <div className="px-6 py-4 border-b border-border" style={{ background: 'oklch(0.13 0.010 255)' }}>
        <div className="h-5 w-40 bg-muted/30 rounded" />
      </div>
      <div className="flex-1 p-6 space-y-4">
        <div className="h-8 w-64 bg-muted/20 rounded" />
        <div className="h-4 w-full bg-muted/20 rounded" />
        <div className="h-4 w-5/6 bg-muted/20 rounded" />
        <div className="h-4 w-4/6 bg-muted/20 rounded" />
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="h-24 bg-muted/20 rounded-xl" />
          <div className="h-24 bg-muted/20 rounded-xl" />
          <div className="h-24 bg-muted/20 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
