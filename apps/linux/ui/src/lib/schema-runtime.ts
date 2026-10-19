import { z } from "zod";

// Load application contracts only after their shared validator runtime forbids code generation.
export function initializeSchemaRuntime() {
  z.config({ jitless: true });
}
export { z };
