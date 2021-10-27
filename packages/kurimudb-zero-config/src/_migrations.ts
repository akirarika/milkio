import Dexie from 'dexie';

const migrations = new Dexie('Kurimudb');

migrations.version(1).stores({
  db: '_id',
  _seed: '_id',
});

export default migrations;
