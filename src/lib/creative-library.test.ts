import assert from "node:assert/strict";
import {
  clientsAwaitingFolder,
  createMemoryGateway,
  filesUnder,
  inspectCreativeFile,
  openingFolder,
  pathBelongsToClient,
  placementFromRelativePath,
  planClientFolder,
  planMove,
  scopeToClient,
  storageObjectPath,
  type CreativeSnapshot,
} from "./creative-library";

const vertice = "11111111-1111-4111-8111-111111111111";
const alvorada = "22222222-2222-4222-8222-222222222222";

const seed: CreativeSnapshot = {
  clients: [
    { id: vertice, name: "Vértice Crédito" },
    { id: alvorada, name: "Clínica Alvorada" },
  ],
  folders: [],
  files: [],
};

const file = (name: string, contents = "imagem") =>
  new File([contents], name, { type: "image/png" });

const gateway = createMemoryGateway(seed);
const verticeFolder = await gateway.createClientFolder(vertice);
assert.equal(verticeFolder.name, "Vértice Crédito");
assert.equal(verticeFolder.organizationId, vertice);
assert.equal(verticeFolder.parentId, null);

await assert.rejects(() => gateway.createClientFolder(vertice), /já tem uma pasta/);
const setembro = await gateway.createSubfolder(verticeFolder.id, "Setembro");
const feed = await gateway.upload(setembro.id, file("feed-oferta.png"));
assert.equal(pathBelongsToClient(feed.storagePath, vertice), true);
assert.equal(feed.storagePath.split("/")[0], vertice);
assert.equal(
  filesUnder([{ ...verticeFolder }, { ...setembro }], [feed], verticeFolder.id).length,
  1,
);

gateway.setViewer(alvorada);
const hidden = await gateway.load();
assert.deepEqual(hidden.folders, []);
assert.deepEqual(hidden.files, []);
await assert.rejects(() => gateway.downloadUrl(feed), /permissão/);
await assert.rejects(() => gateway.upload(setembro.id, file("outro.png")), /Master/);

gateway.setViewer(vertice);
const own = await gateway.load();
assert.deepEqual(
  own.folders.map((folder) => folder.name),
  ["Vértice Crédito", "Setembro"],
);
assert.deepEqual(
  own.files.map((item) => item.name),
  ["feed-oferta.png"],
);
assert.equal(openingFolder(false, own.folders), verticeFolder.id);
assert.equal(openingFolder(true, own.folders), null);

gateway.setViewer(null);
const waiting = clientsAwaitingFolder(
  (await gateway.load()).clients,
  (await gateway.load()).folders,
);
assert.deepEqual(
  waiting.map((client) => client.name),
  ["Clínica Alvorada"],
);
assert.equal(planClientFolder(seed.clients, [], "").ok, false);

const moved = planMove([verticeFolder, setembro], [feed], feed.id, verticeFolder.id);
assert.equal(moved.ok, true);
const blocked = planMove(
  [
    verticeFolder,
    { id: "outra", organizationId: alvorada, parentId: null, name: "Clínica Alvorada" },
  ],
  [feed],
  feed.id,
  "outra",
);
assert.equal(blocked.ok, false);

assert.equal(inspectCreativeFile({ name: "virus.exe", size: 10 }).ok, false);
assert.equal(inspectCreativeFile({ name: "filme.mp4", size: 201 * 1024 * 1024 }).ok, false);
assert.equal(inspectCreativeFile({ name: "peça.webp", size: 20 }).ok, true);

const nested = placementFromRelativePath("Campanha/Setembro/reels.mp4");
assert.deepEqual(nested, { folders: ["Campanha", "Setembro"], fileName: "reels.mp4" });
assert.ok("message" in placementFromRelativePath("../segredo.png"));

const path = storageObjectPath(vertice, feed.id, "peça final.webp");
assert.equal(path.startsWith(`${vertice}/`), true);
assert.equal(path.includes(".."), false);

const scoped = scopeToClient(
  {
    clients: seed.clients,
    folders: [
      verticeFolder,
      { id: "raiz-b", organizationId: alvorada, parentId: null, name: "Clínica Alvorada" },
    ],
    files: [
      feed,
      { ...feed, id: "arquivo-b", organizationId: alvorada, folderId: "raiz-b", name: "outro.png" },
    ],
  },
  vertice,
);
assert.equal(
  scoped.files.every((item) => item.organizationId === vertice),
  true,
);
assert.equal(
  scoped.folders.every((item) => item.organizationId === vertice),
  true,
);

console.log("creative-library ok");
