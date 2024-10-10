import type { Log, MilkioInit, MilkioRuntimeInit } from "..";
import { TSON } from "@southern-aurora/tson";

type CookbookEvent = {
  type: "milkio@logger";
  log: Log;
};

export const sendCookbookEvent = async (runtime: MilkioRuntimeInit<MilkioInit>, event: CookbookEvent) => {
  try {
    const response = await fetch(`http://localhost:${runtime.port.develop}/$action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: TSON.stringify(event),
    });
    if (!response.ok) {
      console.log("[COOKBOOK]", await response.text());
      console.log("[COOKBOOK]", "Is Cookbook closed? There is an abnormality in the communication with Cookbook.");
    }
  } catch (error) {
    console.log("[COOKBOOK]", error);
    console.log("[COOKBOOK]", "Is Cookbook closed? There is an abnormality in the communication with Cookbook.");
  }
};
