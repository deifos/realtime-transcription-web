import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [currentShortcut, setCurrentShortcut] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [tempShortcut, setTempShortcut] = useState<string[]>([]);

  useEffect(() => {
    // Load current shortcut when dialog opens
    if (open && window.electron) {
      window.electron.shortcuts.getCurrent().then(setCurrentShortcut);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (!isRecording) return;

    const key = e.key;
    if (key === "Escape") {
      setIsRecording(false);
      setTempShortcut([]);
      return;
    }

    if (key === "Backspace") {
      setTempShortcut([]);
      return;
    }

    // Ignore repeated keydown events
    if (e.repeat) return;

    // Add modifier keys and regular keys
    const keyToAdd =
      key === "Control" ? "Ctrl" : key.length === 1 ? key.toUpperCase() : key;

    if (!tempShortcut.includes(keyToAdd)) {
      setTempShortcut((prev) => [...prev, keyToAdd]);
    }
  };

  const handleKeyUp = async () => {
    if (!isRecording) return;

    // When all keys are released, save the shortcut
    if (tempShortcut.length > 0) {
      const newShortcut = tempShortcut.join("+");
      const success = await window.electron.shortcuts.update(newShortcut);
      if (success) {
        setCurrentShortcut(newShortcut);
      }
      setIsRecording(false);
      setTempShortcut([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="shortcut" className="text-right">
              Shortcut
            </Label>
            <Input
              id="shortcut"
              value={
                isRecording
                  ? tempShortcut.join(" + ") || "Press keys..."
                  : currentShortcut
              }
              className="col-span-3"
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              readOnly
              onClick={() => setIsRecording(true)}
              placeholder={
                isRecording ? "Press keys..." : "Click to record shortcut"
              }
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
