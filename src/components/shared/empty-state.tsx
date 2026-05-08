import { PackageOpen } from "lucide-react"

interface Props {
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
      <PackageOpen className="mb-4 h-12 w-12 text-gray-400" />
      <h3 className="text-lg font-medium text-gray-600">{title}</h3>
      <p className="mb-4 text-sm text-gray-500">{description}</p>
      {action}
    </div>
  )
}
