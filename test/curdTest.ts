import cacheList from "./models/cacheList";
import cacheState from "./models/cacheState";

export default function () {
  console.warn("--增删改查测试：键值对模型--");
  console.log("增加..");
  cacheState.data.name = "foo";
  console.log("修改..");
  cacheState.data.name = "bar";
  console.log("查询..");
  console.log(cacheState.data.name);
  console.log("删除..");
  delete cacheState.data.name;
  console.log(cacheState.data.name);
  console.warn("--增删改查测试：集合模型--");
  console.log("增加..");
  console.log(
    cacheList.insert({
      name: "foo",
    }),
    cacheList.insert({
      name: "bar",
    })
  );
  console.log("修改..");
  cacheList.data[1] = {
    name: "bar",
  };
  console.log("查询..");
  console.log(cacheList.data[1]);
  console.log("删除..");
  delete cacheList.data[1];
  console.log(cacheList.data[1]);
}
