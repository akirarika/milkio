export default async function seed(that) {
  if (localStorage.getItem("seeded")) return;
  else localStorage.setItem("seeded", 1);

  for (const modelName in that.models) {
    const model = that.models[modelName];

    try {
      await model.seeding(that.con[model.name]);
    } catch (error) {
      console.log(error);
    }
  }
}
