export declare const users: import("drizzle-orm/mysql-core").MySqlTableWithColumns<{
    name: "users";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/mysql-core").MySqlColumn<{
            name: "id";
            tableName: "users";
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
            tableName: "users";
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
export declare const usersRelations: import("drizzle-orm").Relations<"users", {
    usersToGroups: import("drizzle-orm").Many<"users_to_groups">;
}>;
