/**
 * AI Workbench - Enterprise Risk Graph & Blast-Radius Engine
 * Sprint 14: Enterprise Intelligence & Policy-as-Code
 */

import { auditLedger } from "../../audit/src/ledger";

export type RiskNodeType =
  | "user"
  | "tenant"
  | "workspace"
  | "repository"
  | "agent"
  | "capability"
  | "tool"
  | "credential"
  | "artifact";

export interface RiskNode {
  id: string;
  label: string;
  type: RiskNodeType;
  tenantId: string;
  sensitivity: "public" | "internal" | "restricted";
}

export interface RiskEdge {
  sourceId: string;
  targetId: string;
  relation:
    | "member_of"
    | "can_use"
    | "can_read"
    | "can_write"
    | "delegates"
    | "produces";
  expiresAt?: string;
}

export interface RiskAnomaly {
  anomalyType: "CROSS_TENANT_CREDENTIAL" | "OUT_OF_SCOPE_AGENT" | "HIGH_BLAST_RADIUS";
  severity: "high" | "critical";
  description: string;
  involvedNodes: string[];
}

export class EnterpriseRiskGraph {
  private nodes: Map<string, RiskNode> = new Map();
  private edges: RiskEdge[] = [];

  constructor() {
    this.seedTopology();
  }

  private seedTopology() {
    // Tenants & Workspaces
    this.addNode({ id: "tenant_fintech_01", label: "Fintech Core Org", type: "tenant", tenantId: "tenant_fintech_01", sensitivity: "restricted" });
    this.addNode({ id: "tenant_health_02", label: "Health BioCorp", type: "tenant", tenantId: "tenant_health_02", sensitivity: "restricted" });

    this.addNode({ id: "ws_payments", label: "Payments Workspace", type: "workspace", tenantId: "tenant_fintech_01", sensitivity: "restricted" });
    this.addNode({ id: "ws_analytics", label: "Bio Informatics WS", type: "workspace", tenantId: "tenant_health_02", sensitivity: "internal" });

    // Repositories
    this.addNode({ id: "repo_ledger", label: "core-ledger-svc", type: "repository", tenantId: "tenant_fintech_01", sensitivity: "restricted" });
    this.addNode({ id: "repo_genome", label: "genomics-pipeline", type: "repository", tenantId: "tenant_health_02", sensitivity: "restricted" });

    // Agents
    this.addNode({ id: "agent_payments_bot", label: "Payments Lead Bot", type: "agent", tenantId: "tenant_fintech_01", sensitivity: "internal" });
    this.addNode({ id: "agent_analytics_bot", label: "Bio Analyzer Bot", type: "agent", tenantId: "tenant_health_02", sensitivity: "internal" });

    // Tools
    this.addNode({ id: "tool_gh_merge", label: "GitHub Merge Tool", type: "tool", tenantId: "tenant_fintech_01", sensitivity: "restricted" });
    this.addNode({ id: "tool_db_query", label: "Postgres Read Tool", type: "tool", tenantId: "tenant_fintech_01", sensitivity: "internal" });

    // Credentials
    this.addNode({ id: "cred_gh_fintech", label: "Ephemeral GitHub Lease", type: "credential", tenantId: "tenant_fintech_01", sensitivity: "restricted" });
    this.addNode({ id: "cred_tainted_shared", label: "Misconfigured Shared API Key", type: "credential", tenantId: "tenant_fintech_01", sensitivity: "restricted" });

    // Edges
    this.addEdge({ sourceId: "ws_payments", targetId: "tenant_fintech_01", relation: "member_of" });
    this.addEdge({ sourceId: "ws_analytics", targetId: "tenant_health_02", relation: "member_of" });

    this.addEdge({ sourceId: "agent_payments_bot", targetId: "ws_payments", relation: "member_of" });
    this.addEdge({ sourceId: "agent_analytics_bot", targetId: "ws_analytics", relation: "member_of" });

    this.addEdge({ sourceId: "agent_payments_bot", targetId: "repo_ledger", relation: "can_write" });
    this.addEdge({ sourceId: "agent_payments_bot", targetId: "tool_gh_merge", relation: "can_use" });

    this.addEdge({ sourceId: "agent_payments_bot", targetId: "cred_gh_fintech", relation: "can_use" });

    // Anomaly 1: Cross-tenant credential sharing
    this.addEdge({ sourceId: "agent_payments_bot", targetId: "cred_tainted_shared", relation: "can_use" });
    this.addEdge({ sourceId: "agent_analytics_bot", targetId: "cred_tainted_shared", relation: "can_use" }); // Breach!
  }

  public addNode(node: RiskNode) {
    this.nodes.set(node.id, node);
  }

  public addEdge(edge: RiskEdge) {
    this.edges.push(edge);
  }

  /**
   * Scans risk topology for compliance anomalies
   */
  public analyzeAnomalies(): RiskAnomaly[] {
    const anomalies: RiskAnomaly[] = [];

    // Check 1: Cross-Tenant Credential Usage
    const credUsersMap = new Map<string, Set<string>>(); // credId -> Set of tenantIds
    for (const edge of this.edges) {
      if (edge.relation === "can_use") {
        const targetNode = this.nodes.get(edge.targetId);
        const sourceNode = this.nodes.get(edge.sourceId);
        if (targetNode?.type === "credential" && sourceNode) {
          if (!credUsersMap.has(targetNode.id)) {
            credUsersMap.set(targetNode.id, new Set());
          }
          credUsersMap.get(targetNode.id)!.add(sourceNode.tenantId);
        }
      }
    }

    for (const [credId, tenantSet] of credUsersMap.entries()) {
      if (tenantSet.size > 1) {
        anomalies.push({
          anomalyType: "CROSS_TENANT_CREDENTIAL",
          severity: "critical",
          description: `Credential '${credId}' is mapped across ${tenantSet.size} different tenants (${Array.from(tenantSet).join(", ")}). Direct violation of Tenant Isolation Boundary.`,
          involvedNodes: [credId],
        });
      }
    }

    return anomalies;
  }

  /**
   * Computes the blast radius (all directly and indirectly reachable nodes) of a target
   */
  public computeBlastRadius(startNodeId: string): string[] {
    const visited = new Set<string>();
    const queue = [startNodeId];
    visited.add(startNodeId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      // Find all adjacent nodes
      const outgoing = this.edges.filter((e) => e.sourceId === current || e.targetId === current);
      for (const edge of outgoing) {
        const neighbor = edge.sourceId === current ? edge.targetId : edge.sourceId;
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    return Array.from(visited);
  }

  public getGraphData(): { nodes: RiskNode[]; edges: RiskEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
    };
  }
}

export const enterpriseRiskGraph = new EnterpriseRiskGraph();
