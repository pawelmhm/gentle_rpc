import { createRemote } from "../../mod.ts";

const remote = await createRemote(new WebSocket("ws://0.0.0.0:8000")).catch(
  (err) => {
    console.log(err);
    throw err;
  },
);
const noise = await remote.call("callNamedParameters", {
  a: 10,
  b: 20,
  c: "The result is:",
}).catch((err) => {
  console.log(err, err.data);
});
// The result is: 200
console.log(noise);

const notification = await remote.call("animalsMakeNoise", ["wuufff"], true);
// undefined
console.log(notification);

remote.socket.close();
