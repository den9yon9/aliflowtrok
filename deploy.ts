import { join, resolve } from "jsr:@std/path@1.0.8";

function isEntityExistSync(filePath: string): boolean {
  try {
    Deno.statSync(filePath);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw error;
    }
  }
}

function findPackages(
  dirPath: string,
  packages: string[] = [],
): string[] {
  for (const entity of Deno.readDirSync(dirPath)) {
    if (entity.name === "node_modules") continue;
    if (entity.isDirectory) {
      const absolutePath = join(dirPath, entity.name);
      findPackages(absolutePath, packages);
    } else if (["deno.json", "package.json"].includes(entity.name)) {
      packages.push(dirPath);
    }
  }
  return packages;
}

const rootDir = Deno.cwd();
const distRootDir = resolve(rootDir, "dist");

findPackages(rootDir).forEach((item) => {
  const distDir = resolve(item, "dist");
  if (!isEntityExistSync(distDir)) return;
  const targetDir = item.replace(rootDir, distRootDir);
  Deno.mkdirSync(targetDir, { recursive: true });
  Deno.renameSync(resolve(item, "dist"), targetDir);
});
