import invariant from "invariant";
import { RpcMethods } from "ts-json-rpc-server";
import { Request } from "express";

export type RpcClient<T extends RpcMethods> = {
  [K in keyof T]: T[K] extends () => Promise<
    (req: Request, ...args: infer A) => infer R
  >
    ? (R extends Promise<infer I>
        ? (...args: A) => R
        : (...args: A) => Promise<R>)
    : never
};

// TODO: support batch requests in both the client and the server
export type Fetch = typeof window.fetch;

export default function createRpcClient<T extends RpcMethods>(
  jsonRpcUrl: string,
  fetch: Fetch = window.fetch
): RpcClient<T> {
  let idSeed = 1;
  return new Proxy(
    {},
    {
      get(_, method: string) {
        return async (...params: any[]) => {
          const id = (idSeed++).toString();
          const response = await fetch(jsonRpcUrl, {
            method: "post",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method,
              params,
              id
            })
          });
          const responseJson = await response.json();
          invariant(responseJson.jsonrpc === "2.0", "invalid jsonrpc version");
          invariant(responseJson.id === id, "invalid response id");
          if (responseJson.error) {
            throw new Error(responseJson.message);
          }
          return responseJson.result;
        };
      }
    }
  ) as RpcClient<T>;
}
