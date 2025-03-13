import { defineCookbookCommand } from "@milkio/cookbook-command";

export default  await defineCookbookCommand(async (utils) => {
    const bool = await utils.inputBoolean({
        env: "bool",
        message: "bool",
        placeholder: "bool",
    })
    utils.log(bool)
})