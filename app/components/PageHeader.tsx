export function PageHeader({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h1 className="page-title">{title}</h1>
      {description && <p className="page-sub">{description}</p>}
    </div>
  )
}
