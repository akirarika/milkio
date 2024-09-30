import { plugin } from "bun";
import UnpluginTypia from "@ryoppippi/unplugin-typia/bun";

plugin(
  UnpluginTypia({
    log: false,
  }),
);
