export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      {description && (
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      )}
    </div>
  )
}
