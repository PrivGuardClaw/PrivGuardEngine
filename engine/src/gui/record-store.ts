import type { InterceptRecord, RecordQuery, RecordQueryResult } from './types.js';

const MAX_RECORDS = 1000;

export class RecordStore {
  private records: InterceptRecord[] = [];
  private subscribers: Array<(record: InterceptRecord) => void> = [];

  add(record: InterceptRecord): void {
    this.records.unshift(record);
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(0, MAX_RECORDS);
    }
    for (const cb of this.subscribers) {
      cb(record);
    }
  }

  get(id: string): InterceptRecord | undefined {
    return this.records.find(r => r.id === id);
  }

  query(options: RecordQuery = {}): RecordQueryResult {
    const { page = 1, pageSize = 50, type, startTime, endTime } = options;

    let filtered = this.records;

    if (type) {
      filtered = filtered.filter(r => r.piiTypes.includes(type));
    }
    if (startTime !== undefined) {
      filtered = filtered.filter(r => r.timestamp >= startTime);
    }
    if (endTime !== undefined) {
      filtered = filtered.filter(r => r.timestamp <= endTime);
    }

    // Already stored in descending order (newest first via unshift)
    const total = filtered.length;
    const clampedPageSize = Math.min(pageSize, 100);
    const start = (page - 1) * clampedPageSize;
    const records = filtered.slice(start, start + clampedPageSize);

    return { records, total };
  }

  subscribe(callback: (record: InterceptRecord) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  cleanup(): void {
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(0, MAX_RECORDS);
    }
  }

  size(): number {
    return this.records.length;
  }
}
