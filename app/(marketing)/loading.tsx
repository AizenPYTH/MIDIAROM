import { Container, Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <Container className="space-y-4 py-12">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </Container>
  );
}
