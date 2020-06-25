import invariant from "invariant";
import express, { Request, Response } from "express";
import { Server } from "http";

export { Request };

export type RpcMethod = (req: Request, ...args: any[]) => any;

export type RpcMethods = {
  [method: string]: RpcMethod;
};

export function createRpcHandler(
  methods: RpcMethods
): (req: Request, res: Response) => void {
  async function handleRequest(req: Request, res: Response): Promise<void> {
    invariant(!Array.isArray(req.body), "batch is not supported. sorry!");
    invariant(req.body.jsonrpc === "2.0", "jsonrpc version was not 2.0");
    invariant(
      !req.body.method.startsWith("_"),
      "cannot call methods prefixed with _: %s",
      req.body.method
    );
    invariant(
      methods[req.body.method].call,
      "method does not exist: %s",
      req.body.method
    );
    invariant(
      Array.isArray(req.body.params),
      "params must be an array. sorry!"
    );
    const method = methods[req.body.method];
    const result = await Promise.resolve(method(req, ...req.body.params));
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        id: req.body.id,
        result,
      })
    );
  }
  return (req: Request, res: Response) => {
    function sendError(e: any) {
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: req.body.id,
          code: -32001,
          message: e.toString(),
        })
      );
    }

    res.setHeader("Content-Type", "application/json");

    try {
      invariant(
        typeof req.body === "object",
        "req.body was not an object. is json parsing enabled?"
      );

      handleRequest(req, res).catch((e) => sendError(e));
    } catch (e) {
      sendError(e);
    }
  };
}

export function runDefaultServer(
  methods: RpcMethods,
  port: number,
  path: string = "/rpc"
): Promise<Server> {
  const app = express();
  app.use(express.json());
  app.post(path, createRpcHandler(methods));
  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}
