import cacheList from "./models/cacheList";
import asyncPersistenceState from "./models/asyncPersistenceState";
import asyncPersistenceList from "./models/asyncPersistenceList";

export default async function () {
  console.warn("--增删改查测试：异步持久化键值对模型--");
  console.log("增加..");
  asyncPersistenceState.data.name = "foo";
  console.log("修改..");
  asyncPersistenceState.data.name = "bar";
  console.log("查询..");
  console.log(await asyncPersistenceState.data.name);
  console.log("删除..");
  delete asyncPersistenceState.data.name;
  console.log(await asyncPersistenceState.data.name);
  console.log("query..");
  console.log(
    await asyncPersistenceState.storage.getResult(
      asyncPersistenceState.storage.query().where("_id").equals("name").first()
    )
  );
  console.warn("--增删改查测试：异步持久化集合模型--");
  console.log("增加..");
  console.log(
    await asyncPersistenceList.insert({
      name: "foo",
    }),
    await asyncPersistenceList.insert({
      name: "bar",
    })
  );
  console.log("修改..");
  asyncPersistenceList.data[1] = {
    name: "bar",
  };
  console.log("查询..");
  console.log(await asyncPersistenceList.data[1]);
  console.log("删除..");
  delete asyncPersistenceList.data[1];
  console.log(await asyncPersistenceList.data[1]);
  console.log("query..");
  console.log(
    await asyncPersistenceList.storage.getArrayResults(
      asyncPersistenceList.storage.query().toArray()
    )
  );
}
