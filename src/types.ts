// src/types.ts

export type NodeType = 'form' | 'line' | 'index' | 'regulation';

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  val?: number;
  totalVal?: number;
  color?: string;
  baseColor?: string;
  node_type: NodeType;
  display_label?: string | null;
  category?: 'individual' | 'corporation';
  
  amount?: number;
  num_forms?: number;
  amount_per_form?: number | null;
  
  total_amount?: number | null;
  total_num_forms?: number | null;
  num_lines?: number;

  ind_total_amount?: number | null;
  ind_total_num_forms?: number | null;
  ind_amount_per_form?: number | null;
  ind_num_lines?: number;
  
  corp_total_amount?: number | null;
  corp_total_num_forms?: number | null;
  corp_amount_per_form?: number | null;
  corp_num_lines?: number;
  
  title?: string;
  subtitle?: string;
  chapter?: string;
  subchapter?: string;
  part?: string;
  subpart?: string;
  section?: string;
  subsection?: string;

  hierarchy?: {
    title?: string;
    part?: string;
    part2?: string;
    chapter?: string;
    subchapter?: string;
    subpart?: string;
    section?: string;
    subsection?: string;
    paragraph?: string;
    subparagraph?: string;
    clause?: string;
    subclause?: string;
  };
  
  index_heading?: string;

  properties?: {
    full_name?: string;
    text?: string;
    definition?: string;
    embedding?: number[];
    [key: string]: any;
  };

  full_name?: string;
  text?: string;
  definition?: string;

  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  edge_type: 'belongs_to' | 'cites_section' | 'cites_regulation' | 'hierarchy' | 'reference';
  action?: string;
  definition?: string;
  location?: string;
  timestamp?: string;
  weight?: number;
  count?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Relationship {
  id: number;
  doc_id: string;
  timestamp: string | null;
  actor: string;
  action: string;
  target: string;
  location: string | null;
  tags: string[];
  actor_type?: NodeType;
  target_type?: NodeType;
  actor_id?: string;
  target_id?: string;
  actor_category?: 'individual' | 'corporation';
  target_category?: 'individual' | 'corporation';
  definition?: string;
  edge_type?: string;
}

export interface Actor {
  name: string;
  connection_count: number;
}

export interface Stats {
  totalDocuments: { count: number };
  totalTriples: { count: number };
  totalActors: { count: number };
  categories: { category: string; count: number }[];
}

export interface Document {
  doc_id: string;
  file_path: string;
  one_sentence_summary: string;
  paragraph_summary: string;
  category: string;
  date_range_earliest: string | null;
  date_range_latest: string | null;
  full_name?: string;
  text?: string;
  form_name?: string;
  line_name?: string;
  section_name?: string;
  regulation_name?: string;
  title?: string;
  subtitle?: string;
  chapter?: string;
  subchapter?: string;
  part?: string;
  subpart?: string;
  section?: string;
  subsection?: string;
  hierarchy?: {
    title?: string;
    part?: string;
    part2?: string;
    chapter?: string;
    subchapter?: string;
    subpart?: string;
    section?: string;
    subsection?: string;
    paragraph?: string;
    subparagraph?: string;
    clause?: string;
    subclause?: string;
  };
  index_heading?: string;
}

export interface TagCluster {
  id: number;
  name: string;
  exemplars: string[];
  tagCount: number;
}

export interface NetworkBuilderState {
  searchTerms: string[];
  searchFields: ('name' | 'full_name' | 'definition' | 'text')[];
  allowedNodeTypes: ('form' | 'line' | 'index' | 'regulation')[];
  allowedEdgeTypes: ('belongs_to' | 'cites_section' | 'cites_regulation' | 'hierarchy' | 'reference')[];
  allowedCategories: ('individual' | 'corporation')[];
  allowedForms: string[];
  seedNodeIds: string[];
  expansionDepth: number;
  maxNodesPerExpansion: number;
  maxTotalNodes: number;
}

export interface FilteredGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  truncated: boolean;
  matchedCount: number;
}
