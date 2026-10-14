import http from "node:http";

const NEX_DEPLOY = "NEX-DEPLOY-Q4M7";
console.log(NEX_DEPLOY);

const listen = http.Server.prototype.listen;

http.Server.prototype.listen = function (options, ...args) {
  if (options && typeof options === "object") {
    options.host = "0.0.0.0";
  }
  this.once("listening", () => {
    console.log(`NEX escutando ${JSON.stringify(this.address())}`);
  });
  return listen.call(this, options, ...args);
};
