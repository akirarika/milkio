export default function migrations(db) {
  db.version(2).stores({
    book: "++id, title, author_id",
    author: "++id, name, book_id",
  });

  db.version(1).stores({
    book: "++id, title",
    author: "++id, name, book_id",
  });
}
