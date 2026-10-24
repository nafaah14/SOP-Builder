import { openDB } from 'idb';

export const dbp = openDB('sop-builder', 3, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) db.createObjectStore('docs', { keyPath: 'id' });
    if (oldVersion < 2) db.createObjectStore('templates', { keyPath: 'id' });
    // photos live outside the document so autosave never rewrites megabytes
    if (oldVersion < 3) db.createObjectStore('images', { keyPath: 'id' });
  },
});
