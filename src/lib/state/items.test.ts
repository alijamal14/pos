import { describe, it, expect } from 'vitest';
import { applyOp, makeItem, itemsStore } from './items';

describe('items LWW merge', () => {
  it('should upsert and delete items', async () => {
    if (typeof indexedDB === 'undefined') {
      console.warn('Skipping test: indexedDB is not defined in this environment.');
      return;
    }
    const item = makeItem('test');
    await applyOp({ type: 'upsert', item });
    let items: any = {};
    itemsStore.subscribe(x => items = x)();
    expect(items[item.id].text).toBe('test');
    await applyOp({ type: 'delete', id: item.id });
    itemsStore.subscribe(x => items = x)();
    expect(items[item.id].deleted).toBe(true);
  });
});
