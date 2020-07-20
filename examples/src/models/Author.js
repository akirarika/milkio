export default {
  name: "author",
  migrations: {
    1: "++id, name",
  },
  seeding(table) {
    table.add({
      name: "test",
    });
  },
};
