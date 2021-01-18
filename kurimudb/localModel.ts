import connection from "./Connection";
import model from "./Model";

export default new (class Local extends model {
  constructor() {
    super(
      new connection("kurimudb", (conn) =>
        conn.version(1).stores({
          Local: "key",
        })
      ),
      ["key", "string"]
    );
  }
})();
