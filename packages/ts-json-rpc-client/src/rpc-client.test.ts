import { Request, runDefaultServer } from "ts-json-rpc-server";
import createRpcClient from "./rpc-client";
import fetch from "node-fetch";
import test from "tape-async";

const methods = {
  hello(_: Request, name: string) {
    return "hello, " + name + "!";
  },
  async goodbye() {
    return "goodbye";
  },
};

// return via an async function to test that the proxy is not misidentified as a promise
async function getClient() {
  return createRpcClient<typeof methods>(
    "http://localhost:2288/rpc",
    (fetch as unknown) as typeof window.fetch
  );
}

test("integration", async (t) => {
  const server = await runDefaultServer(methods, 2288);
  const client = await getClient();

  const rv = await client.hello("pete");
  t.equal(rv, "hello, pete!");
  t.equal(await client.goodbye(), "goodbye");

  server.close();
});
