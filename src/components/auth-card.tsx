import { Dumbbell } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Shared frame for the login / register screens: brand mark, title, description.
// The form body is passed as children (each page owns its own fields).
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="w-full rounded-3xl border-border/50 shadow-xl shadow-primary/5">
      <CardHeader className="gap-2 px-6 pb-2 pt-8 text-center sm:px-8">
        <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25 ring-1 ring-primary/20">
          <Dumbbell className="h-8 w-8 text-primary-foreground" />
        </div>
        <CardTitle className="font-heading text-2xl font-bold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardHeader>
      {children}
    </Card>
  );
}
