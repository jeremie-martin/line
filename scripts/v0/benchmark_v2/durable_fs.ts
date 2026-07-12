import { randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export function writeFileAtomicDurable(path: string, contents: string | Buffer): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${randomUUID()}`;
  try {
    const descriptor = openSync(temporary, "wx");
    try {
      writeFileSync(descriptor, contents);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    renameSync(temporary, absolute);
    fsyncDirectory(dirname(absolute));
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function writeFileExclusiveDurable(path: string, contents: string | Buffer): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const descriptor = openSync(absolute, "wx");
  try {
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(dirname(absolute));
}

export function appendFileDurable(path: string, contents: string | Buffer): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  const descriptor = openSync(absolute, "a");
  try {
    writeFileSync(descriptor, contents);
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(dirname(absolute));
}

export function syncFile(path: string): void {
  const descriptor = openSync(resolve(path), "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  fsyncDirectory(dirname(resolve(path)));
}

export function copyFileDurable(source: string, target: string): void {
  const absolute = resolve(target);
  mkdirSync(dirname(absolute), { recursive: true });
  copyFileSync(source, absolute);
  syncFile(absolute);
}

export function removeFileDurable(path: string): void {
  const absolute = resolve(path);
  rmSync(absolute, { force: true });
  fsyncDirectory(dirname(absolute));
}

export function fsyncDirectory(path: string): void {
  let descriptor: number | null = null;
  try {
    descriptor = openSync(path, "r");
    fsyncSync(descriptor);
  } catch {
    // Some filesystems do not expose directory fsync. File data is still synced.
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
}
