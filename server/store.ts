// Saves event settings and metrics to small JSON files so they survive a
// restart. Participants are never written to disk: presence is live-only.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import type { EventInfo } from '../shared/protocol.ts';
import { emptyMetrics, type Metrics } from './room.ts';

export interface StoredEvent {
  event: EventInfo;
  createdAt: number;
  organizerKeyHash: string;
  metrics: Metrics;
}

export const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

export class Store {
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true });
  }

  loadAll(): StoredEvent[] {
    const out: StoredEvent[] = [];
    for (const f of readdirSync(this.dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(readFileSync(join(this.dir, f), 'utf8')) as StoredEvent;
        data.metrics = { ...emptyMetrics(), ...data.metrics };
        out.push(data);
      } catch (e) {
        console.warn(`[store] could not read ${f}:`, (e as Error).message);
      }
    }
    return out;
  }

  save(data: StoredEvent) {
    const file = join(this.dir, `${data.event.id}.json`);
    const tmp = file + '.tmp';
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, file);
  }
}
