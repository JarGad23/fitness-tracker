export function AuthHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-1.5">
      <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
