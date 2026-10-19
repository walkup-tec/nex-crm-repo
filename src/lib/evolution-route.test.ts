import assert from "node:assert/strict";
import { evolutionBaseUrls, gatewayFromProcRoute } from "./evolution-route";

assert.equal(
  gatewayFromProcRoute("Iface Destination Gateway Flags\neth0 00000000 0112A8C0 0003 0 0 0 00000000 0 0 0\n"),
  "192.168.18.1",
);
assert.equal(
  gatewayFromProcRoute("Iface Destination Gateway Flags\neth0 00000000 010012AC 0003 0 0 0 00000000 0 0 0\n"),
  "172.18.0.1",
);
assert.equal(gatewayFromProcRoute(""), "");

assert.deepEqual(
  evolutionBaseUrls({
    configured: "http://172.17.0.1:30181",
    gateway: "172.18.0.1",
    hostUrl: "http://172.17.0.1:30181",
    publicUrl: "http://72.60.51.127:30181",
  }),
  [
    "http://72.60.51.127:30181",
    "http://172.17.0.1:30181",
    "http://host.docker.internal:30181",
    "http://127.0.0.1:30181",
    "http://172.18.0.1:30181",
  ],
);
assert.deepEqual(
  evolutionBaseUrls({
    configured: "http://evolution.internal:8080",
    gateway: "10.0.0.1",
    hostUrl: "http://172.17.0.1:30181",
    publicUrl: "http://72.60.51.127:30181",
  }),
  [
    "http://72.60.51.127:30181",
    "http://evolution.internal:8080",
    "http://host.docker.internal:30181",
    "http://127.0.0.1:30181",
    "http://172.17.0.1:30181",
  ],
);

console.log("evolution-route tests ok");
