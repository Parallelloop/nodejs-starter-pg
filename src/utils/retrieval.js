import DB from "../database";
import { Op } from "sequelize";

// Math helper for cosine similarity
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const RRF_K = 60;

/**
 * Step 1: Hybrid Retrieval using Weighted RRF natively in Node.js
 */
export async function hybridSearch(
  query,
  queryEmbedding,
  workspaceId,
  options = {}
) {
  const limit = options.limit || 5;
  const vectorWeight = options.vectorWeight || 1.0;
  const ftsWeight = options.ftsWeight || 1.0;
  const rrfK = options.rrfK || RRF_K;

  const allNodes = await DB.contextNodes.findAll({
    where: { workspaceId },
  });

  if (!allNodes.length) return [];

  // Calculate semantic ranks
  const semanticScores = allNodes.map((node) => ({
    node,
    score: cosineSimilarity(queryEmbedding, node.embedding || []),
  }));
  semanticScores.sort((a, b) => b.score - a.score);
  
  const semanticRanks = new Map();
  semanticScores.forEach((item, index) => {
    semanticRanks.set(item.node.id, index + 1);
  });

  // Calculate naive FTS ranks using simple keyword matching density
  const keywords = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const ftsScores = allNodes.map((node) => {
    let score = 0;
    const text = (node.content || "").toLowerCase();
    keywords.forEach((kw) => {
      const regex = new RegExp(kw, "g");
      const matches = text.match(regex);
      if (matches) score += matches.length;
    });
    return { node, score };
  });

  ftsScores.sort((a, b) => b.score - a.score);
  
  const ftsRanks = new Map();
  ftsScores.forEach((item, index) => {
    ftsRanks.set(item.node.id, index + 1);
  });

  // Combine scores using RRF
  const combined = allNodes.map((node) => {
    const sRank = semanticRanks.get(node.id) || allNodes.length;
    const fRank = ftsRanks.get(node.id) || allNodes.length;
    
    const rankScore = 
      (1.0 / (rrfK + sRank) * vectorWeight) + 
      (1.0 / (rrfK + fRank) * ftsWeight);

    return {
      ...node.toJSON(),
      rankScore
    };
  });

  combined.sort((a, b) => b.rankScore - a.rankScore);
  return combined.slice(0, limit);
}

/**
 * Step 2: Multi-Hop Graph Traversal
 */
export async function getMultiHopNodes(
  seedNodeIds,
  workspaceId,
  maxHops = 2
) {
  let allConnectedNodes = new Map();
  let currentLevelIds = [...seedNodeIds];
  let visitedNodes = new Set(seedNodeIds);

  for (let hop = 0; hop < maxHops; hop++) {
    const data = await DB.relationships.findAll({
      where: {
        workspaceId,
        [Op.or]: [
          { sourceNodeId: { [Op.in]: currentLevelIds } },
          { targetNodeId: { [Op.in]: currentLevelIds } }
        ]
      },
      include: [
        { model: DB.contextNodes, as: 'sourceNode' },
        { model: DB.contextNodes, as: 'targetNode' }
      ]
    });

    if (!data || data.length === 0) break;

    let nextLevelIds = [];

    for (const rel of data) {
      const isSourceCurrent = currentLevelIds.includes(rel.sourceNodeId);
      const oppositeNode = isSourceCurrent ? rel.targetNode : rel.sourceNode;

      // Make sure relation is populated
      if (oppositeNode && !visitedNodes.has(oppositeNode.id)) {
        visitedNodes.add(oppositeNode.id);
        nextLevelIds.push(oppositeNode.id);
        allConnectedNodes.set(oppositeNode.id, {
          node: oppositeNode.toJSON(),
          relationship: rel.relationshipType,
          hop: hop + 1
        });
      }
    }

    if (nextLevelIds.length === 0) break;
    currentLevelIds = nextLevelIds;
  }

  return Array.from(allConnectedNodes.values());
}

/**
 * Enhanced Unified Retrieval Pipeline
 */
export async function performKoreExploration(
  question,
  embedding,
  workspaceId,
  config = {}
) {
  // 1. Semantic + Keyword Search with weighted RRF
  const topNodes = await hybridSearch(question, embedding, workspaceId, {
    limit: 3,
    vectorWeight: config.vectorWeight || 1.2,
    ftsWeight: config.ftsWeight || 0.8
  });
  
  if (topNodes.length === 0) return { seeds: [], connections: [] };

  // 2. Multi-Hop Graph Traversal
  const seedIds = topNodes.map((n) => n.id);
  const relatedLinks = await getMultiHopNodes(
    seedIds, 
    workspaceId, 
    config.maxHops || 2
  );

  return {
    seeds: topNodes,
    connections: relatedLinks
  };
}
