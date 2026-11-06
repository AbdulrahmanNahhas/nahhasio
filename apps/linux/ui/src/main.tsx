import { initializeSchemaRuntime } from "./lib/schema-runtime";

initializeSchemaRuntime();
void import("./lib/theme").then(({ initializeTheme }) => {
  initializeTheme();
  return import("./bootstrap");
});
