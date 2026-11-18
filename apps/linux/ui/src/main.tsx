import { initializeSchemaRuntime } from "./lib/schema-runtime";
import { initializeTheme } from "./lib/theme";

initializeSchemaRuntime();
initializeTheme();
void import("./bootstrap");
