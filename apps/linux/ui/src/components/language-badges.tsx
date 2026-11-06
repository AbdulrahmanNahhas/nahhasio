import { Badge } from "@/components/ui/badge";
import { languageName } from "@/lib/languages";

export function LanguageBadges({ languages }: { languages: readonly string[] }) {
  if (!languages.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="لغات العمل">
      {[...new Set(languages)].map((code) => (
        <Badge key={code} variant="secondary">
          {languageName(code)}
        </Badge>
      ))}
    </div>
  );
}
