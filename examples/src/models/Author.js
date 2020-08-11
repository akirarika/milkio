export default {
  name: "author",
  migrations: {
    1: (store) => store("++id, name, book_id"),
  },
  seeding(table) {
    table.add({
      name: "test",
      book_id: 1,
    });
    table.add({
      name: "test2",
      book_id: 1,
    });
  },
};
