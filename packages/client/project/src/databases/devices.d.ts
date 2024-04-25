export declare const devices: import("drizzle-orm/mysql-core").MySqlTableWithColumns<{
    name: "devices";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/mysql-core").MySqlColumn<{
            name: "id";
            tableName: "devices";
            dataType: "number";
            columnType: "MySqlBigInt53";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: true;
            enumValues: undefined;
            baseColumn: never;
        }, object>;
        name: import("drizzle-orm/mysql-core").MySqlColumn<{
            name: "name";
            tableName: "devices";
            dataType: "string";
            columnType: "MySqlVarChar";
            data: string;
            driverParam: string | number;
            notNull: false;
            hasDefault: false;
            enumValues: [string, ...string[]];
            baseColumn: never;
        }, object>;
    };
    dialect: "mysql";
}>;
