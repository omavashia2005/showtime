/** Minimal binary min-heap keyed by numeric priority (sim time, ms). */
export class MinHeap<T> {
  private items: { t: number; seq: number; value: T }[] = [];
  private seqCounter = 0;

  get size(): number {
    return this.items.length;
  }

  push(t: number, value: T): void {
    const entry = { t, seq: this.seqCounter++, value };
    this.items.push(entry);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(i, parent)) {
        this.swap(i, parent);
        i = parent;
      } else break;
    }
  }

  peekTime(): number | undefined {
    return this.items[0]?.t;
  }

  pop(): T | undefined {
    const n = this.items.length;
    if (n === 0) return undefined;
    const top = this.items[0]!;
    const last = this.items.pop()!;
    if (n > 1) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = i * 2 + 2;
        let smallest = i;
        if (l < this.items.length && this.less(l, smallest)) smallest = l;
        if (r < this.items.length && this.less(r, smallest)) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top.value;
  }

  clear(): void {
    this.items = [];
  }

  private less(a: number, b: number): boolean {
    const ia = this.items[a]!;
    const ib = this.items[b]!;
    return ia.t < ib.t || (ia.t === ib.t && ia.seq < ib.seq);
  }

  private swap(a: number, b: number): void {
    const tmp = this.items[a]!;
    this.items[a] = this.items[b]!;
    this.items[b] = tmp;
  }
}
