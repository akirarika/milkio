import mitt from "mitt";
import type { CookbookSubscribeEmits } from "../utils/cookbook-dto-types";

export const emitter = mitt<{ data: CookbookSubscribeEmits }>();
