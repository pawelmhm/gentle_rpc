import { cleanBatch, createResponseObject } from "./creation.ts";
import { validateRequest, validateRpcRequestObject } from "./validation.ts";
import { isWebSocketCloseEvent } from "./deps.ts";

import type { CreationInput } from "./creation.ts";
import type { WebSocket } from "./deps.ts";
import type { MethodsAndIdsStore } from "./ws_internal_methods.ts";

type Input = Omit<CreationInput, "validationObject"> & { socket: WebSocket };
type Emission = {
  method: string;
  params: unknown;
};

function partialEmitListener(
  { socket, methods, options }: Input,
) {
  return async function emitListener(event: CustomEvent) {
    const { method, params } = event.detail as Emission;
    const methodsAndIdsStore = options
      .additionalArguments.find((item) => item.args.methodsAndIdsStore)?.args
      .methodsAndIdsStore as MethodsAndIdsStore;
    if (methodsAndIdsStore?.has(method)) {
      const ids = [...methodsAndIdsStore.get(method)!.values()];
      return ids.map(async (id) => {
        const response = await createResponseObject({
          validationObject: validateRpcRequestObject(
            { method, params, id, jsonrpc: "2.0" },
            methods,
          ),
          methods,
          options,
        });
        if (response) {
          try {
            return await socket.send(JSON.stringify(response));
          } catch {
            removeEventListener("emit", emitListener as EventListener);
          }
        }
      });
    }
  };
}

export async function handleWs(
  { socket, methods, options }: Input,
) {
  // console.log("socket connected!");

  let emitListenerOrNull = null;
  if (options.enableInternalMethods) {
    emitListenerOrNull = partialEmitListener({
      socket,
      methods,
      options,
    });
    addEventListener("emit", emitListenerOrNull as EventListener);
  }

  try {
    for await (const ev of socket) {
      if (typeof ev === "string") {
        // console.log("ws:Text", ev);
        const validationObjectOrBatch = validateRequest(ev, methods);
        const responseObjectOrBatchOrNull =
          Array.isArray(validationObjectOrBatch)
            ? await cleanBatch(
              validationObjectOrBatch.map(async (validationObject) =>
                await createResponseObject(
                  { validationObject, methods, options },
                )
              ),
            )
            : await createResponseObject(
              {
                validationObject: validationObjectOrBatch,
                methods,
                options,
              },
            );
        if (responseObjectOrBatchOrNull) {
          await socket.send(JSON.stringify(responseObjectOrBatchOrNull));
        }
      } else if (isWebSocketCloseEvent(ev)) {
        // const { code, reason } = ev;
        // console.log("ws:Close", code, reason);
        if (options.enableInternalMethods) {
          removeEventListener("emit", emitListenerOrNull as EventListener);
        }
      }
    }
  } catch (err) {
    console.error(`failed to receive frame: ${err}`);
    if (options.enableInternalMethods && emitListenerOrNull) {
      removeEventListener("emit", emitListenerOrNull as EventListener);
    }
    if (!socket.isClosed) {
      await socket.close(1000).catch((err) => console.error(err));
    }
  }
}
