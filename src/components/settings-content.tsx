"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Plus, Pencil, Trash2, Settings2, Loader2, Dumbbell } from "lucide-react";
import { getActivityIcon, activityIconElement } from "@/lib/activity-icons";
import {
  resolveActivityColor,
  activityColorStyles,
} from "@/lib/activity-colors";
import { IconPicker } from "@/components/icon-picker";
import { ColorPicker } from "@/components/color-picker";
import {
  createActivityType,
  updateActivityType,
  deleteActivityType,
} from "@/actions/activity-types";
import type { ActivityType } from "@/lib/db/schema";

function ActivityTypeForm({
  activityType,
  onClose,
}: {
  activityType?: ActivityType;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [name, setName] = useState(activityType?.name ?? "");
  const [target, setTarget] = useState(activityType?.targetPerWeek ?? 3);
  const [icon, setIcon] = useState(activityType?.icon ?? "Dumbbell");
  const [color, setColor] = useState(
    activityType ? resolveActivityColor(activityType) : "#22c55e"
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("Podaj nazwę aktywności");
      return;
    }

    setIsPending(true);
    const formData = new FormData();
    formData.set("name", name.trim());
    formData.set("targetPerWeek", String(target));
    formData.set("icon", icon);
    formData.set("color", color);

    try {
      const result = activityType
        ? await updateActivityType(activityType.id, formData)
        : await createActivityType(formData);

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(activityType ? "Zapisano zmiany" : "Dodano aktywność");
      onClose();
      router.refresh();
    } catch (error) {
      console.error("Failed to save activity type:", error);
      toast.error("Nie udało się zapisać");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Live preview */}
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}1a`, color }}
        >
          {activityIconElement(icon, { className: "h-6 w-6" })}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold">
            {name.trim() || "Nazwa aktywności"}
          </p>
          <p className="text-sm text-muted-foreground">{target}x / tydzień</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="font-medium">
          Nazwa
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="np. Siłownia"
          required
          className="h-12 rounded-xl px-4"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetPerWeek" className="font-medium">
          Cel tygodniowy
        </Label>
        <Input
          id="targetPerWeek"
          type="number"
          min={1}
          max={14}
          value={target}
          onChange={(e) => setTarget(Number(e.target.value) || 1)}
          required
          className="h-12 rounded-xl px-4"
        />
      </div>

      <div className="space-y-2">
        <Label className="font-medium">Ikona</Label>
        <IconPicker value={icon} onChange={setIcon} color={color} />
      </div>

      <div className="space-y-2">
        <Label className="font-medium">Kolor</Label>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 h-12 rounded-xl"
        >
          Anuluj
        </Button>
        <Button
          type="submit"
          disabled={isPending}
          className="flex-[2] h-12 rounded-xl"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Zapisywanie...
            </>
          ) : activityType ? (
            "Zapisz"
          ) : (
            "Dodaj"
          )}
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
    try {
      const result = await deleteActivityType(id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Usunięto aktywność");
      router.refresh();
    } catch (error) {
      console.error("Failed to delete activity type:", error);
      toast.error("Nie udało się usunąć");
    }
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
          <DialogContent className="sm:max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
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
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Dodaj aktywność
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {initialActivityTypes.map((type) => {
                const Icon = getActivityIcon(type.icon);
                const hex = resolveActivityColor(type);
                const styles = activityColorStyles(hex);

                return (
                  <div
                    key={type.id}
                    className="flex items-center gap-4 p-4 lg:p-5 hover:bg-muted/30 transition-colors"
                  >
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={styles.soft}
                    >
                      <Icon className="w-6 h-6" style={styles.text} />
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
                        <DialogContent className="sm:max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="text-xl">
                              Edytuj typ aktywności
                            </DialogTitle>
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
