import configState from "./models/configState";
import { auto$ } from "../kurimudb";

export default function () {
  console.log(configState.data.xxxxx);
  configState.data.xxxxx$((a) => {
    console.log(a);
  });

  //   auto$(async () => {
  //     const baz = await configState.data.baz;
  //     console.log(baz);
  //   });
  //   setTimeout(() => {
  //     configState.data.baz = "nihao";
  //   }, 1000);
  //   auto$(() => {
  // ..
  //     const foo = configState.data.foo;
  //     const bar = configState.data.bar;
  //     console.log(foo, bar);
  //   });
  //   auto$(() => {
  //     const baz = configState.data.baz;
  //     console.log(baz);
  //   });
  //   setTimeout(() => {
  //     configState.data.baz = "nihao";
  //   }, 1000);
}
