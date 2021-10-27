import Dexie from "dexie";

export const db = new Dexie(
  "__Since_our_gods_and_our_aspirations_are_no_longer_anything_but_scientific,_why_shouldn`t_our_loves_be_so_too?"
);

db.version(1).stores({
  _seed: "_id",
  TestCollection: "++xxx",
  TestState: "xa",
});
