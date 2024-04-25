export declare const usersToGroups: import("drizzle-orm/mysql-core").MySqlTableWithColumns<{
    name: "users_to_groups";
    schema: undefined;
    columns: {
        userId: import("drizzle-orm/mysql-core").MySqlColumn<{
            name: "user_id";
            tableName: "users_to_groups";
            dataType: "number";
            columnType: "MySqlBigInt53";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, object>;
        groupId: import("drizzle-orm/mysql-core").MySqlColumn<{
            name: "group_id";
            tableName: "users_to_groups";
            dataType: "number";
            columnType: "MySqlBigInt53";
            data: number;
            driverParam: string | number;
            notNull: true;
            hasDefault: false;
            enumValues: undefined;
            baseColumn: never;
        }, object>;
    };
    dialect: "mysql";
}>;
export declare const usersToGroupsRelations: import("drizzle-orm").Relations<"users_to_groups", {
    group: import("drizzle-orm").One<"groups", true>;
    user: import("drizzle-orm").One<"users", true>;
}>;
