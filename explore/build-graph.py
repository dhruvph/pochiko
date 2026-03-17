#!/usr/bin/env python3
"""
Convert ontology graph.jsonl → Cytoscape-compatible graph-data.json
for the Explore page visualization.
"""
import json
import sys
import os
from pathlib import Path

# Paths
WORKSPACE = Path(os.environ.get("WORKSPACE", Path(__file__).parent.parent))
ONTOLOGY_PATH = WORKSPACE / "memory" / "ontology" / "graph.jsonl"
OUTPUT_PATH = Path(__file__).parent / "graph-data.json"

# Group mapping from ontology types → visual groups
TYPE_TO_GROUP = {
    "Person": "people",
    "Organization": "people",
    "Project": "projects",
    "Task": "projects",
    "Goal": "projects",
    "Event": "concepts",
    "Location": "locations",
    "Document": "concepts",
    "Message": "concepts",
    "Note": "concepts",
    "Account": "tools",
    "Device": "infrastructure",
    "Credential": "tools",
    "Action": "concepts",
    "Policy": "infrastructure",
}


def load_ontology(path):
    """Load JSONL ontology and return entities + relations."""
    entities = {}
    relations = []

    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            entry = json.loads(line)
            op = entry.get("op")

            if op == "create":
                ent = entry["entity"]
                entities[ent["id"]] = ent

            elif op == "relate":
                relations.append({
                    "from": entry["from"],
                    "rel": entry["rel"],
                    "to": entry["to"],
                })

            elif op == "update":
                ent = entry["entity"]
                eid = ent["id"]
                if eid in entities:
                    entities[eid]["properties"].update(ent.get("properties", {}))
                else:
                    entities[eid] = ent

    return entities, relations


def entity_label(ent):
    """Generate a display label from entity properties."""
    props = ent.get("properties", {})
    return props.get("name") or props.get("title") or ent["id"]


def convert_to_cytoscape(entities, relations):
    """Convert to Cytoscape format."""
    nodes = []
    seen_ids = set()

    for eid, ent in entities.items():
        group = TYPE_TO_GROUP.get(ent["type"], "concepts")
        props = ent.get("properties", {})
        nodes.append({
            "id": eid,
            "label": entity_label(ent),
            "type": ent["type"].lower(),
            "group": group,
            "url": props.get("url"),
            "status": props.get("status"),
        })
        seen_ids.add(eid)

    # Add implicit nodes from relations that reference non-existent entities
    for rel in relations:
        for ref_id in [rel["from"], rel["to"]]:
            if ref_id not in seen_ids:
                nodes.append({
                    "id": ref_id,
                    "label": ref_id.replace("_", " ").title(),
                    "type": "unknown",
                    "group": "concepts",
                })
                seen_ids.add(ref_id)

    edges = []
    for rel in relations:
        edges.append({
            "source": rel["from"],
            "target": rel["to"],
            "label": rel["rel"].replace("_", " "),
        })

    return {"nodes": nodes, "edges": edges}


def main():
    if not ONTOLOGY_PATH.exists():
        print(f"Error: {ONTOLOGY_PATH} not found", file=sys.stderr)
        sys.exit(1)

    entities, relations = load_ontology(ONTOLOGY_PATH)
    graph = convert_to_cytoscape(entities, relations)

    with open(OUTPUT_PATH, "w") as f:
        json.dump(graph, f, indent=2)

    print(f"✅ Converted {len(graph['nodes'])} nodes, {len(graph['edges'])} edges → {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
