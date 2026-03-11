// src/App.tsx

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import NetworkGraph from './components/NetworkGraph';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import { WelcomeModal } from './components/WelcomeModal';
import { NetworkBuilder } from './services/networkBuilder';
import TableViewForms from './components/TableViewForms';
import DocumentModal from './components/DocumentModal';

import { 
  fetchActorCounts 
} from './api';
import type { 
  Stats, 
  Relationship, 
  TagCluster, 
  NetworkBuilderState, 
  FilteredGraph,
  GraphNode,
  GraphLink 
} from './types';

function App() {
  const [buildMode, setBuildMode] = useState<'topDown' | 'bottomUp'>('topDown');

  const [fullGraph, setFullGraph] = useState<{ nodes: GraphNode[], links: GraphLink[] }>({ 
    nodes: [], 
    links: [] 
  });
  const [builder, setBuilder] = useState<NetworkBuilder | null>(null);
  const [displayGraph, setDisplayGraph] = useState<FilteredGraph>({
    nodes: [],
    links: [],
    truncated: false,
    matchedCount: 0
  });

  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [openDocIndex, setOpenDocIndex] = useState<number>(0);


  const [displayGraphInfo, setDisplayGraphInfo] = useState<{
    nodeCount: number;
    linkCount: number;
    truncated: boolean;
    matchedCount: number;
  } | null>(null);

  const [viewMode, setViewMode] = useState<'graph' | 'table'>('graph');

  const lastSearchParamsRef = useRef<{
    keywords: string;
    expansionDegree: number;
    maxNodes: number;
    nodeTypes: string[];
    edgeTypes: string[];
    searchFields: string[];
    searchLogic: 'AND' | 'OR';
    categoryFilter: string[];
    nodeRankingMode: 'global' | 'subgraph';
  } | null>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [tagClusters, setTagClusters] = useState<TagCluster[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [totalBeforeLimit, setTotalBeforeLimit] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [actorRelationships, setActorRelationships] = useState<Relationship[]>([]);
  const [actorTotalBeforeFilter, setActorTotalBeforeFilter] = useState<number>(0);
  const [limit, setLimit] = useState(4000);
  const [maxHops, setMaxHops] = useState<number | null>(2000);
  const [minDensity, setMinDensity] = useState(50);
  const [enabledClusterIds, setEnabledClusterIds] = useState<Set<number>>(new Set());
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(new Set());
  const [yearRange, setYearRange] = useState<[number, number]>([1980, 2025]);
  const [includeUndated, setIncludeUndated] = useState(false);
  const [keywords, setKeywords] = useState('');
  const [actorTotalCounts, setActorTotalCounts] = useState<Record<string, number>>({});
  const [categoryFilter, setCategoryFilter] = useState<Set<'individual' | 'corporation'>>(
    new Set(['individual'])
  );
  const [enabledNodeTypes, setEnabledNodeTypes] = useState<Set<string>>(
    new Set(['form', 'line', 'index', 'regulation'])
  );
  const [showWelcome, setShowWelcome] = useState(() => {
    return !localStorage.getItem('hasSeenWelcome');
  });
  const [isInitialized, setIsInitialized] = useState(false);

  const currentCategory = categoryFilter.size === 1 
    ? Array.from(categoryFilter)[0] 
    : 'all' as 'individual' | 'corporation' | 'all';

  const toggleNodeType = (nodeType: string) => {
    setEnabledNodeTypes(prev => {
      const next = new Set(prev);
      if (next.has(nodeType)) {
        next.delete(nodeType);
      } else {
        next.add(nodeType);
      }
      return next;
    });
  };

  const convertGraphToRelationships = useCallback((nodes: GraphNode[], links: GraphLink[]): Relationship[] => {
    return links.map((link, idx) => {
      const sourceNode = nodes.find(n => n.id === (typeof link.source === 'string' ? link.source : link.source.id));
      const targetNode = nodes.find(n => n.id === (typeof link.target === 'string' ? link.target : link.target.id));

      return {
        id: idx,
        doc_id: sourceNode?.id || '',
        timestamp: link.timestamp || null,
        actor: sourceNode?.name || sourceNode?.id || '',
        action: link.action || link.edge_type || 'relationship',
        target: targetNode?.name || targetNode?.id || '',
        location: link.location || null,
        tags: [],
        actor_type: sourceNode?.node_type,
        target_type: targetNode?.node_type,
        actor_id: sourceNode?.id,
        target_id: targetNode?.id,
        edge_type: link.edge_type,
      };
    });
  }, []);

  useEffect(() => {
    const loadGraphData = async () => {
      try {
        const apiModule = await import('./api');

        if (typeof apiModule.loadGraph === 'function') {
          const data = await apiModule.loadGraph();
          setFullGraph(data);
          setBuilder(new NetworkBuilder(data.nodes, data.links));
        } else {
          throw new Error('loadGraph function not found in api module');
        }
      } catch (err) {
        console.error('Failed to load graph data:', err);
        setFullGraph({ nodes: [], links: [] });
      }
    };

    loadGraphData();
  }, []);

  useEffect(() => {
    if (fullGraph.nodes.length > 0) {
      const belongsToLinks = fullGraph.links.filter(l => l.edge_type === 'belongs_to').length;
      const citesSectionLinks = fullGraph.links.filter(l => l.edge_type === 'cites_section').length;
      const citesRegulationLinks = fullGraph.links.filter(l => l.edge_type === 'cites_regulation').length;
      const hierarchyLinks = fullGraph.links.filter(l => l.edge_type === 'hierarchy').length;
      const referenceLinks = fullGraph.links.filter(l => l.edge_type === 'reference').length;

      setStats({
        totalDocuments: { count: fullGraph.nodes.length },
        totalTriples: { count: fullGraph.links.length },
        totalActors: { count: fullGraph.nodes.length },
        categories: [
          { category: 'belongs_to', count: belongsToLinks },
          { category: 'cites_section', count: citesSectionLinks },
          { category: 'cites_regulation', count: citesRegulationLinks },
          { category: 'hierarchy', count: hierarchyLinks },
          { category: 'reference', count: referenceLinks }
        ]
      });

      setEnabledCategories(new Set(['belongs_to', 'cites_section', 'cites_regulation']));
      setIsInitialized(true);
    }
  }, [fullGraph]);

  useEffect(() => {
    if (isInitialized && buildMode === 'topDown') {
      loadData();
    }
  }, [
    isInitialized,
    buildMode,
    limit,
    enabledClusterIds,
    enabledCategories,
    enabledNodeTypes,
    yearRange,
    includeUndated,
    maxHops,
    categoryFilter
  ]);

  useEffect(() => {
    if (buildMode === 'bottomUp' && lastSearchParamsRef.current && builder) {
      const updatedParams = {
        ...lastSearchParamsRef.current,
        maxNodes: maxHops || 1500,
        nodeTypes: Array.from(enabledNodeTypes),
        edgeTypes: Array.from(enabledCategories),
        categoryFilter: Array.from(categoryFilter)
      };
      
      executeBottomUpSearch(updatedParams);
    }
  }, [
    buildMode,
    maxHops,
    enabledNodeTypes,
    enabledCategories,
    categoryFilter,
    builder
  ]);

  const loadData = async () => {
    if (buildMode !== 'topDown') {
      return;
    }

    try {
      setLoading(true);
      const clusterIds = Array.from(enabledClusterIds);
      const categories = Array.from(enabledCategories);
      
      const apiModule = await import('./api');
      const [relationshipsResponse, actorCounts] = await Promise.all([
        apiModule.fetchRelationships(limit, clusterIds, categories, yearRange, includeUndated, keywords, maxHops),
        fetchActorCounts(300)
      ]);

      let filteredByCategory = relationshipsResponse.relationships;
      if (categoryFilter.size > 0 && categoryFilter.size < 2) {
        filteredByCategory = filteredByCategory.filter(() => true);
      }

      let filteredByNodeType = filteredByCategory;
      if (enabledNodeTypes.size > 0 && enabledNodeTypes.size < 4) {
        filteredByNodeType = filteredByNodeType.filter(rel => {
          const sourceType = rel.actor_type;
          const targetType = rel.target_type;
          return enabledNodeTypes.has(sourceType) && enabledNodeTypes.has(targetType);
        });
      }

      let filteredRelationships = filteredByNodeType;

      if (maxHops !== null && maxHops < filteredRelationships.length) {
        const nodeSet = new Set<string>();
        const nodeDegree = new Map<string, number>();

        filteredRelationships.forEach(rel => {
          const actorId = rel.actor_id ?? rel.actor;
          const targetId = rel.target_id ?? rel.target;

          nodeSet.add(actorId);
          nodeSet.add(targetId);

          nodeDegree.set(actorId, (nodeDegree.get(actorId) || 0) + 1);
          nodeDegree.set(targetId, (nodeDegree.get(targetId) || 0) + 1);
        });

        if (nodeSet.size > maxHops) {
          const sortedNodes = Array.from(nodeDegree.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxHops)
            .map(([nodeId]) => nodeId);

          const allowedNodes = new Set(sortedNodes);

          filteredRelationships = filteredRelationships.filter(rel => {
            const actorId = rel.actor_id ?? rel.actor;
            const targetId = rel.target_id ?? rel.target;
            return allowedNodes.has(actorId) && allowedNodes.has(targetId);
          });
        }
      }

      setRelationships(filteredRelationships);
      setTotalBeforeLimit(relationshipsResponse.totalBeforeLimit);
      setActorTotalCounts(actorCounts);
      
      setDisplayGraph({
        nodes: [],
        links: [],
        truncated: false,
        matchedCount: 0
      });
      setDisplayGraphInfo(null);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

// What's actually displayed in the graph after ALL filters including categoryFilter
const graphDisplayInfo = useMemo(() => {
  if (buildMode === 'bottomUp') return displayGraphInfo;

  const selectedCategory = categoryFilter.size === 1 ? Array.from(categoryFilter)[0] : null;

  const filtered = selectedCategory
    ? relationships.filter(rel => {
        const sourceIsIndex = rel.actor_type === 'index';
        const targetIsIndex = rel.target_type === 'index';
        const sourceId = rel.actor_id ?? rel.actor;
        const targetId = rel.target_id ?? rel.target;
        const sourceCat = sourceId.split(':')[1];
        const targetCat = targetId.split(':')[1];
        if (!sourceIsIndex && sourceCat !== selectedCategory) return false;
        if (!targetIsIndex && targetCat !== selectedCategory) return false;
        return true;
      })
    : relationships;

  const nodeIds = new Set<string>();
  filtered.forEach(rel => {
    nodeIds.add(rel.actor_id ?? rel.actor);
    nodeIds.add(rel.target_id ?? rel.target);
  });

  return { nodeCount: nodeIds.size, linkCount: filtered.length, truncated: false, matchedCount: nodeIds.size };
}, [buildMode, displayGraphInfo, relationships, categoryFilter]);


// Total counts from fullGraph — respects category + node/edge type filters but no limit/maxHops
const totalGraphInfo = useMemo(() => {
  const selectedCategory = categoryFilter.size === 1 ? Array.from(categoryFilter)[0] : null;
  const nodeMap = new Map(fullGraph.nodes.map(n => [n.id, n]));

  let filteredLinks = fullGraph.links;

  if (selectedCategory) {
    filteredLinks = filteredLinks.filter(l => {
      const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      const sourceNode = nodeMap.get(sourceId);
      const targetNode = nodeMap.get(targetId);
      const sourceIsIndex = sourceNode?.node_type === 'index';
      const targetIsIndex = targetNode?.node_type === 'index';
      if (!sourceIsIndex && sourceNode?.category !== selectedCategory) return false;
      if (!targetIsIndex && targetNode?.category !== selectedCategory) return false;
      return true;
    });
  }

  const nodeIds = new Set<string>();
  filteredLinks.forEach(l => {
    nodeIds.add(typeof l.source === 'string' ? l.source : (l.source as any).id);
    nodeIds.add(typeof l.target === 'string' ? l.target : (l.target as any).id);
  });

  return { nodeCount: nodeIds.size, linkCount: filteredLinks.length };
}, [fullGraph, categoryFilter]);



const tableGraph = useMemo(() => {
  const categories = Array.from(enabledCategories);
  const nodeTypes = Array.from(enabledNodeTypes);
  const selectedCategory = categoryFilter.size === 1 ? Array.from(categoryFilter)[0] : null;
  const nodeMap = new Map(fullGraph.nodes.map(n => [n.id, n]));

  // Determine source links
  let filteredLinks = buildMode === 'bottomUp' && displayGraph.nodes.length > 0
    ? displayGraph.links
    : fullGraph.links;

  // Edge type filter
  if (categories.length > 0) {
    filteredLinks = filteredLinks.filter(l => categories.includes(l.edge_type));
  }

  // Node type + category filter on links
  filteredLinks = filteredLinks.filter(l => {
    const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
    const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
    const sourceNode = nodeMap.get(sourceId);
    const targetNode = nodeMap.get(targetId);

    if (nodeTypes.length > 0 && nodeTypes.length < 4) {
      if (!nodeTypes.includes(sourceNode?.node_type || '') ||
          !nodeTypes.includes(targetNode?.node_type || '')) return false;
    }
    if (selectedCategory) {
      const sourceIsIndex = sourceNode?.node_type === 'index';
      const targetIsIndex = targetNode?.node_type === 'index';
      if (!sourceIsIndex && sourceNode?.category !== selectedCategory) return false;
      if (!targetIsIndex && targetNode?.category !== selectedCategory) return false;
    }
    return true;
  });

  // For table: include ALL nodes passing filters, even those with no links
  const sourceNodes = buildMode === 'bottomUp' && displayGraph.nodes.length > 0
    ? displayGraph.nodes
    : fullGraph.nodes;

  const filteredNodes = sourceNodes.filter(n => {
    if (nodeTypes.length > 0 && nodeTypes.length < 4) {
      if (!nodeTypes.includes(n.node_type || '')) return false;
    }
    if (selectedCategory) {
      const isIndex = n.node_type === 'index';
      if (!isIndex && n.category !== selectedCategory) return false;
    }
    return true;
  });

  return { nodes: filteredNodes, links: filteredLinks };
}, [buildMode, displayGraph, fullGraph, enabledCategories, enabledNodeTypes, categoryFilter]);


const navNodeIds = useMemo(() => {
  if (!selectedActor) return [];
  const selectedNode = fullGraph.nodes.find(n => n.name === selectedActor);
  if (!selectedNode) return [];
  return actorRelationships
    .map(rel => {
      const actorId = rel.actor_id ?? rel.actor;
      const targetId = rel.target_id ?? rel.target;
      return actorId === selectedNode.id ? targetId : actorId;
    })
    .filter(id => {
      const node = fullGraph.nodes.find(n => n.id === id);
      return node?.node_type === 'index' || node?.node_type === 'section';
    }) as string[];
}, [actorRelationships, selectedActor, fullGraph.nodes]);



  const handleActorClick = useCallback((actorName: string | null) => {
    setSelectedActor(prev => {
      if (actorName === null) return null;
      if (prev === actorName) return null;
      return actorName;
    });
  }, []);

  const toggleCluster = useCallback((clusterId: number) => {
    setEnabledClusterIds(prev => {
      const next = new Set(prev);
      if (next.has(clusterId)) {
        next.delete(clusterId);
      } else {
        next.add(clusterId);
      }
      return next;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setEnabledCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const toggleCategoryFilter = useCallback((category: 'individual' | 'corporation') => {
    setCategoryFilter(new Set([category]));
  }, []);

  const handleCloseWelcome = useCallback(() => {
    localStorage.setItem('hasSeenWelcome', 'true');
    setShowWelcome(false);
  }, []);

  useEffect(() => {
    if (!selectedActor) {
      setActorRelationships([]);
      setActorTotalBeforeFilter(0);
      return;
    }

    if (buildMode === 'bottomUp' && displayGraph.nodes.length > 0) {
      const nodeId = displayGraph.nodes.find(n => n.name === selectedActor)?.id;
      if (nodeId) {
        const relatedLinks = displayGraph.links.filter(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return sourceId === nodeId || targetId === nodeId;
        });

        const rels = convertGraphToRelationships(displayGraph.nodes, relatedLinks);
        setActorRelationships(rels);
        setActorTotalBeforeFilter(rels.length);
      }
    } else {
      const actorRels = relationships.filter(rel => 
        rel.actor === selectedActor || rel.target === selectedActor
      );
      setActorRelationships(actorRels);
      setActorTotalBeforeFilter(actorRels.length);
    }
  }, [selectedActor, displayGraph, relationships, buildMode, convertGraphToRelationships]);

  const executeBottomUpSearch = useCallback((params: {
    keywords: string;
    expansionDegree: number;
    maxNodes: number;
    nodeTypes: string[];
    edgeTypes: string[];
    searchFields: string[];
    searchLogic: 'AND' | 'OR';
    categoryFilter: string[];
    nodeRankingMode: 'global' | 'subgraph';
  }) => {
    if (!builder) {
      return;
    }

    if (params.searchFields.length === 0) {
      return;
    }

    if (params.edgeTypes.length === 0 && params.expansionDegree === 0) {
      setDisplayGraph({
        nodes: [],
        links: [],
        truncated: false,
        matchedCount: 0
      });
      setDisplayGraphInfo({
        nodeCount: 0,
        linkCount: 0,
        truncated: false,
        matchedCount: 0
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    setRelationships([]);

    try {
      const terms = params.keywords.split(',').map(t => t.trim()).filter(t => t);

      const builderState: NetworkBuilderState = {
        searchTerms: terms,
        searchFields: params.searchFields as ('name' | 'full_name' | 'definition' | 'text')[],
        allowedNodeTypes: params.nodeTypes as ('form' | 'line' | 'index' | 'regulation')[],
        allowedEdgeTypes: params.edgeTypes as ('belongs_to' | 'cites_section' | 'cites_regulation' | 'hierarchy' | 'reference')[],
        allowedCategories: params.categoryFilter as ('individual' | 'corporation')[],
        allowedForms: [],
        seedNodeIds: [],
        expansionDepth: params.expansionDegree,
        maxNodesPerExpansion: 100,
        maxTotalNodes: params.maxNodes
      };

      const filtered = builder.buildNetwork(builderState, params.searchLogic, params.nodeRankingMode);

      if (filtered.nodes.length === 0 && filtered.links.length === 0) {
        setDisplayGraph({
          nodes: [],
          links: [],
          truncated: false,
          matchedCount: 0
        });
        setDisplayGraphInfo({
          nodeCount: 0,
          linkCount: 0,
          truncated: false,
          matchedCount: 0
        });
        setLoading(false);
        return;
      }

      let finalLinks = filtered.links;
      let relationshipTruncated = false;
      
      if (limit && filtered.links.length > limit) {
        finalLinks = filtered.links.slice(0, limit);
        relationshipTruncated = true;
      }

      const connectedNodeIds = new Set<string>();
      finalLinks.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        connectedNodeIds.add(sourceId);
        connectedNodeIds.add(targetId);
      });

      const finalNodes = filtered.nodes.filter(node => connectedNodeIds.has(node.id));

      const actualTruncated = filtered.truncated || relationshipTruncated;

      setDisplayGraph({
        nodes: finalNodes,
        links: finalLinks,
        truncated: actualTruncated,
        matchedCount: filtered.matchedCount
      });

      setDisplayGraphInfo({
        nodeCount: finalNodes.length,
        linkCount: finalLinks.length,
        truncated: actualTruncated,
        matchedCount: filtered.matchedCount
      });

    } catch (error) {
      console.error('Error building network:', error);
      setDisplayGraph({
        nodes: [],
        links: [],
        truncated: false,
        matchedCount: 0
      });
      setDisplayGraphInfo({
        nodeCount: 0,
        linkCount: 0,
        truncated: false,
        matchedCount: 0
      });
    } finally {
      setLoading(false);
    }
  }, [builder, limit]);

  const handleBottomUpSearch = useCallback((params: {
    keywords: string;
    expansionDegree: number;
    maxNodes: number;
    nodeTypes: string[];
    edgeTypes: string[];
    searchFields: string[];
    searchLogic: 'AND' | 'OR';
    categoryFilter: string[];
    nodeRankingMode: 'global' | 'subgraph';
  }) => {
    if (!builder) {
      alert('Network builder is not ready. Please wait for the data to load.');
      return;
    }

    if (!params.keywords.trim()) {
      setBuildMode('topDown');
      setKeywords('');
      setDisplayGraph({
        nodes: [],
        links: [],
        truncated: false,
        matchedCount: 0
      });
      setDisplayGraphInfo(null);
      lastSearchParamsRef.current = null;
      return;
    }

    if (params.searchFields.length === 0) {
      alert('Please select at least one field to search in.');
      return;
    }

    setBuildMode('bottomUp');
    setKeywords(params.keywords);
    lastSearchParamsRef.current = params;

    executeBottomUpSearch(params);
  }, [builder, executeBottomUpSearch]);

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <Sidebar
        stats={stats}
        selectedActor={selectedActor}
        onActorSelect={setSelectedActor}
        limit={limit}
        onLimitChange={setLimit}
        maxHops={maxHops}
        onMaxHopsChange={setMaxHops}
        minDensity={minDensity}
        onMinDensityChange={setMinDensity}
        tagClusters={tagClusters}
        enabledClusterIds={enabledClusterIds}
        onToggleCluster={toggleCluster}
        enabledCategories={enabledCategories}
        onToggleCategory={toggleCategory}
        enabledNodeTypes={enabledNodeTypes}
        onToggleNodeType={toggleNodeType}  
        categoryFilter={categoryFilter}
        onToggleCategoryFilter={toggleCategoryFilter}
        yearRange={yearRange}
        onYearRangeChange={setYearRange}
        includeUndated={includeUndated}
        onIncludeUndatedChange={setIncludeUndated}
        keywords={keywords}
        onKeywordsChange={setKeywords}
        onBottomUpSearch={handleBottomUpSearch}
        buildMode={buildMode}
        displayGraphInfo={graphDisplayInfo}
        topDownGraphInfo={graphDisplayInfo}
        totalGraphInfo={totalGraphInfo}
      />

      <div className="flex-1 relative pb-16 lg:pb-0 overflow-hidden min-w-0">

        {/* Graph / Table Toggle — bottom left */}
        <div className="absolute bottom-12 left-4 z-20 flex rounded-lg overflow-hidden border border-gray-600">
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'graph'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            onClick={() => setViewMode('graph')}
          >
            Graph
          </button>
          <button
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewMode === 'table'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full bg-gray-900">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-300">Loading network...</p>
            </div>
          </div>
        ) : viewMode === 'graph' ? (
          <NetworkGraph
            graphData={buildMode === 'bottomUp' && displayGraph.nodes.length > 0 ? displayGraph : undefined}
            relationships={buildMode === 'topDown' && relationships.length > 0 ? relationships : undefined}
            fullGraph={fullGraph}
            selectedActor={selectedActor}
            onActorClick={handleActorClick}
            minDensity={minDensity}
            actorTotalCounts={actorTotalCounts}
            categoryFilter={categoryFilter}
          />
        ) : (
          <TableViewForms
            nodes={tableGraph.nodes}
            links={tableGraph.links}
            onNodeClick={(id) => {
              if (!id) return;
              const node = fullGraph.nodes.find(n => n.id === id);
              if (node) handleActorClick(node.name);
            }}
          />
        )}
      </div>


      {selectedActor && (
        <RightSidebar
          selectedActor={selectedActor}
          relationships={actorRelationships}
          totalRelationships={actorTotalBeforeFilter}
          onClose={() => setSelectedActor(null)}
          yearRange={yearRange}
          keywords={keywords}
          categoryFilter={currentCategory}
          onActorClick={handleActorClick}
          onViewFullText={(nodeId) => {
  const idx = navNodeIds.indexOf(nodeId);
  setOpenDocId(nodeId);
  setOpenDocIndex(idx >= 0 ? idx : 0);
}}
        />
      )}

{openDocId && (
  <DocumentModal
    docId={openDocId}
    highlightTerm={selectedActor}
    onClose={() => setOpenDocId(null)}
    currentIndex={openDocIndex}
    totalCount={navNodeIds.length}
    onPrev={openDocIndex > 0 ? () => {
      const newIdx = openDocIndex - 1;
      setOpenDocId(navNodeIds[newIdx]);
      setOpenDocIndex(newIdx);
    } : undefined}
    onNext={openDocIndex < navNodeIds.length - 1 ? () => {
      const newIdx = openDocIndex + 1;
      setOpenDocId(navNodeIds[newIdx]);
      setOpenDocIndex(newIdx);
    } : undefined}
  />
)}



      <WelcomeModal isOpen={showWelcome} onClose={handleCloseWelcome} />
    </div>
  );
}

export default App;
