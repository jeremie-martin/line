import { availableParallelism, cpus, freemem, loadavg, totalmem } from "node:os";

type CpuSnapshot = { idleMs: number; totalMs: number };

export type ResourceMonitor = {
  stop: () => void;
};

export function startResourceMonitor(label: string, intervalSeconds = 5): ResourceMonitor {
  const startedAt = performance.now();
  let lastAt = startedAt;
  let lastProcess = process.cpuUsage();
  let lastHost = hostCpuSnapshot();
  let peakProcessCores = 0;
  let peakHostBusyPercent = 0;
  let peakRss = 0;
  let peakHeap = 0;
  let peakSystemUsed = 0;
  let stopped = false;

  const sample = (): void => {
    const now = performance.now();
    const currentProcess = process.cpuUsage();
    const currentHost = hostCpuSnapshot();
    const wallMicros = Math.max(1, (now - lastAt) * 1000);
    const processMicros =
      currentProcess.user - lastProcess.user + currentProcess.system - lastProcess.system;
    const processCores = processMicros / wallMicros;
    const hostTotal = currentHost.totalMs - lastHost.totalMs;
    const hostIdle = currentHost.idleMs - lastHost.idleMs;
    const hostBusyPercent = hostTotal <= 0 ? 0 : 100 * (1 - hostIdle / hostTotal);
    const memory = process.memoryUsage();
    const systemUsed = totalmem() - freemem();

    peakProcessCores = Math.max(peakProcessCores, processCores);
    peakHostBusyPercent = Math.max(peakHostBusyPercent, hostBusyPercent);
    peakRss = Math.max(peakRss, memory.rss);
    peakHeap = Math.max(peakHeap, memory.heapUsed);
    peakSystemUsed = Math.max(peakSystemUsed, systemUsed);
    lastAt = now;
    lastProcess = currentProcess;
    lastHost = currentHost;

    console.log(
      `  [resources:${label}] process ${processCores.toFixed(1)} cores; ` +
      `host ${hostBusyPercent.toFixed(0)}%; RSS ${gib(memory.rss)} GiB; ` +
      `heap ${gib(memory.heapUsed)} GiB; system ${gib(systemUsed)}/${gib(totalmem())} GiB; ` +
      `load1 ${loadavg()[0].toFixed(1)}`,
    );
  };

  const interval = setInterval(sample, Math.max(1, intervalSeconds) * 1000);
  return {
    stop: (): void => {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      sample();
      console.log(
        `  [resources:${label}:peak] elapsed ${formatDuration((performance.now() - startedAt) / 1000)}; ` +
        `process ${peakProcessCores.toFixed(1)}/${availableParallelism()} cores; ` +
        `host ${peakHostBusyPercent.toFixed(0)}%; RSS ${gib(peakRss)} GiB; ` +
        `heap ${gib(peakHeap)} GiB; system ${gib(peakSystemUsed)}/${gib(totalmem())} GiB`,
      );
    },
  };
}

function hostCpuSnapshot(): CpuSnapshot {
  let idleMs = 0;
  let totalMs = 0;
  for (const cpu of cpus()) {
    idleMs += cpu.times.idle;
    totalMs += Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
  }
  return { idleMs, totalMs };
}

function gib(bytes: number): string {
  return (bytes / 2 ** 30).toFixed(2);
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s`;
}
