import assert from "node:assert/strict";
import {
  createMemoryGateway,
  filesUnder,
  inspectCreativeFile,
  pathBelongsToClient,
  placementFromRelativePath,
  planFolderMove,
  planMove,
  planRemoval,
  planRootFolder,
  removalSummary,
  rootFoldersForClient,
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
const verticeFolder = await gateway.createFolder("Campanha Consignado", vertice);
assert.equal(verticeFolder.name, "Campanha Consignado");
assert.equal(verticeFolder.organizationId, vertice);
assert.equal(verticeFolder.parentId, null);
const segunda = await gateway.createFolder("Setembro 2026", vertice);
assert.equal(segunda.organizationId, vertice);
await assert.rejects(() => gateway.createFolder("Campanha Consignado", vertice), /esse nome/);
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
  own.folders
    .map((folder) => folder.name)
    .sort((left, right) => left.localeCompare(right, "pt-BR")),
  ["Campanha Consignado", "Setembro", "Setembro 2026"],
);
assert.deepEqual(
  own.files.map((item) => item.name),
  ["feed-oferta.png"],
);
assert.equal(
  own.folders.every((folder) => folder.organizationId === vertice),
  true,
);

gateway.setViewer(null);
await gateway.setFolderAccess(verticeFolder.id, alvorada);
gateway.setViewer(vertice);
const afterMove = await gateway.load();
assert.equal(
  afterMove.folders.some((folder) => folder.name === "Campanha Consignado"),
  false,
);
assert.equal(
  afterMove.files.some((item) => item.name === "feed-oferta.png"),
  false,
);
gateway.setViewer(alvorada);
const received = await gateway.load();
assert.equal(
  received.folders.some((folder) => folder.name === "Campanha Consignado"),
  true,
);
assert.equal(
  received.files.every(
    (item) => item.organizationId === alvorada && item.storagePath.startsWith(`${alvorada}/`),
  ),
  true,
);
gateway.setViewer(null);
assert.equal(planRootFolder(seed.clients, [], "", "Pasta").ok, false);
assert.equal(planRootFolder(seed.clients, [], vertice, "Institucional").ok, true);

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

const nestedMove = planFolderMove(
  [verticeFolder, setembro, segunda],
  [feed],
  setembro.id,
  segunda.id,
);
assert.equal(nestedMove.ok, true);
assert.equal(
  planFolderMove([verticeFolder, setembro], [feed], setembro.id, verticeFolder.id).ok,
  false,
);
assert.equal(planFolderMove([verticeFolder, setembro], [feed], setembro.id, null).ok, true);
assert.equal(
  planFolderMove([verticeFolder, setembro], [feed], verticeFolder.id, setembro.id).ok,
  false,
);
assert.equal(
  planFolderMove(
    [verticeFolder, { id: "outra", organizationId: alvorada, parentId: null, name: "Outra" }],
    [],
    verticeFolder.id,
    "outra",
  ).ok,
  false,
);
const moveGateway = createMemoryGateway({ clients: seed.clients, folders: [], files: [] });
const origem = await moveGateway.createFolder("Origem", vertice);
const destino = await moveGateway.createFolder("Destino", vertice);
const filha = await moveGateway.createSubfolder(origem.id, "Filha");
const peca = await moveGateway.upload(filha.id, file("peca.png"));
await moveGateway.moveFolder(filha.id, destino.id);
assert.equal(
  (await moveGateway.load()).folders.find((folder) => folder.id === filha.id)?.parentId,
  destino.id,
);
await moveGateway.moveFile(peca.id, origem.id);
assert.equal(
  (await moveGateway.load()).files.find((item) => item.id === peca.id)?.folderId,
  origem.id,
);
moveGateway.setViewer(vertice);
await assert.rejects(() => moveGateway.moveFolder(filha.id, origem.id), /Master/);

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

const libraryFolders = [
  verticeFolder,
  setembro,
  { id: "raiz-b", organizationId: alvorada, parentId: null, name: "Outra conta" },
];
const inside = { ...feed, id: "dentro", folderId: setembro.id, name: "dentro.png" };
const loose = { ...feed, id: "solto", folderId: verticeFolder.id, name: "solto.png" };
const other = {
  ...feed,
  id: "arquivo-b",
  organizationId: alvorada,
  folderId: "raiz-b",
  name: "outro.png",
};
const libraryFiles = [feed, inside, loose, other];

assert.deepEqual(planRemoval(libraryFolders, libraryFiles, [loose.id]), {
  folders: [],
  files: [loose.id],
});
assert.deepEqual(planRemoval(libraryFolders, libraryFiles, [setembro.id, inside.id, loose.id]), {
  folders: [setembro.id],
  files: [loose.id],
});
assert.deepEqual(
  planRemoval(libraryFolders, libraryFiles, [verticeFolder.id, setembro.id, feed.id]),
  {
    folders: [verticeFolder.id],
    files: [],
  },
);
assert.deepEqual(planRemoval(libraryFolders, libraryFiles, [loose.id, other.id]).files, [
  loose.id,
  other.id,
]);
assert.equal(
  removalSummary(libraryFolders, libraryFiles, { folders: [], files: [loose.id] }).title,
  "Excluir solto.png?",
);
assert.equal(
  removalSummary(libraryFolders, libraryFiles, { folders: [setembro.id], files: [loose.id] }).title,
  "Excluir 1 pasta e 1 arquivo?",
);
assert.deepEqual(
  rootFoldersForClient(libraryFolders, null).map((folder) => folder.name),
  ["Campanha Consignado", "Outra conta"],
);
assert.deepEqual(
  rootFoldersForClient(libraryFolders, vertice).map((folder) => folder.id),
  [verticeFolder.id],
);
assert.deepEqual(
  rootFoldersForClient(libraryFolders, alvorada).map((folder) => folder.name),
  ["Outra conta"],
);

console.log("creative-library ok");
