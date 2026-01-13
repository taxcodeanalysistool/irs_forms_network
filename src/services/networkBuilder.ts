// src/services/networkBuilder.ts

import type { GraphNode, GraphLink, NetworkBuilderState, FilteredGraph } from '../types';

export class NetworkBuilder {
  private allNodes: GraphNode[];
  private allLinks: GraphLink[];
  private adjacencyMap: Map<string, Array<{ neighborId: string; edgeType: string }>>;

  constructor(nodes: GraphNode[], links: GraphLink[]) {
    this.allNodes = nodes;
    this.allLinks = links;
    
    this.adjacencyMap = new Map();
    
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      const edgeType = link.edge_type;
      
      if (!this.adjacencyMap.has(sourceId)) {
        this.adjacencyMap.set(sourceId, []);
      }
      if (!this.adjacencyMap.has(targetId)) {
        this.adjacencyMap.set(targetId, []);
      }
      
      this.adjacencyMap.get(sourceId)!.push({ neighborId: targetId, edgeType });
      this.adjacencyMap.get(targetId)!.push({ neighborId: sourceId, edgeType });
    });
  }

  searchNodes(searchTerms: string[], searchFields: string[], logic: 'AND' | 'OR' = 'OR'): Set<string> {
    const matchedIds = new Set<string>();
    const normalizedTerms = searchTerms.map(t => t.toLowerCase().trim());

    this.allNodes.forEach(node => {
      const searchableValues: string[] = [];
      
      searchFields.forEach(field => {
        let value: any;
        
        switch(field) {
          case 'name':
            value = node.name;
            break;
          case 'full_name':
            value = node.properties?.full_name || node.full_name;
            break;
          case 'definition':
            value = node.properties?.definition || node.definition;
            break;
          case 'text':
            value = node.properties?.text || node.text;
            break;
          default:
            value = (node as any)[field] || node.properties?.[field];
        }

        if (value !== null && value !== undefined) {
          searchableValues.push(String(value).toLowerCase());
        }
      });

      if (logic === 'OR') {
        const shouldMatch = normalizedTerms.some(term => {
          return searchableValues.some(searchableValue => 
            searchableValue.includes(term)
          );
        });

        if (shouldMatch) {
          matchedIds.add(node.id);
        }
      } else {
        const allTermsMatch = normalizedTerms.every(term => {
          return searchableValues.some(searchableValue => 
            searchableValue.includes(term)
          );
        });

        if (allTermsMatch) {
          matchedIds.add(node.id);
        }
      }
    });
    
    return matchedIds;
  }

  filterByAttributes(
    allowedNodeTypes: string[],
    allowedCategories: string[]
  ): Set<string> {
    const matchedIds = new Set<string>();

    this.allNodes.forEach(node => {
      const typeMatch = allowedNodeTypes.length === 0 ? false : 
                       allowedNodeTypes.includes(node.node_type);
      
      const categoryMatch = node.node_type === 'index' || 
                           (allowedCategories.length > 0 && allowedCategories.includes(node.category || ''));

      if (typeMatch && categoryMatch) {
        matchedIds.add(node.id);
      }
    });
    
    return matchedIds;
  }

  expandFromSeeds(
    seedIds: Set<string>,
    depth: number,
    maxNeighborsPerNode: number,
    allowedEdgeTypes: string[]
  ): Set<string> {
    const expanded = new Set<string>(seedIds);
    let currentLayer = new Set<string>(seedIds);

    for (let i = 0; i < depth; i++) {
      const nextLayer = new Set<string>();

      currentLayer.forEach(nodeId => {
        const neighbors = this.adjacencyMap.get(nodeId) || [];
        
        const filteredNeighbors = allowedEdgeTypes.length === 0
          ? []
          : neighbors.filter(n => allowedEdgeTypes.includes(n.edgeType));
        
        const limitedNeighbors = maxNeighborsPerNode > 0 
          ? filteredNeighbors.slice(0, maxNeighborsPerNode)
          : filteredNeighbors;

        limitedNeighbors.forEach(({ neighborId }) => {
          if (!expanded.has(neighborId)) {
            nextLayer.add(neighborId);
            expanded.add(neighborId);
          }
        });
      });

      currentLayer = nextLayer;
      if (currentLayer.size === 0) break;
    }

    return expanded;
  }

  buildNetwork(state: NetworkBuilderState, searchLogic: 'AND' | 'OR' = 'OR', nodeRankingMode: 'global' | 'subgraph' = 'global'): FilteredGraph {
    let candidateNodeIds = new Set<string>();
    let seedNodeIds = new Set<string>();

    if (state.searchTerms.length > 0 && state.searchFields.length > 0) {
      seedNodeIds = this.searchNodes(state.searchTerms, state.searchFields, searchLogic);

      if (seedNodeIds.size === 0) {
        return {
          nodes: [],
          links: [],
          truncated: false,
          matchedCount: 0
        };
      }
      
      if (state.expansionDepth > 0) {
        candidateNodeIds = this.expandFromSeeds(
          seedNodeIds,
          state.expansionDepth,
          state.maxNodesPerExpansion,
          state.allowedEdgeTypes
        );
        
        if (state.allowedNodeTypes.length > 0 || state.allowedCategories.length > 0) {
          candidateNodeIds = new Set(
            [...candidateNodeIds].filter(id => {
              const node = this.allNodes.find(n => n.id === id);
              if (!node) return false;
              
              if (seedNodeIds.has(id)) return true;
              
              const typeMatch = state.allowedNodeTypes.length === 0 || 
                               state.allowedNodeTypes.includes(node.node_type);
              
              let categoryMatch = true;
              if (node.node_type === 'form' || node.node_type === 'line') {
                categoryMatch = state.allowedCategories.length === 0 || 
                               state.allowedCategories.includes(node.category || '');
              }
              
              return typeMatch && categoryMatch;
            })
          );
        }
      } else {
        candidateNodeIds = new Set(seedNodeIds);
      }
    } else {
      candidateNodeIds = new Set(this.allNodes.map(n => n.id));
    }

    const shouldFilterSeeds = state.searchTerms.length > 0 && state.searchFields.length > 0;

    if (shouldFilterSeeds) {
      const seedsAfterFilter = new Set(
        [...seedNodeIds].filter(id => {
          const node = this.allNodes.find(n => n.id === id);
          if (!node) return false;
          
          const typeMatch = state.allowedNodeTypes.length > 0 && 
                           state.allowedNodeTypes.includes(node.node_type);
          
          let categoryMatch = true;
          if (node.node_type === 'form' || node.node_type === 'line') {
            categoryMatch = state.allowedCategories.length > 0 && 
                           state.allowedCategories.includes(node.category || '');
          }
          
          return typeMatch && categoryMatch;
        })
      );
      
      if (seedsAfterFilter.size === 0) {
        return {
          nodes: [],
          links: [],
          truncated: false,
          matchedCount: 0
        };
      }
      
      candidateNodeIds = new Set(
        [...candidateNodeIds].filter(id => 
          seedsAfterFilter.has(id) || !seedNodeIds.has(id)
        )
      );
      
      seedNodeIds = seedsAfterFilter;
    }

    const candidateNodeMap = new Map<string, GraphNode>();
    this.allNodes.forEach(n => {
      if (candidateNodeIds.has(n.id)) {
        candidateNodeMap.set(n.id, n);
      }
    });

    const candidateNodes = Array.from(candidateNodeMap.values());

    const candidateLinks = this.allLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      
      const edgeTypeMatch = state.allowedEdgeTypes.length > 0 && 
                           state.allowedEdgeTypes.includes(link.edge_type);
      
      return edgeTypeMatch && candidateNodeMap.has(sourceId) && candidateNodeMap.has(targetId);
    });

    if (state.allowedEdgeTypes.length === 0 && state.expansionDepth === 0) {
      return {
        nodes: candidateNodes,
        links: [],
        truncated: false,
        matchedCount: candidateNodes.length
      };
    }

    const nodesWithEdges = new Set<string>();
    candidateLinks.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      nodesWithEdges.add(sourceId);
      nodesWithEdges.add(targetId);
    });

    const connectedNodeIds = new Set(
      candidateNodes.filter(n => nodesWithEdges.has(n.id)).map(n => n.id)
    );

    const totalMatches = connectedNodeIds.size;
    const truncated = totalMatches > state.maxTotalNodes;

    let finalNodeIds: Set<string>;

    if (truncated) {
      if (nodeRankingMode === 'subgraph') {
        const nodeDegrees = new Map<string, number>();
        
        candidateLinks.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          
          nodeDegrees.set(sourceId, (nodeDegrees.get(sourceId) || 0) + 1);
          nodeDegrees.set(targetId, (nodeDegrees.get(targetId) || 0) + 1);
        });
        
        const topNodes = Array.from(connectedNodeIds)
          .filter(nodeId => nodeDegrees.has(nodeId))
          .sort((a, b) => (nodeDegrees.get(b) || 0) - (nodeDegrees.get(a) || 0))
          .slice(0, state.maxTotalNodes);
        
        finalNodeIds = new Set(topNodes);
      } else {
        finalNodeIds = new Set(this.selectTopNodesByDegree(connectedNodeIds, state.maxTotalNodes));
      }
    } else {
      finalNodeIds = connectedNodeIds;
    }

    const selectedNodeMap = new Map<string, GraphNode>();
    this.allNodes.forEach(n => {
      if (finalNodeIds.has(n.id)) {
        selectedNodeMap.set(n.id, n);
      }
    });

    const nodes = Array.from(selectedNodeMap.values());

    const links = candidateLinks.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return selectedNodeMap.has(sourceId) && selectedNodeMap.has(targetId);
    });

    const nodeDegree = new Map<string, number>();
    links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      nodeDegree.set(sourceId, (nodeDegree.get(sourceId) || 0) + 1);
      nodeDegree.set(targetId, (nodeDegree.get(targetId) || 0) + 1);
    });

    nodes.forEach(node => {
      node.val = nodeDegree.get(node.id) || 1;
      node.totalVal = node.val;
    });

    const maxVal = Math.max(...nodes.map(n => n.val || 1), 1);
    const strength = (v: number) => Math.pow(v / maxVal, 0.6);

    const formColorScale = (t: number) => {
      const r1 = 0xD9, g1 = 0xEE, b1 = 0xF5;
      const r2 = 0x88, g2 = 0xBA, b2 = 0xCE;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const lineColorScale = (t: number) => {
      const r1 = 0xD9, g1 = 0x9B, b1 = 0xC9;
      const r2 = 0x9C, g2 = 0x33, b2 = 0x91;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const indexColorScale = (t: number) => {
      const r1 = 0x9B, g1 = 0x8B, b1 = 0xCC;
      const r2 = 0x41, g2 = 0x37, b2 = 0x8F;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    const regulationColorScale = (t: number) => {
      const r1 = 0xD9, g1 = 0xC6, b1 = 0xE3;
      const r2 = 0xA6, g2 = 0x7E, b2 = 0xB3;
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      return `rgb(${r}, ${g}, ${b})`;
    };

    nodes.forEach(node => {
      const t = strength(node.val || 1);
      let color: string;

      if (node.node_type === 'form') {
        color = formColorScale(t);
      } else if (node.node_type === 'line') {
        color = lineColorScale(t);
      } else if (node.node_type === 'index') {
        color = indexColorScale(t);
      } else if (node.node_type === 'regulation') {
        color = regulationColorScale(t);
      } else {
        color = '#AFBBE8';
      }

      node.color = color;
      node.baseColor = color;
    });

    return {
      nodes: nodes,
      links,
      truncated: truncated,
      matchedCount: totalMatches
    };
  }

  private selectTopNodesByDegree(nodeIds: Set<string>, maxNodes: number): string[] {
    const nodeDegrees = new Map<string, number>();
    
    nodeIds.forEach(nodeId => {
      const neighbors = this.adjacencyMap.get(nodeId) || [];
      nodeDegrees.set(nodeId, neighbors.length);
    });
    
    return Array.from(nodeDegrees.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxNodes)
      .map(([nodeId]) => nodeId);
  }
}
