"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
  Plus,
  Pencil,
  Trash2,
  LucideIcon,
  Settings2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getActivityColor } from "@/lib/activity-colors";
import {
  createActivityType,
  updateActivityType,
  deleteActivityType,
} from "@/actions/activity-types";
import type { ActivityType } from "@/lib/db/schema";

const iconOptions = [
  { name: "Dumbbell", icon: Dumbbell, label: "Hantle" },
  { name: "PersonStanding", icon: PersonStanding, label: "Bieganie" },
  { name: "Bike", icon: Bike, label: "Rower" },
  { name: "Waves", icon: Waves, label: "Pływanie" },
];

const iconMap: Record<string, LucideIcon> = {
  Dumbbell,
  PersonStanding,
  Bike,
  Waves,
};

function ActivityTypeForm({
  activityType,
  onClose,
}: {
  activityType?: ActivityType;
  onClose: () => void;
}) {
  const [isPending, setIsPending] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(
    activityType?.icon || "Dumbbell"
  );
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    formData.set("icon", selectedIcon);

    if (activityType) {
      await updateActivityType(activityType.id, formData);
    } else {
      await createActivityType(formData);
    }
    setIsPending(false);
    onClose();
    router.refresh();
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name" className="font-medium">Nazwa</Label>
        <Input
          id="name"
          name="name"
          defaultValue={activityType?.name}
          placeholder="np. Siłownia"
          required
          className="h-12 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetPerWeek" className="font-medium">Cel tygodniowy</Label>
        <Input
          id="targetPerWeek"
          name="targetPerWeek"
          type="number"
          min={1}
          max={14}
          defaultValue={activityType?.targetPerWeek || 3}
          required
          className="h-12 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <Label className="font-medium">Ikona</Label>
        <div className="grid grid-cols-4 gap-2">
          {iconOptions.map((option) => (
            <button
              key={option.name}
              type="button"
              onClick={() => setSelectedIcon(option.name)}
              className={cn(
                "p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all",
                selectedIcon === option.name
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <option.icon className="w-5 h-5" />
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1 h-12 rounded-xl">
          Anuluj
        </Button>
        <Button type="submit" disabled={isPending} className="flex-[2] h-12 rounded-xl">
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Zapisywanie...
            </>
          ) : activityType ? "Zapisz" : "Dodaj"}
        </Button>
      </div>
    </form>
  );
}

export function SettingsContent({
  activityTypes: initialActivityTypes,
}: {
  activityTypes: ActivityType[];
}) {
  const [editingType, setEditingType] = useState<ActivityType | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Czy na pewno chcesz usunąć ten typ aktywności?")) return;
    await deleteActivityType(id);
    router.refresh();
  }

  return (
    <div className="p-4 lg:p-0 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ustawienia</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zarządzaj swoimi celami tygodniowymi
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger render={<Button className="rounded-xl h-11 gap-2" />}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Dodaj aktywność</span>
          </DialogTrigger>
          <DialogContent className="rounded-2xl sm:rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Nowy typ aktywności</DialogTitle>
            </DialogHeader>
            <ActivityTypeForm onClose={() => setIsAddDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-muted-foreground" />
            Typy aktywności
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialActivityTypes.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Brak aktywności</h3>
              <p className="text-muted-foreground mb-4">
                Dodaj swój pierwszy typ aktywności
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)} className="rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Dodaj aktywność
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {initialActivityTypes.map((type) => {
                const Icon = iconMap[type.icon] || Dumbbell;
                const colors = getActivityColor(type.name);

                return (
                  <div
                    key={type.id}
                    className="flex items-center gap-4 p-4 lg:p-5 hover:bg-muted/30 transition-colors"
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      colors.bg
                    )}>
                      <Icon className={cn("w-6 h-6", colors.text)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{type.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {type.targetPerWeek}x / tydzień
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Dialog
                        open={editingType?.id === type.id}
                        onOpenChange={(open) => !open && setEditingType(null)}
                      >
                        <DialogTrigger
                          render={
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingType(type)}
                              className="rounded-xl h-10 w-10 hover:bg-muted"
                            />
                          }
                        >
                          <Pencil className="w-4 h-4" />
                        </DialogTrigger>
                        <DialogContent className="rounded-2xl sm:rounded-3xl">
                          <DialogHeader>
                            <DialogTitle className="text-xl">Edytuj typ aktywności</DialogTitle>
                          </DialogHeader>
                          <ActivityTypeForm
                            activityType={type}
                            onClose={() => setEditingType(null)}
                          />
                        </DialogContent>
                      </Dialog>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-xl h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(type.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
