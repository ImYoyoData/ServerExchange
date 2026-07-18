import * as fs from 'fs';
import * as path from 'path';

const rootDir = process.cwd();

const copyDirs: { source: string; target: string }[] = [
  { source: 'public', target: 'dist/public' },
  { source: 'package.json', target: 'dist/package.json' },
  { source: '.env', target: 'dist/.env' },
  { source: 'config.production.json5', target: 'dist/config.production.json5' },
];

function copyDirectory(source: string, target: string): void {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);

  files.forEach((file) => {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);

    const stat = fs.statSync(sourcePath);

    if (stat.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

function copySingleFile(source: string, target: string): void {
  const targetDir = path.dirname(target);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.copyFileSync(source, target);
}

function copySinglePath(source: string, target: string): void {
  const sourcePath = path.join(rootDir, source);
  const targetPath = path.join(rootDir, target);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    copyDirectory(sourcePath, targetPath);
  } else {
    copySingleFile(sourcePath, targetPath);
  }
}

try {
  for (const { source, target } of copyDirs) {
    copySinglePath(source, target);
  }
} catch (error) {
  console.error('复制失败:', error);
  process.exit(1);
}
