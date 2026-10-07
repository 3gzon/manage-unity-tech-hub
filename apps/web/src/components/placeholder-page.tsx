interface PlaceholderPageProps {
  title: string;
  description: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
        This module will be implemented in a future prompt.
      </div>
    </div>
  );
}
