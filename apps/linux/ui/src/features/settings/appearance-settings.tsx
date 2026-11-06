import { Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { readTheme, saveTheme, type Theme } from "@/lib/theme";

import { SettingsCard } from "./settings-card";

export function AppearanceSettings() {
  const [theme, setTheme] = useState(readTheme);
  const [failed, setFailed] = useState(false);
  function choose(value: Theme) {
    try {
      saveTheme(value);
      setTheme(value);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  return (
    <SettingsCard
      title="مظهر التطبيق"
      description="يُحفظ على هذا الجهاز ويُطبّق مباشرةً. الوضع الفاتح متاح للمعاينة؛ قد تحتاج بعض الشاشات إلى تحسين الألوان لاحقًا."
    >
      <div role="group" aria-label="مظهر التطبيق" className="flex flex-wrap gap-2">
        <Button
          variant={theme === "dark" ? "secondary" : "outline"}
          aria-pressed={theme === "dark"}
          onClick={() => choose("dark")}
        >
          <Moon data-icon="inline-start" />
          داكن
        </Button>
        <Button
          variant={theme === "light" ? "secondary" : "outline"}
          aria-pressed={theme === "light"}
          onClick={() => choose("light")}
        >
          <Sun data-icon="inline-start" />
          فاتح
        </Button>
      </div>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>تعذّر حفظ المظهر على الجهاز. أعد المحاولة.</AlertDescription>
        </Alert>
      )}
    </SettingsCard>
  );
}
