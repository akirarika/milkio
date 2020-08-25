export default async function seed(dexieConnection, that) {
  if (localStorage.getItem("seeded")) return;
  else localStorage.setItem("seeded", 1);

  for (const modelName in that.models) {
    const model = that.models[modelName];
    if (!("seeding" in model)) continue;
    await model.seeding(that.con[model.name]);
  }
}
