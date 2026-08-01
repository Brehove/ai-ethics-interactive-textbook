const MARKER = /^<!--\s*phil-(passage|section)-id:\s*([a-z0-9-]+)\s*-->$/;

function exposeMarkers(parent) {
  if (!Array.isArray(parent?.children)) return;

  for (let index = 0; index < parent.children.length; index += 1) {
    const node = parent.children[index];
    if (node?.type === "html") {
      const match = String(node.value ?? "").trim().match(MARKER);
      if (match) {
        const target = parent.children.slice(index + 1).find((candidate) => candidate?.type !== "html");
        if (target) {
          target.data ??= {};
          target.data.hProperties ??= {};
          target.data.hProperties.id = match[2];
          target.data.hProperties["data-phil-marker"] = match[1];
        }
        parent.children.splice(index, 1);
        index -= 1;
        continue;
      }
    }
    exposeMarkers(node);
  }
}

export default function remarkPhilPassageIds() {
  return exposeMarkers;
}
