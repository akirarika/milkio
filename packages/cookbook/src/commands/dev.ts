import chalk from "chalk";
import { defineCookbookCommand } from "@milkio/cookbook-command";
import { initWorkers } from "../workers";
import { initWatcher } from "../watcher";
import { initServer } from "../server";
import { generator } from "../generator";
import { progress } from "../progress";
import { getCookbookToml } from "../utils/get-cookbook-toml";
import { getMode } from "../utils/get-mode";

export default await defineCookbookCommand(async (utils) => {
  progress.open("cookbook is generating..");
  const startTime = new Date();
  const options = await getCookbookToml(progress);
  (globalThis as any).__COOKBOOK_OPTIONS__ = options;

  await generator.watcher(options);
  await initWorkers(options);
  await Promise.all([initWatcher(options)]);

  void initServer(options);

  const endTime = new Date();
  const mode = getMode();
  await progress.close("Cookbook is ready.");
  console.log(asciis().join("\n"));
  console.log(
    chalk.hex("#24B56A")("△ ") +
      chalk.hex("#E6E7E9")("Time taken: ") +
      chalk.hex("#24B56A")(`${endTime.getTime() - startTime.getTime()}ms`)
  );
  console.log(
    chalk.hex("#24B56A")("△ ") +
      chalk.hex("#E6E7E9")("Operating mode: ") +
      chalk.hex("#24B56A")(mode)
  );
  console.log("");

  const resolvers = Promise.withResolvers();
  await resolvers.promise; // let the never exit
});

function asciis() {
  return [
    ` ` +
      ` ${chalk.hex("00AEF1")(`_`)}${chalk.hex("00AEE4")(`_`)} ` +
      ` ${chalk.hex("00AED6")(`_`)}${chalk.hex("00AEC9")(`_`)} ${chalk.hex(
        "00AEBB"
      )(`_`)} ${chalk.hex("00AEAE")(`_`)} ${chalk.hex("00AEA1")(`_`)} ` +
      ` ` +
      ` ` +
      ` ${chalk.hex("00AE93")(`_`)}`,
    ` ${chalk.hex("00AEF4")(`|`)} ` +
      ` ${chalk.hex("00AEE9")(`\\`)}${chalk.hex("00AEDF")(`/`)} ` +
      ` ${chalk.hex("00AED4")(`(`)}${chalk.hex("00AEC9")(`_`)}${chalk.hex(
        "00AEBF"
      )(`)`)} ${chalk.hex("00AEB4")(`|`)} ${chalk.hex("00AEAA")(
        `|`
      )} ${chalk.hex("00AE9F")(`_`)}${chalk.hex("00AE94")(`(`)}${chalk.hex(
        "00AE8A"
      )(`_`)}${chalk.hex("00AE7F")(`)`)} ${chalk.hex("00AE74")(`_`)}${chalk.hex(
        "00AE6A"
      )(`_`)}${chalk.hex("00AE5F")(`_`)}`,
    ` ${chalk.hex("00AEF4")(`|`)} ${chalk.hex("00AEEA")(`|`)}${chalk.hex(
      "00AEE0"
    )(`\\`)}${chalk.hex("00AED6")(`/`)}${chalk.hex("00AECC")(`|`)} ${chalk.hex(
      "00AEC1"
    )(`|`)} ${chalk.hex("00AEB7")(`|`)} ${chalk.hex("00AEAD")(`|`)} ${chalk.hex(
      "00AEA3"
    )(`|`)}${chalk.hex("00AE99")(`/`)} ${chalk.hex("00AE8E")(`/`)} ${chalk.hex(
      "00AE84"
    )(`|`)}${chalk.hex("00AE7A")(`/`)} ${chalk.hex("00AE70")(`_`)} ${chalk.hex(
      "00AE66"
    )(`\\`)}`,
    ` ${chalk.hex("00AEF5")(`|`)} ${chalk.hex("00AEEB")(`|`)} ` +
      ` ${chalk.hex("00AEE1")(`|`)} ${chalk.hex("00AED7")(`|`)} ${chalk.hex(
        "00AECD"
      )(`|`)} ${chalk.hex("00AEC4")(`|`)} ` +
      ` ` +
      ` ${chalk.hex("00AEBA")(`<`)}${chalk.hex("00AEB0")(`|`)} ${chalk.hex(
        "00AEA6"
      )(`|`)} ${chalk.hex("00AE9C")(`(`)}${chalk.hex("00AE93")(`_`)}${chalk.hex(
        "00AE89"
      )(`)`)}${chalk.hex("00AE1E")(`丨`)}`,
    ` ${chalk.hex("00AEF4")(`|`)}${chalk.hex("00AEEA")(`_`)}${chalk.hex(
      "00AEE0"
    )(`|`)} ` +
      ` ${chalk.hex("00AED6")(`|`)}${chalk.hex("00AECC")(`_`)}${chalk.hex(
        "00AEC1"
      )(`|`)}${chalk.hex("00AEB7")(`_`)}${chalk.hex("00AEAD")(`|`)}${chalk.hex(
        "00AEA3"
      )(`_`)}${chalk.hex("00AE99")(`|`)}${chalk.hex("00AE8E")(`_`)}${chalk.hex(
        "00AE84"
      )(`|`)}${chalk.hex("00AE7A")(`\\`)}${chalk.hex("00AE70")(`_`)}${chalk.hex(
        "00AE66"
      )(`\\`)}${chalk.hex("00AE5B")(`_`)}${chalk.hex("00AEA6")(`|`)}${chalk.hex(
        "00AE47"
      )(`\\`)}${chalk.hex("00AE3D")(`_`)}${chalk.hex("00AE33")(`_`)}${chalk.hex(
        "00AE28"
      )(`_`)}${chalk.hex("00AE1E")(`/`)}`,
  ];
}
