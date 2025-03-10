import { __router__ } from "./commands/__router__";


export async function execute() {
  await __router__(process.argv[2])
}
