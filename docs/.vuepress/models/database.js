import { connection } from '../../../dist';

export default new connection("default", (conn) => {
    conn.version(1).stores({
        Note: "++id",
    })
    conn.version(2).stores({
        Note: "++id, title",
        Config: "key"
    })
});