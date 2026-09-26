export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
