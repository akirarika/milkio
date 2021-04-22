import { local, cookie, memory } from "../zero-config/dist";
import asyncPersistenceCurdTest from "./asyncPersistenceCurdTest";
import curdTest from "./curdTest";
import persistenceCurdTest from "./persistenceCurdTest";

export default function () {
  memory.data.hello = void 0;
  memory.data.hello$((val) => {
    console.log(val);
  });
  memory.data.hello = "233";
  // curdTest();
  // persistenceCurdTest();
  // asyncPersistenceCurdTest();
}
