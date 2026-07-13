import { buildGraph } from '../lib/build-graph';
import { GraphView } from './graph-view';

export function SiteGraph() {
  const graph = buildGraph();
  return <GraphView graph={graph} />;
}
