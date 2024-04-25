declare const drizzleConfig: {
    schema: string;
    out: string;
    driver: "mysql2";
    dbCredentials: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
};
export default drizzleConfig;
