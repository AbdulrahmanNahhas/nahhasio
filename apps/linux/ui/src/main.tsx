import { initializeSchemaRuntime } from "./lib/schema-runtime";
import { initializeAppearance } from "./lib/theme";

initializeSchemaRuntime();
initializeAppearance();
void import("./bootstrap");
