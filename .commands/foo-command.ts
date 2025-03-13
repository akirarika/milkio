export default async function (options: any) {
    console.log("foo command", options);
    const result = await options.inputBoolean({
        env: "foo",
        message: "foo"
    });
    console.log(result);

}