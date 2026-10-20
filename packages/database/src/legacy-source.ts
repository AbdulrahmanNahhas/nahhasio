import { isAbsolute, resolve } from "node:path";

/** Recovery tools require a deliberately selected source; never guess a local database. */
export function legacySourcePath() {
  const source = process.env.ARCADIA_V1_DB_PATH;
  if (!source)
    throw new Error("ARCADIA_V1_DB_PATH must identify the read-only v1 recovery database");
  return resolve(source);
}

/** Root containing the retained /media/... tree, independent of application source. */
export function legacyArtworkPath(path: string, root = process.env.ARCADIA_V1_ARTWORK_ROOT) {
  if (!root || !isAbsolute(root))
    throw new Error("ARCADIA_V1_ARTWORK_ROOT must identify an absolute recovery artwork root");
  const components = (path.startsWith("/") ? path.slice(1) : path).split("/");
  if (
    components.some(
      (part) =>
        !part || part === "." || part === ".." || part.includes("\\") || part.includes("\0"),
    )
  )
    throw new Error("Invalid recovery artwork path");
  return resolve(root, ...components);
}
