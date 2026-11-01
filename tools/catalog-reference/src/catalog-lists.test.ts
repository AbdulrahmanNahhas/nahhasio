import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { scoreWeights } from "@arcadia/domain";
import { expect, it } from "vitest";
import { z } from "zod";

it("private catalog snapshots use canonical editorial weights and private file permissions", () => {
  const script = fileURLToPath(new URL("../../../bin/refresh-catalog-lists", import.meta.url));
  const output = execFileSync(
    "python3",
    [
      "-c",
      `
import json,runpy,sys,tempfile,stat
from pathlib import Path
module=runpy.run_path(sys.argv[1])
score={key:0 for key in module['WEIGHTS']}
score.update(story=10,depth=10)
with tempfile.TemporaryDirectory() as directory:
    output=Path(directory)/'lists'
    module['write_files'](output,{'fixture.md':'synthetic private snapshot'})
    directory_mode=stat.S_IMODE(output.stat().st_mode)
    file_mode=stat.S_IMODE((output/'fixture.md').stat().st_mode)
print(json.dumps({'weights':{key:float(value) for key,value in module['WEIGHTS'].items()},'rating':module['rating']({'installments':[{'score':score}]}),'incomplete':module['rating']({'installments':[{'score':{'story':10}}]}),'directoryMode':directory_mode,'fileMode':file_mode}))
`,
      script,
    ],
    { encoding: "utf8" },
  );
  const result = z
    .object({
      weights: z.record(z.string(), z.number()),
      rating: z.string(),
      incomplete: z.string(),
      directoryMode: z.number(),
      fileMode: z.number(),
    })
    .parse(JSON.parse(output));
  expect(result.weights).toEqual(scoreWeights);
  expect(result.rating).toBe("4.5");
  expect(result.incomplete).toBe("—");
  expect(result.directoryMode).toBe(0o700);
  expect(result.fileMode).toBe(0o600);
});
