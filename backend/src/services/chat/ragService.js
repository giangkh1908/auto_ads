import { OpenAIEmbeddings } from "@langchain/openai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import PromptEmbedding from "../../models/ai/promptEmbedding.model.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const promptsData = JSON.parse(
  readFileSync(join(__dirname, "../../data/prompts.json"), "utf-8")
);

const VECTOR_SEARCH_INDEX =
  process.env.MONGO_PROMPT_EMBEDDING_INDEX || "prompt_embedding_vector_index";

let embeddingsModel = null;
let isInitialized = false;

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function initializeEmbeddings() {
  if (isInitialized && embeddingsModel) {
    return { embeddingsModel };
  }

  embeddingsModel = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    modelName: "text-embedding-3-small",
  });

  isInitialized = true;

  return { embeddingsModel };
}

async function loadOrCreateEmbeddings() {
  const { embeddingsModel } = await initializeEmbeddings();

  const allExamples = [
    ...promptsData.PERF.map((ex) => ({ example: ex, module_type: "PERF" })),
    ...promptsData.COMPARE.map((ex) => ({
      example: ex,
      module_type: "COMPARE",
    })),
    ...promptsData.TREND.map((ex) => ({ example: ex, module_type: "TREND" })),
    ...promptsData.AUDIENCE.map((ex) => ({
      example: ex,
      module_type: "AUDIENCE",
    })),
  ];

  const existingEmbeddings = await PromptEmbedding.find({
    example: { $in: allExamples.map((e) => e.example) },
  }).lean();

  const existingExamples = new Set(
    existingEmbeddings.map((e) => e.example)
  );

  const examplesToEmbed = allExamples.filter(
    (e) => !existingExamples.has(e.example)
  );

  if (examplesToEmbed.length > 0) {
    console.log(
      `[RAG Service] 📝 Creating embeddings for ${examplesToEmbed.length} new examples...`
    );

    const textsToEmbed = examplesToEmbed.map((e) => e.example);
    const newEmbeddings = await embeddingsModel.embedDocuments(textsToEmbed);

    const documentsToSave = examplesToEmbed.map((item, index) => ({
      example: item.example,
      module_type: item.module_type,
      embedding: newEmbeddings[index],
      metadata: {
        index: allExamples.findIndex((e) => e.example === item.example),
      },
    }));

    await PromptEmbedding.insertMany(documentsToSave);
    console.log(
      `[RAG Service] ✅ Saved ${documentsToSave.length} new embeddings to MongoDB`
    );
  }

  const allEmbeddings = await PromptEmbedding.find({}).lean();

  console.log(
    `[RAG Service] ✅ Loaded ${allEmbeddings.length} embeddings from MongoDB`
  );

  return {
    embeddingsModel,
    exampleEmbeddings: allEmbeddings.map((e) => ({
      example: e.example,
      embedding: e.embedding,
      module_type: e.module_type,
      metadata: e.metadata,
    })),
  };
}

export async function syncPromptEmbeddings() {
  try {
    await loadOrCreateEmbeddings();
    console.log("[RAG Service] ✅ Prompt embeddings synced");
  } catch (error) {
    console.error("[RAG Service] Error syncing prompt embeddings:", error);
  }
}

export async function retrieveSimilarExamples(userQuery, k = 5) {
  try {
    const { embeddingsModel } = await loadOrCreateEmbeddings();

    const queryEmbedding = await embeddingsModel.embedQuery(userQuery);

    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_SEARCH_INDEX,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: Math.max(50, k * 10),
          limit: k,
        },
      },
      {
        $project: {
          _id: 0,
          example: 1,
          module_type: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await PromptEmbedding.aggregate(pipeline).exec();

    return results.map((doc) => ({
      example: doc.example,
      module_type: doc.module_type,
      metadata: doc.metadata,
      score: doc.score,
    }));
  } catch (error) {
    console.error("[RAG Service] Error retrieving similar examples:", error);
    return [];
  }
}

export async function retrieveSimilarExamplesByModule(
  userQuery,
  moduleType,
  k = 5
) {
  try {
    const { embeddingsModel } = await loadOrCreateEmbeddings();

    const queryEmbedding = await embeddingsModel.embedQuery(userQuery);

    const pipeline = [
      {
        $vectorSearch: {
          index: VECTOR_SEARCH_INDEX,
          path: "embedding",
          queryVector: queryEmbedding,
          numCandidates: Math.max(50, k * 10),
          limit: k,
          filter: {
            module_type: moduleType,
          },
        },
      },
      {
        $project: {
          _id: 0,
          example: 1,
          module_type: 1,
          metadata: 1,
          score: { $meta: "vectorSearchScore" },
        },
      },
    ];

    const results = await PromptEmbedding.aggregate(pipeline).exec();

    return results.map((doc) => ({
      example: doc.example,
      module_type: doc.module_type,
      metadata: doc.metadata,
      score: doc.score,
    }));
  } catch (error) {
    console.error(
      "[RAG Service] Error retrieving similar examples by module:",
      error
    );
    return [];
  }
}

export function getAllExamples() {
  return [
    ...promptsData.PERF,
    ...promptsData.COMPARE,
    ...promptsData.TREND,
    ...promptsData.AUDIENCE,
  ];
}

export function getExamplesByModule(moduleType) {
  return promptsData[moduleType] || [];
}

export function getModuleStructure() {
  return {
    PERF: promptsData.PERF,
    COMPARE: promptsData.COMPARE,
    TREND: promptsData.TREND,
    AUDIENCE: promptsData.AUDIENCE,
  };
}

