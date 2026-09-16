import { Skeleton } from '@/components/ui/skeleton'
export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-label="Cargando página">
      <Skeleton className="h-10 w-60" />
      <Skeleton className="h-36 w-full" />
      <div className="grid grid-cols-2 gap-5">
        <Skeleton className="h-60" />
        <Skeleton className="h-60" />
      </div>
    </div>
  )
}
