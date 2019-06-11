import invariant from "invariant";
import express, { Request, Response } from "express";

export type RpcMethod = (req: Request, ...args: any[]) => any;

// Note the async thunk that returns the RpcMethod. This is to encourage users
// of this package to lazy load their dependencies to reduce the startup time
// of the server.
export type RpcMethods = {
  [method: string]: () => Promise<RpcMethod>;
};

export function createRpcHandler(
  methods: RpcMethods
): (req: Request, res: Response) => void {
  let cache = new Map<string, Promise<RpcMethod>>();

  async function handleRequest(req: Request, res: Response): Promise<void> {
    invariant(req.body.jsonrpc === "2.0", "jsonrpc version was not 2.0");
    invariant(
      methods[req.body.method].call,
      "method does not exist: %s",
      req.body.method
    );
    invariant(
      Array.isArray(req.body.params),
      "params must be an array. sorry!"
    );
    if (!cache.has(req.body.method)) {
      cache.set(req.body.method, methods[req.body.method]());
    }
    const method = (await cache.get(req.body.method)) as RpcMethod;
    const result = await Promise.resolve(method(req, ...req.body.params));
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: req.body.id,
        result
      })
    );
  }
  return (req: Request, res: Response) => {
    function sendError(e: any) {
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.body.id,
          code: -1,
          message: e.toString()
        })
      );
    }

    res.setHeader("Content-Type", "application/json");

    try {
      invariant(
        typeof req.body === "object",
        "req.body was not an object. is json parsing enabled?"
      );

      handleRequest(req, res).catch(e => sendError(e));
    } catch (e) {
      sendError(e);
    }
  };
}

export function runDefaultServer(
  methods: RpcMethods,
  port: number,
  path: string = "/rpc",
  cb?: () => void
) {
  const app = express();
  app.use(express.json());
  app.post(path, createRpcHandler(methods));
  app.listen(port, cb);
}
