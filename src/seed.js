export default function seed(_dexieConnection, that) {
  if (localStorage.getItem("seeded")) return;
  else localStorage.setItem("seeded", 1);

  let promises = [];
  for (const modelName in that.models) {
    const model = that.models[modelName];
    if (!("seeding" in model)) continue;
    const promise = model.seeding(that.con[model.name]);
    promises.push(promise);
  }
  
  return Promise.all(promises);
}
