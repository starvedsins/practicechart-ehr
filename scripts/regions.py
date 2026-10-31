"""Count planar graph faces independently of the edge-node formula."""
import json
import os
import sys
from pathlib import Path
try:
    import networkx as nx
except ImportError:
    sys.path.insert(0, str(Path(os.environ.get('TEMP', '/tmp')) / 'practicechart-doc-libs'))
    import networkx as nx

path = Path('docs/evidence/control-flow.json')
graphs = json.loads(path.read_text())
lines = ['# Control flow and basis path analysis', '',
         'The generator reads the implemented TypeScript functions. It expands transaction callbacks. It does not expand database engines or library internals. SQL constraints have separate integration tests. Graphs use one entry and one exit. Compound conditions are split. Each explicit I/O try block has one fault branch.', '',
         'Face counts use a planar half-edge traversal. Parallel directed edges add a lens face. Predicate counts are taken from nodes with two outgoing edges. The third method uses the separate edge and node counts. These three results must agree.', '',
         '| Function | Nodes N | Edges E | Faces R | Predicates P | R | P + 1 | E - N + 2 |',
         '| --- | --- | --- | --- | --- | --- | --- | --- |']
for graph in graphs:
    g = nx.Graph()
    g.add_nodes_from(n['id'] for n in graph['nodes'])
    pairs = [tuple(sorted((e['from'], e['to']))) for e in graph['edges']]
    g.add_edges_from(pairs)
    planar, embedding = nx.check_planarity(g)
    if not planar:
        raise ValueError('Graph needs a planar presentation: ' + graph['name'])
    visited = set()
    faces = []
    for a, b in embedding.edges():
        if (a, b) not in visited:
            faces.append(embedding.traverse_face(a, b, visited))
    lenses = len(pairs) - len(set(pairs))
    regions = len(faces) + lenses
    graph['regionCount'] = regions
    graph['faceBoundaries'] = faces
    graph['parallelLensFaces'] = lenses
    assert regions == graph['predicateComplexity'] == graph['edgeNodeComplexity'], graph['name']
    n, e, p = len(graph['nodes']), len(graph['edges']), graph['predicates']
    lines.append(f"| {graph['name']} | {n} | {e} | {regions} | {p} | {regions} | {p + 1} | {e - n + 2} |")
lines += ['', '## Basis path candidates', '',
          'The following paths are independent in the generated graph. They are syntactic candidates, not a claim that every candidate is feasible or was executed. Branch conditions can depend on earlier state. For example, a stale revision cannot also reach a successful save in the same execution. Repeated file and medication paths depend on the number of records. Do not invent inputs to force an impossible path.', '',
          'Actual feasible scenarios and test outcomes are mapped in TEST_PLAN.md. Full possible-path coverage is not claimed. V8 statement and branch coverage is recorded separately. A loop can have more possible executions than its basis-path count.', '']
for graph in graphs:
    lines += [f"### {graph['name']}", '', f"Source: {graph['file']}:{graph['line']}. [Graph](diagrams/cfg/{graph['name']}.svg).", '']
    for i, route in enumerate(graph['syntacticBasisCandidates'], 1):
        lines.append(f"- Candidate {i}: " + ' -> '.join(map(str, route)))
    lines += ['', 'Face boundaries: ' + '; '.join(' -> '.join(map(str, f)) for f in graph['faceBoundaries']) + f". Additional parallel-edge lens faces: {graph['parallelLensFaces']}.", '']
path.write_text(json.dumps(graphs, indent=2))
Path('docs/CONTROL_FLOW.md').write_text('\n'.join(lines))
print(f'All three complexity methods agree for {len(graphs)} functions.')
