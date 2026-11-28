import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Separator } from "@/components/ui-sdk/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { readTheme, readUiSize, saveTheme, saveUiSize } from "@/lib/theme";

const themes = [
  { value: "dark", label: "داكن", icon: Moon },
  { value: "light", label: "فاتح", icon: Sun },
  { value: "system", label: "حسب النظام", icon: Monitor },
] as const;

export function AppearanceSettings() {
  const [theme, setTheme] = useState(readTheme);
  const [size, setSize] = useState(readUiSize);
  const [failed, setFailed] = useState(false);

  function applyChange(save: () => void) {
    try {
      save();
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Card size="sm" className="py-0">
        <CardContent>
          <Item className="px-0">
            <ItemContent>
              <ItemTitle id="appearance-theme">ألوان الواجهة</ItemTitle>
              <ItemDescription>اختر بين المظهر الداكن والفاتح.</ItemDescription>
            </ItemContent>
            <ItemActions className="max-w-full">
              <ToggleGroup
                aria-labelledby="appearance-theme"
                value={[theme]}
                onValueChange={([value]) => {
                  const choice = themes.find((option) => option.value === value);
                  if (!choice) return;
                  applyChange(() => {
                    saveTheme(choice.value);
                    setTheme(choice.value);
                  });
                }}
                variant="outline"
                size="sm"
                className="flex-wrap"
              >
                {themes.map(({ value, label, icon: Icon }) => (
                  <ToggleGroupItem key={value} value={value}>
                    <Icon data-icon="inline-start" aria-hidden="true" />
                    {label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </ItemActions>
          </Item>
          <Separator />
          <Item className="px-0">
            <ItemContent>
              <ItemTitle id="appearance-size">حجم الواجهة</ItemTitle>
              <ItemDescription>كبّر النصوص وعناصر التحكم.</ItemDescription>
            </ItemContent>
            <ItemActions>
              <ToggleGroup
                aria-labelledby="appearance-size"
                value={[size]}
                onValueChange={([value]) => {
                  if (value !== "standard" && value !== "large") return;
                  applyChange(() => {
                    saveUiSize(value);
                    setSize(value);
                  });
                }}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="standard">افتراضي</ToggleGroupItem>
                <ToggleGroupItem value="large">كبير</ToggleGroupItem>
              </ToggleGroup>
            </ItemActions>
          </Item>
        </CardContent>
      </Card>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>تعذّر حفظ المظهر على الجهاز. أعد المحاولة.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
