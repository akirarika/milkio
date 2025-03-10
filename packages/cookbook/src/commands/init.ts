import consola from "consola";

export async function initCommand() {
    await consola.prompt("This directory is not a Cookbook Monorepo project, do you want to initialize it?", {
        type: "confirm",
    });
    consola.success("I haven't written this function yet UwU")
}