export declare const groups: import("drizzle-orm/mysql-core").MySqlTableWithColumns<{
    name: "groups";
    schema: undefined;
    columns: {
        id: import("drizzle-orm/mysql-core").MySqlColumn<{
            name: "id";
            tableName: "groups";
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
            tableName: "groups";
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
export declare const groupsRelations: import("drizzle-orm").Relations<"groups", {
    usersToGroups: import("drizzle-orm").Many<"users_to_groups">;
}>;
