// Examples from: https://www.jsonrpc.org/specification#examples

import {
  assertEquals,
  assertNotEquals,
  assertThrowsAsync,
} from "./test_deps.ts";

import { respond } from "../server/response.ts";

import { CustomError } from "../server/custom_error.ts";

import type { ServerRequest } from "./test_deps.ts";

function createReq(str: string) {
  return {
    respond: () => {},
    body: new Deno.Buffer(new TextEncoder().encode(str).buffer),
    headers: new Headers([["Some", "Header"]]),
  } as any;
}

function removeWhiteSpace(str: string) {
  return JSON.stringify(JSON.parse(str));
}

const methods = {
  subtract: (input: any) =>
    Array.isArray(input)
      ? input[0] - input[1]
      : input.minuend - input.subtrahend,
  sum: (arr: number[]) => arr.reduce((acc, el) => acc + el),
  queryDatabase: ({ name, s }: { name: string; s: string }) => `${s} ${name}`,
  notify_hello: () => "hello",
  get_data: () => ["hello", 5],
  throwError: () => {
    throw new Error("my error");
  },
  throwCustomError: () => {
    throw new CustomError(-32000, "my custom error", {
      "details": "error details",
    });
  },
};

Deno.test("rpc call with positional parameters", async function (): Promise<
  void
> {
  const sentToServer =
    '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}';
  const sentToClient = '{"jsonrpc": "2.0", "result": 19, "id": 1}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call with named parameters", async function (): Promise<void> {
  const sentToServer =
    '{"jsonrpc": "2.0", "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3}';
  const sentToClient = '{"jsonrpc": "2.0", "result": 19, "id": 3}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call as a notification", async function (): Promise<void> {
  let sentToServer =
    '{"jsonrpc": "2.0", "method": "update", "params": [1,2,3,4,5]}';

  assertEquals(await respond(methods, createReq(sentToServer)), undefined);

  sentToServer = '{"jsonrpc": "2.0", "method": "foobar"}';
  assertEquals(await respond(methods, createReq(sentToServer)), undefined);
});

Deno.test("rpc call of non-existent method", async function (): Promise<void> {
  const sentToServer = '{"jsonrpc": "2.0", "method": "foobar", "id": "1"}';
  const sentToClient =
    '{"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "1"}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call with invalid JSON", async function (): Promise<void> {
  const sentToServer =
    '{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]';
  const sentToClient =
    '{"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": null}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call with invalid Request object", async function (): Promise<
  void
> {
  const sentToServer = '{"jsonrpc": "2.0", "method": 1, "params": "bar"}';
  const sentToClient =
    '{"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call Batch, invalid JSON", async function (): Promise<void> {
  const sentToServer =
    '[ {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"}, {"jsonrpc": "2.0", "method" ]';
  const sentToClient =
    '{"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": null}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call with an empty Array", async function (): Promise<void> {
  const sentToServer = "[]";
  const sentToClient =
    '{"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test(
  "rpc call with an invalid Batch (but not empty)",
  async function (): Promise<void> {
    const sentToServer = "[1]";
    const sentToClient =
      '[ {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null} ]';

    assertEquals(
      await respond(methods, createReq(sentToServer)),
      removeWhiteSpace(sentToClient),
    );
  },
);

Deno.test("rpc call with invalid Batch", async function (): Promise<void> {
  const sentToServer = "[1,2,3]";
  const sentToClient =
    '[ {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}, {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}, {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null} ]';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call Batch", async function (): Promise<void> {
  const sentToServer =
    '[ {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"}, {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}, {"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"}, {"foo": "boo"}, {"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"}, {"jsonrpc": "2.0", "method": "get_data", "id": "9"} ]';
  const sentToClient =
    '[ {"jsonrpc": "2.0", "result": 7, "id": "1"}, {"jsonrpc": "2.0", "result": 19, "id": "2"}, {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}, {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "5"}, {"jsonrpc": "2.0", "result": ["hello", 5], "id": "9"} ]';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});

Deno.test("rpc call Batch (all notifications)", async function (): Promise<
  void
> {
  const sentToServer =
    '[ {"jsonrpc": "2.0", "method": "notify_sum", "params": [1,2,4]}, {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]} ]';

  assertEquals(await respond(methods, createReq(sentToServer)), undefined);
});

Deno.test(
  "rpc call with additional argument from server",
  async function (): Promise<void> {
    const sentToServer =
      '{"jsonrpc": "2.0", "method": "queryDatabase", "params": {"name":"Joe"}, "id": "a"}';
    const sentToClient =
      '{"jsonrpc": "2.0", "result": "DB query result: Joe", "id": "a"}';

    assertEquals(
      await respond(methods, createReq(sentToServer), {
        additionalArguments: [{
          arg: { s: "DB query result:" },
          allMethods: true,
        }],
      }),
      removeWhiteSpace(sentToClient),
    );
    assertEquals(
      await respond(methods, createReq(sentToServer), {
        additionalArguments: [{
          arg: { s: "DB query result:" },
          methods: ["queryDatabase"],
        }],
      }),
      removeWhiteSpace(sentToClient),
    );
    assertEquals(
      await respond(methods, createReq(sentToServer), {
        additionalArguments: [{
          arg: { s: "DB query result:" },
        }],
      }),
      removeWhiteSpace(
        '{"jsonrpc": "2.0", "result": "undefined Joe", "id": "a"}',
      ),
    );
  },
);

Deno.test("set publicErrorStack to true", async function (): Promise<void> {
  const sentToServer = '{"jsonrpc": "2.0", "method": "throwError", "id": 3}';
  const sentToClient = '{"jsonrpc": "2.0", "result": 19, "id": 3}';

  assertEquals(
    typeof JSON.parse(
      (await respond(methods, createReq(sentToServer))) as string,
    ).error.data,
    "undefined",
  );
  assertEquals(
    typeof JSON.parse(
      (await respond(methods, createReq(sentToServer), {
        publicErrorStack: true,
      })) as string,
    ).error.data,
    "string",
  );
});

Deno.test("rpc call with a custom error", async function (): Promise<
  void
> {
  const sentToServer =
    '{"jsonrpc": "2.0", "method": "throwCustomError", "params": [], "id": 1}';
  const sentToClient =
    '{"jsonrpc":"2.0","error":{"code":-32000,"message":"my custom error","data":{"details":"error details"}},"id":1}';

  assertEquals(
    await respond(methods, createReq(sentToServer)),
    removeWhiteSpace(sentToClient),
  );
});
