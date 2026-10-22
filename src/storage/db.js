import { openDB } from 'idb';

export const dbp = openDB('sop-builder', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) db.createObjectStore('docs', { keyPath: 'id' });
    if (oldVersion < 2) db.createObjectStore('templates', { keyPath: 'id' });
  },
});
