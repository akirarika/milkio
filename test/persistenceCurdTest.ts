import cacheList from "./models/cacheList";
import persistenceState from "./models/persistenceState";
import persistenceList from "./models/persistenceList";

export default function () {
  console.warn("--增删改查测试：持久化键值对模型--");
  console.log("增加..");
  persistenceState.data.name = "foo";
  console.log("修改..");
  persistenceState.data.name = "bar";
  console.log("查询..");
  console.log(persistenceState.data.name);
  console.log("删除..");
  delete persistenceState.data.name;
  console.log(persistenceState.data.name);
  console.warn("--增删改查测试：持久化集合模型--");
  console.log("增加..");
  console.log(
    persistenceList.insert({
      name: "foo",
    }),
    persistenceList.insert({
      name: "bar",
    })
  );
  console.log("修改..");
  persistenceList.data[1] = {
    name: "bar",
  };
  console.log("查询..");
  console.log(persistenceList.data[1]);
  console.log("删除..");
  delete persistenceList.data[1];
  console.log(persistenceList.data[1]);
}
