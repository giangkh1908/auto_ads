import { contextManager } from "./contextManager.js";
import { intentClassifier } from "./intentClassifier.js";
import { analyticsTools } from "./analyticsTools.js";
import { ChatOpenAI } from "@langchain/openai";
import AdsCampaign from "../../models/ads/adsCampaign.model.js";
import AdsSet from "../../models/ads/adsSet.model.js";
import Ads from "../../models/ads/ads.model.js";

// ============================================
// HELPER: Simple Entity Resolution
// ============================================
const removeDiacritics = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";

async function simpleEntityResolution(accountId, entityName, type) {
  let Model = AdsCampaign;
  if (type === 'adset') Model = AdsSet;
  if (type === 'ad') Model = Ads;

  const entity = await Model.findOne({
    external_account_id: accountId.replace('act_', ''),
    name: { $regex: new RegExp(entityName, 'i') }
  }).select('external_id name');

  return entity ? { id: entity.external_id, name: entity.name } : null;
}

// ============================================
// AGENT EXECUTOR - SIMPLIFIED VERSION
// ============================================
export class AgentExecutor {
  constructor() {
    this.llm = new ChatOpenAI({ 
      modelName: "gpt-4o", 
      temperature: 0.3,
      timeout: 30000,
      maxRetries: 1,
    });
  }

  _extractRankFromResult(toolResult, rankPosition) {
    if (!rankPosition || !toolResult || !toolResult.top || !Array.isArray(toolResult.top)) {
      return toolResult;
    }

    const requestedItem = toolResult.top[rankPosition - 1];
    if (requestedItem) {
      return {
        ...toolResult,
        top: [requestedItem],
        requested_rank: rankPosition,
        total_in_list: toolResult.top.length,
        cache_used: toolResult.cache_used || false
      };
    } else {
      return {
        ...toolResult,
        top: [],
        requested_rank: rankPosition,
        total_in_list: toolResult.top.length,
        cache_used: toolResult.cache_used || false,
        error: `Không có item thứ ${rankPosition} trong kết quả (chỉ có ${toolResult.top.length} items)`
      };
    }
  }

  async _executeTool(intent, toolName, params, tool, rankPosition = null) {
    console.log(`[AgentExecutor] Executing tool ${toolName}...`);
    
    try {
      const rawResult = await tool.invoke(params);
      const toolResult = JSON.parse(rawResult);
      
      if (rankPosition) {
        return this._extractRankFromResult(toolResult, rankPosition);
      }
      
      return { ...toolResult, cache_used: false };
    } catch (e) {
      console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
      throw e;
    }
  }

  // ============================================
  // DIRECT HTML FORMATTERS (BYPASS LLM)
  // ============================================

  _formatDate(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  }

  _formatNumber(value) {
    if (!value && value !== 0) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  _formatRankingResponse(toolResult, plan) {
    if (!toolResult || toolResult.error) {
      return `<p>⚠️ ${toolResult?.error || 'Không thể lấy dữ liệu'}: ${toolResult?.message || ''}</p>`;
    }

    const level = toolResult.level || plan.level || 'campaign';
    const levelLabels = {
      campaign: 'Tên chiến dịch',
      adset: 'Tên nhóm quảng cáo',
      ad: 'Tên quảng cáo'
    };

    const sortMetric = toolResult.sort_by_metric || (plan.metrics && plan.metrics[0]);
    const metricLabel = sortMetric && sortMetric !== 'spend' ? 'Chỉ số chính' : 'Chi phí';

    let html = '';

    // Date range
    if (toolResult.date_range_effective) {
      html += `<p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Từ ngày ${this._formatDate(toolResult.date_range_effective.from)} đến ${this._formatDate(toolResult.date_range_effective.to)}</p>\n`;
    }

    // Note if sorted by specific metric
    if (sortMetric && sortMetric !== 'spend') {
      const metricNames = {
        ctr: 'CTR',
        cpc: 'CPC',
        cpm: 'CPM',
        cpa: 'CPA',
        cpl: 'CPL'
      };
      html += `<p style="font-size: 13px; color: #059669; margin-bottom: 12px;">⚡ Xếp hạng theo: ${metricNames[sortMetric] || sortMetric.toUpperCase()} (Chi phí chỉ để tham khảo)</p>\n`;
    }

    // Get data to display - handle both "top" array and "groups" object
    let items = [];
    let hasGroups = false;
    
    if (toolResult.groups && typeof toolResult.groups === 'object') {
      // When grouped by objectives (objective=null in request)
      hasGroups = true;
      // Flatten all groups into one array
      items = Object.values(toolResult.groups).flat();
    } else if (toolResult.top && Array.isArray(toolResult.top)) {
      // When filtering by specific objective
      items = toolResult.top;
    }
    
    if (items.length === 0) {
      html += '<p>Không có dữ liệu trong khoảng thời gian này.</p>';
      return html;
    }

    // If has groups, display by objective sections
    if (hasGroups && toolResult.groups) {
      const objectiveLabels = {
        OUTCOME_SALES: '🛒 Doanh số',
        OUTCOME_LEADS: '📋 Khách hàng tiềm năng',
        OUTCOME_TRAFFIC: '🔗 Lưu lượng truy cập',
        OUTCOME_AWARENESS: '👁️ Mức độ nhận biết',
        OUTCOME_ENGAGEMENT: '💬 Tương tác',
        OUTCOME_APP_PROMOTION: '📱 Quảng bá ứng dụng'
      };

      for (const [objective, groupItems] of Object.entries(toolResult.groups)) {
        if (!groupItems || groupItems.length === 0) continue;

        const objLabel = objectiveLabels[objective] || objective;
        // Get primary metric label from first item
        const primaryMetricLabel = groupItems[0]?.primary_metric?.label || 'Chỉ số chính';
        
        html += `<h3 style="font-size: 16px; font-weight: 600; color: #1f2937; margin: 20px 0 12px 0;">${objLabel}</h3>\n`;

        html += `<table style="width: 100%; border-collapse: collapse; margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;
        html += `  <thead>\n`;
        html += `    <tr style="background-color: #667eea; color: white;">\n`;
        html += `      <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px; border: none;">${levelLabels[level]}</th>\n`;
        html += `      <th style="padding: 12px 16px; text-align: right; font-weight: 600; font-size: 14px; border: none;">${primaryMetricLabel}</th>\n`;
        html += `      <th style="padding: 12px 16px; text-align: right; font-weight: 600; font-size: 14px; border: none;">Chi phí</th>\n`;
        html += `    </tr>\n`;
        html += `  </thead>\n`;
        html += `  <tbody>\n`;

        groupItems.forEach((item, idx) => {
          const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
          const primaryValue = item.primary_metric?.formatted || this._formatNumber(item.primary_metric?.value || 0);
          const spendValue = item.spend?.formatted || '0₫';

          html += `    <tr style="border-bottom: 1px solid #e5e7eb; background-color: ${bgColor};">\n`;
          html += `      <td style="padding: 14px 16px; font-weight: 500; color: #1f2937;">${item.entity_name || item.name || 'N/A'}</td>\n`;
          html += `      <td style="padding: 14px 16px; text-align: right; color: #059669; font-weight: 600; font-size: 15px;">${primaryValue}</td>\n`;
          html += `      <td style="padding: 14px 16px; text-align: right; color: #6b7280; font-weight: 500;">${spendValue}</td>\n`;
          html += `    </tr>\n`;
        });

        html += `  </tbody>\n`;
        html += `</table>\n`;
      }
    } else {
      // Single table (when objective was specified)
      const primaryMetricLabel = items[0]?.primary_metric?.label || metricLabel;
      
      html += `<table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">\n`;
      html += `  <thead>\n`;
      html += `    <tr style="background-color: #667eea; color: white;">\n`;
      html += `      <th style="padding: 12px 16px; text-align: left; font-weight: 600; font-size: 14px; border: none;">${levelLabels[level]}</th>\n`;
      html += `      <th style="padding: 12px 16px; text-align: right; font-weight: 600; font-size: 14px; border: none;">${primaryMetricLabel}</th>\n`;
      html += `      <th style="padding: 12px 16px; text-align: right; font-weight: 600; font-size: 14px; border: none;">Chi phí</th>\n`;
      html += `    </tr>\n`;
      html += `  </thead>\n`;
      html += `  <tbody>\n`;

      items.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        const primaryValue = item.primary_metric?.formatted || this._formatNumber(item.primary_metric?.value || 0);
        const spendValue = item.spend?.formatted || '0₫';

        html += `    <tr style="border-bottom: 1px solid #e5e7eb; background-color: ${bgColor};">\n`;
        html += `      <td style="padding: 14px 16px; font-weight: 500; color: #1f2937;">${item.entity_name || item.name || 'N/A'}</td>\n`;
        html += `      <td style="padding: 14px 16px; text-align: right; color: #059669; font-weight: 600; font-size: 15px;">${primaryValue}</td>\n`;
        html += `      <td style="padding: 14px 16px; text-align: right; color: #6b7280; font-weight: 500;">${spendValue}</td>\n`;
        html += `    </tr>\n`;
      });

      html += `  </tbody>\n`;
      html += `</table>\n`;
    }

    return html;
  }

  _formatQueryDataResponse(toolResult, plan) {
    if (!toolResult || toolResult.error) {
      return `<p>⚠️ ${toolResult?.error || 'Không thể lấy dữ liệu'}: ${toolResult?.message || ''}</p>`;
    }

    const queryType = toolResult.query_type || plan.query_type;

    // COUNT already handled in _generateResponse
    if (queryType === 'count') {
      const entityType = toolResult.entity_type || 'campaign';
      const entityLabels = { campaign: 'chiến dịch', adset: 'nhóm quảng cáo', ad: 'quảng cáo' };
      const count = toolResult.count || 0;
      return `<p>Hiện tại tài khoản này đang có <strong>${count}</strong> ${entityLabels[entityType]}.</p>`;
    }

    // OVERVIEW
    if (queryType === 'overview') {
      const metrics = toolResult.metrics || {};
      let html = '<h4>📊 Tổng quan hiệu suất</h4>\n';
      
      if (toolResult.period) {
        html += `<p style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">Từ ngày ${this._formatDate(toolResult.period.from)} đến ${this._formatDate(toolResult.period.to)}</p>\n`;
      }

      html += '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">\n';
      html += '  <tbody>\n';
      
      const metricRows = [
        { label: 'Chi phí', value: metrics.spend?.formatted || '0₫', color: '#dc2626' },
        { label: 'Lượt hiển thị', value: metrics.impressions?.formatted || '0', color: '#3b82f6' },
        { label: 'Lượt nhấp', value: metrics.clicks?.formatted || '0', color: '#059669' },
        { label: 'CTR', value: metrics.ctr?.formatted || '0%', color: '#8b5cf6' },
        { label: 'CPC', value: metrics.cpc?.formatted || '0₫', color: '#f59e0b' },
        { label: 'Kết quả', value: metrics.results?.formatted || '0', color: '#10b981' },
      ];

      metricRows.forEach(row => {
        html += `    <tr style="border-bottom: 1px solid #e5e7eb;">\n`;
        html += `      <td style="padding: 12px 16px; font-weight: 500; color: #374151;">${row.label}</td>\n`;
        html += `      <td style="padding: 12px 16px; text-align: right; color: ${row.color}; font-weight: 600; font-size: 16px;">${row.value}</td>\n`;
        html += `    </tr>\n`;
      });

      html += '  </tbody>\n';
      html += '</table>';
      return html;
    }

    // LIST
    if (queryType === 'list') {
      const entities = toolResult.entities || [];
      const entityType = toolResult.entity_type || 'campaign';
      const entityLabels = { campaign: 'Chiến dịch', adset: 'Nhóm quảng cáo', ad: 'Quảng cáo' };

      if (entities.length === 0) {
        return `<p>Không tìm thấy ${entityLabels[entityType].toLowerCase()} nào.</p>`;
      }

      let html = `<h4>📋 Danh sách ${entityLabels[entityType]}</h4>\n`;
      html += '<ul style="list-style: none; padding: 0; margin: 12px 0;">\n';

      entities.forEach(entity => {
        const statusColors = {
          ACTIVE: '#10b981',
          PAUSED: '#f59e0b',
          ARCHIVED: '#6b7280'
        };
        const statusColor = statusColors[entity.status] || '#6b7280';

        html += `  <li style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">\n`;
        html += `    <span style="font-weight: 500; color: #1f2937;">${entity.name}</span>\n`;
        html += `    <span style="margin-left: 12px; padding: 4px 8px; border-radius: 4px; font-size: 12px; background-color: ${statusColor}20; color: ${statusColor};">${entity.status}</span>\n`;
        html += `  </li>\n`;
      });

      html += '</ul>';
      return html;
    }

    // TOP_BOTTOM
    if (queryType === 'top_bottom') {
      const results = toolResult.results || [];
      const metric = toolResult.metric || 'spend';
      const entityType = toolResult.entity_type || 'campaign';
      const entityLabels = { campaign: 'Chiến dịch', adset: 'Nhóm quảng cáo', ad: 'Quảng cáo' };
      const metricLabels = {
        spend: 'Chi phí',
        ctr: 'CTR',
        cpc: 'CPC',
        clicks: 'Lượt nhấp'
      };

      if (results.length === 0) {
        return '<p>Không có dữ liệu để hiển thị.</p>';
      }

      let html = `<h4>🏆 Top ${entityLabels[entityType]} theo ${metricLabels[metric] || metric}</h4>\n`;
      html += '<table style="width: 100%; border-collapse: collapse; margin: 16px 0;">\n';
      html += '  <tbody>\n';

      results.forEach((item, idx) => {
        const bgColor = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
        const metricValue = item[metric]?.formatted || item[metric]?.value || '-';

        html += `    <tr style="border-bottom: 1px solid #e5e7eb; background-color: ${bgColor};">\n`;
        html += `      <td style="padding: 12px 16px; font-weight: 500; color: #1f2937;">${idx + 1}. ${item.name}</td>\n`;
        html += `      <td style="padding: 12px 16px; text-align: right; color: #059669; font-weight: 600;">${metricValue}</td>\n`;
        html += `    </tr>\n`;
      });

      html += '  </tbody>\n';
      html += '</table>';
      return html;
    }

    return '<p>Không thể hiển thị dữ liệu.</p>';
  }

  async processMessage(userId, accountId, message, conversationHistory = [], frontendContext = null) {
    try {
      // 1. Build Context
      let context;
      try {
        context = await contextManager.build(accountId, userId);
      } catch (contextError) {
        console.error("[AgentExecutor] Context build error:", contextError);
        context = { account: { id: accountId, name: "Unknown" }, error: contextError.message };
      }

      // 2. Classify Intent
      let plan;
      try {
        plan = await intentClassifier.classify(message, context, conversationHistory);
        console.log("[AgentExecutor] Plan:", JSON.stringify(plan, null, 2));
      } catch (classifyError) {
        console.error("[AgentExecutor] Intent classification error:", classifyError);
        plan = {
          intent: "GENERAL_CHAT",
          query_type: null,
          entities: [],
          time_range: null,
          metrics: [],
          rank_position: null,
          reasoning: "Classification failed"
        };
      }

      // 2.5. Merge context entities if user uses reference words
      if (frontendContext?.entities && frontendContext.entities.length > 0) {
        const hasReference = /\b(này|đó|nó|it|this|that)\b/i.test(message);
        
        if (hasReference) {
          // Override plan entities with context (even if plan has entities)
          // Because LLM might extract wrong entity type from reference
          plan.entities = frontendContext.entities;
          console.log("[AgentExecutor] Merged context entities (override):", plan.entities);
        } else if (!plan.entities || plan.entities.length === 0) {
          // No reference word, but plan has no entities
          // Check if message mentions entity type keywords
          const hasEntityKeyword = /\b(chiến dịch|campaign|adset|nhóm quảng cáo|quảng cáo|ads?)\b/i.test(message);
          if (hasEntityKeyword) {
            plan.entities = frontendContext.entities;
            console.log("[AgentExecutor] Merged context entities (no entities in plan):", plan.entities);
          }
        }
      }
      
      console.log("[AgentExecutor] Final plan.entities:", plan.entities);

      // 3. Execute Tool based on Intent
      let toolResult = null;
      let toolName = null;

      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // ============================================
      // INTENT: RANK_CAMPAIGNS / RANK_ADSETS / RANK_ADS
      // ============================================
      if (plan.intent === "RANK_CAMPAIGNS" || plan.intent === "RANK_ADSETS" || plan.intent === "RANK_ADS") {
        toolName = "rank_campaigns";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          let defaultLevel = "campaign";
          if (plan.intent === "RANK_ADSETS") defaultLevel = "adset";
          else if (plan.intent === "RANK_ADS") defaultLevel = "ad";
          
          const baseTopN = 5;
          const topN = plan.rank_position 
            ? Math.max(baseTopN, plan.rank_position) 
            : baseTopN;
          
          const params = {
            account_id: accountId,
            level: plan.level || defaultLevel,
            objective: plan.objective || null,
            date_from: plan.time_range?.from || thirtyDaysAgo,
            date_to: plan.time_range?.to || today,
            top_n: topN,
            sort_by_metric: plan.metrics && plan.metrics.length > 0 ? plan.metrics[0] : null,
          };
          
          try {
            toolResult = await this._executeTool(plan.intent, toolName, params, tool, plan.rank_position);
          } catch (e) {
            console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
            toolResult = { error: "Failed to rank campaigns/adsets/ads", message: e.message };
          }

          // Fallback: nếu rank không có dữ liệu với cửa sổ hiện tại (thường là 7 ngày),
          // thử mở rộng ra 30 ngày để tăng cơ hội có dữ liệu.
          const isRankIntent = plan.intent === "RANK_CAMPAIGNS" || plan.intent === "RANK_ADSETS" || plan.intent === "RANK_ADS";
          const noData =
            toolResult &&
            !toolResult.error &&
            (
              (Array.isArray(toolResult.top) && toolResult.top.length === 0) ||
              (!toolResult.top && toolResult.groups && Object.keys(toolResult.groups).length === 0)
            );
          
          const isShortRange =
            (plan.time_range?.preset === "last_7_days") ||
            (
              plan.time_range?.from && plan.time_range?.to &&
              (new Date(plan.time_range.to) - new Date(plan.time_range.from) <= 10 * 24 * 60 * 60 * 1000)
            );

          if (isRankIntent && noData && isShortRange) {
            const fallbackParams = {
              ...params,
              date_from: thirtyDaysAgo,
              date_to: today
            };
            try {
              const fallbackResult = await this._executeTool(plan.intent, toolName, fallbackParams, tool, plan.rank_position);
              const hasFallbackData =
                (Array.isArray(fallbackResult?.top) && fallbackResult.top.length > 0) ||
                (fallbackResult?.groups && Object.keys(fallbackResult.groups).length > 0);
              
              if (hasFallbackData) {
                toolResult = { ...fallbackResult, fallback_to_30d: true };
                plan.time_range = { preset: "last_30_days", from: thirtyDaysAgo, to: today };
              }
            } catch (e) {
              console.error(`[AgentExecutor] Fallback rank 30d failed:`, e);
            }
          }
        }
      }
      
      // ============================================
      // INTENT: GET_ENTITY_METADATA
      // ============================================
      else if (plan.intent === "GET_ENTITY_METADATA") {
        toolName = "get_entity_metadata";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        // Check if entities are available (from plan or context)
        if (!plan.entities || plan.entities.length === 0) {
          // No entity context - provide clarification
          return {
            response: "<p>⚠️ Xin lỗi, tôi không rõ bạn đang hỏi về entity nào. Vui lòng cung cấp tên <strong>campaign/adset/ad</strong> cụ thể.</p><p style=\"margin-top: 12px; color: #6b7280;\">Ví dụ: \"Campaign ABC thuộc về mục tiêu gì?\" hoặc \"Adset XYZ thuộc campaign nào?\"</p>",
            intent: "GENERAL_CHAT",
            tool_used: null,
            data: null,
            suggestions: ["Xem danh sách campaigns", "Top campaigns hiệu quả"],
            entities: []
          };
        }
        
        if (tool) {
          let entityIds = [];
          
          if (plan.entities && plan.entities.length > 0) {
            for (const ent of plan.entities) {
              const res = await simpleEntityResolution(accountId, ent.name, ent.type);
              if (res) entityIds.push(res.id);
            }
          }
          
          if (entityIds.length === 0) {
            toolResult = { 
              error: "Không tìm thấy entity IDs", 
              message: "Vui lòng chỉ định rõ entities cần xem thông tin." 
            };
          } else {
            const params = {
              account_id: accountId,
              entity_type: plan.entities?.[0]?.type || "ad",
              entity_ids: entityIds,
            };
            
            try {
              toolResult = await this._executeTool(plan.intent, toolName, params, tool);
            } catch (e) {
              console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
              toolResult = { error: "Failed to get metadata", message: e.message };
            }
          }
        }
      }
      
      // ============================================
      // INTENT: QUERY_DATA
      // ============================================
      else if (plan.intent === "QUERY_DATA") {
        toolName = "query_data";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          const params = {
            account_id: accountId,
            query_type: plan.query_type || "overview",
            date_from: plan.time_range?.from || thirtyDaysAgo,
            date_to: plan.time_range?.to || today,
          };
          
          // Add entity info if present
          if (plan.entities && plan.entities.length > 0) {
            // Pass entity names directly to tool - let tool handle resolution
            const entityNames = plan.entities.map(e => e.name).filter(Boolean);
            if (entityNames.length > 0) {
              params.entity_ids = entityNames; // Tool will resolve names → IDs
              params.entity_type = plan.entities[0].type;
            } else {
              // No names provided, just type (for count queries)
              params.entity_type = plan.entities[0].type;
            }
          } else if (plan.level) {
            // Fallback: use level if entities not provided
            params.entity_type = plan.level;
          }
          
          // Add metric if present (for top_bottom queries)
          if (plan.metrics && plan.metrics.length > 0) {
            params.metric = plan.metrics[0];
          }
          
          try {
            toolResult = await this._executeTool(plan.intent, toolName, params, tool);
          } catch (e) {
            console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
            toolResult = { error: "Failed to fetch data", message: e.message };
          }
        }
      } 
      
      // ============================================
      // INTENT: ANALYZE_TREND
      // ============================================
      else if (plan.intent === "ANALYZE_TREND") {
        toolName = "get_trend";
        const tool = analyticsTools.find(t => t.name === toolName);
        
        if (tool) {
          const params = {
            account_id: accountId,
            metric: plan.metrics?.[0] || "spend",
            granularity: "day",
            date_from: plan.time_range?.from || thirtyDaysAgo,
            date_to: plan.time_range?.to || today,
          };
          
          // Add entity name directly - getTrendTool will handle resolution
          if (plan.entities && plan.entities.length > 0) {
            const ent = plan.entities[0];
            if (ent.type === "campaign") params.campaign_id = ent.name;
            else if (ent.type === "adset") params.adset_id = ent.name;
            else if (ent.type === "ad") params.ad_id = ent.name;
          }
          
          try {
            toolResult = await this._executeTool(plan.intent, toolName, params, tool);
          } catch (e) {
            console.error(`[AgentExecutor] Tool ${toolName} failed:`, e);
            toolResult = { error: "Failed to fetch data", message: e.message };
          }
        }
      }
      
      // ============================================
      // INTENT: GENERAL_CHAT
      // ============================================
      else if (plan.intent === "GENERAL_CHAT") {
        toolResult = { message: "General conversation - no tool needed" };
      }

      // 4. Generate Response (with streaming support)
      let content;
      try {
        const response = await this._generateResponse(message, plan, toolResult, context, conversationHistory);
        content = response.content;
      } catch (responseError) {
        console.error("[AgentExecutor] Response generation error:", responseError);
        content = "⚠️ Xin lỗi, tôi gặp khó khăn khi tạo câu trả lời. Vui lòng thử lại.";
      }
      
      return {
        response: content,
        intent: plan.intent,
        tool_used: toolName,
        data: toolResult,
        suggestions: [],
        entities: plan.entities || [] // Return entities for frontend tracking
      };

    } catch (error) {
      console.error("[AgentExecutor] Fatal Error:", error);
      return {
        response: "⚠️ Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
        intent: "GENERAL_CHAT",
        error: error.message,
        suggestions: [],
        entities: [] // Return empty entities array on error
      };
    }
  }

  // ============================================
  // RESPONSE GENERATION
  // ============================================
  async _generateResponse(userMessage, plan, toolResult, context, conversationHistory = []) {
    console.log('[AgentExecutor] Generating response with direct formatting (bypassing LLM when possible)...');

    // ============================================
    // FAST PATH: Direct HTML formatting (NO LLM)
    // ============================================

    // 1. RANK_CAMPAIGNS/RANK_ADSETS/RANK_ADS → Direct HTML table
    if ((plan.intent === 'RANK_CAMPAIGNS' || plan.intent === 'RANK_ADSETS' || plan.intent === 'RANK_ADS') && toolResult && !toolResult.error) {
      console.log('[AgentExecutor] Using direct HTML formatting for ranking');
      return { content: this._formatRankingResponse(toolResult, plan) };
    }

    // 2. QUERY_DATA (count, overview, list, top_bottom) → Direct HTML
    if (plan.intent === 'QUERY_DATA' && toolResult && !toolResult.error) {
      console.log('[AgentExecutor] Using direct HTML formatting for query data');
      return { content: this._formatQueryDataResponse(toolResult, plan) };
    }

    // ============================================
    // SLOW PATH: Use LLM (for complex cases)
    // ============================================
    console.log('[AgentExecutor] Using LLM for complex response generation...');

    // Check if user is asking about system features/capabilities
    const lowerMessage = userMessage.toLowerCase();
    const systemFeatureKeywords = [
      'chức năng', 'tính năng', 'features', 'capabilities',
      'hệ thống có gì', 'hệ thống làm gì', 'hệ thống có thể',
      'có những gì', 'làm được gì', 'có gì', 'tính năng nào',
      'chức năng nào', 'có chức năng gì', 'có tính năng gì',
      'hệ thống này', 'nền tảng này', 'ứng dụng này',
      'bạn có thể', 'bạn làm được', 'bạn giúp được gì'
    ];
    const isAskingAboutSystem = systemFeatureKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );

    // If asking about system features, return predefined response
    if (isAskingAboutSystem) {
      const systemFeaturesContent = [
        '<h4>📋 Các chức năng chính của hệ thống:</h4>',
        '<h4>1. 📊 Quản lý Quảng cáo (Ads Management)</h4>',
        '<p>• Quản lý chiến dịch (Campaigns), nhóm quảng cáo (Ad Sets) và quảng cáo (Ads)</p>',
        '<p>• Đồng bộ dữ liệu từ Facebook Marketing API</p>',
        '<p>• Xem và cập nhật thông tin quảng cáo trực tiếp</p>',
        '<p>• Lọc và tìm kiếm theo tên, trạng thái, mục tiêu</p>',
        '<p>• Xem insights chi tiết (spend, impressions, clicks, CTR, CPC, v.v.)</p>',
        '<h4>2. 📈 Phân tích & Báo cáo (Analytics)</h4>',
        '<p>• Phân tích hiệu suất quảng cáo theo thời gian</p>',
        '<p>• Xem dữ liệu insights đã được đồng bộ</p>',
        '<p>• Lọc theo mục tiêu quảng cáo (objective)</p>',
        '<p>• Phân trang và tìm kiếm ads có dữ liệu</p>',
        '<h4>3. ⚡ Tự động hóa (Automation Rules)</h4>',
        '<p>• Tự động bật/tắt quảng cáo dựa trên điều kiện</p>',
        '<p>• Tự động tăng/giảm ngân sách</p>',
        '<p>• Thiết lập quy tắc theo metrics (spend, CTR, CPC, v.v.)</p>',
        '<p>• Chạy theo lịch định kỳ (hàng phút, hàng giờ, hàng ngày)</p>',
        '<h4>4. 🏪 Quản lý Shop & Tài khoản</h4>',
        '<p>• Quản lý nhiều cửa hàng (Shops)</p>',
        '<p>• Quản lý nhân viên và phân quyền</p>',
        '<p>• Kết nối Facebook Pages</p>',
        '<p>• Kết nối Facebook Ad Accounts</p>',
        '<h4>5. 🤖 AI Chat Hỗ trợ</h4>',
        '<p>• Hỏi đáp về dữ liệu quảng cáo bằng tiếng Việt</p>',
        '<p>• Phân tích xu hướng và hiệu suất</p>',
        '<p>• Truy vấn thông tin campaigns, adsets, ads</p>',
        '<p>• Đưa ra insights và khuyến nghị</p>',
        '<h4>6. 🔄 Đồng bộ dữ liệu</h4>',
        '<p>• Đồng bộ tự động entities (campaigns, adsets, ads) từ Facebook</p>',
        '<p>• Đồng bộ insights theo lịch (cron job)</p>',
        '<p>• Cache dữ liệu để tối ưu hiệu suất</p>',
        '<p>• Lazy loading insights khi cần</p>'
      ].join('\n');
      
      return { content: systemFeaturesContent };
    }

    // Check if we have real data (not GENERAL_CHAT)
    const hasRealData = plan.intent !== "GENERAL_CHAT" &&
                       toolResult && 
                       toolResult.message !== "General conversation - no tool needed" &&
                       !toolResult.error;
    
    // Format date range for display - ONLY if we have real data
    let dateRangeText = "";
    if (hasRealData) {
      // Check if toolResult has date_range_effective (from rankCampaignsTool)
      if (toolResult.date_range_effective) {
        const formatDate = (dateStr) => {
          const d = new Date(dateStr);
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        };
        dateRangeText = `từ ${formatDate(toolResult.date_range_effective.from)} đến ${formatDate(toolResult.date_range_effective.to)}`;
      } else if (plan.time_range?.from && plan.time_range?.to) {
        const formatDate = (dateStr) => {
          const d = new Date(dateStr);
          return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        };
        dateRangeText = `từ ${formatDate(plan.time_range.from)} đến ${formatDate(plan.time_range.to)}`;
      }
    }
    
    // Note: conversationHistory is passed to intentClassifier for context,
    // but we don't use it here in response generation anymore.
    
    // Simplified prompt for GENERAL_CHAT, ANALYZE_TREND, GET_ENTITY_METADATA
    const systemPrompt = `
You are a Senior Marketing Consultant for Facebook Ads.
Provide concise, actionable insights in Vietnamese.

CONTEXT:
- Account: ${context.account?.name || "Unknown"}
- User Intent: ${plan.intent}
- Date Range: ${dateRangeText || "N/A"}

DATA:
${JSON.stringify(toolResult, null, 2)}

RULES:
1. Use HTML formatting (no markdown)
2. For ANALYZE_TREND: Show date range, describe trend direction, mention key insights
3. For GET_ENTITY_METADATA: Answer relationship questions clearly (e.g., "Ads X thuộc Adset Y, Campaign Z")
4. For GENERAL_CHAT: Be friendly and helpful
5. Keep responses concise and actionable
6. Use <h4> for headers, <p> for paragraphs, <strong> for emphasis
7. Always respond in Vietnamese

If data is missing, explain politely.
`;

    if (!userMessage || !userMessage.trim()) {
      return { content: "Xin chào! Tôi có thể giúp gì cho bạn về quảng cáo hôm nay?" };
    }

    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ];
      
      const result = await this.llm.invoke(messages);
      let content = result.content?.trim() || "⚠️ Không thể tạo câu trả lời";
      
      // Clean up excessive whitespace
      // Remove multiple consecutive blank lines (more than 1)
      content = content.replace(/\n{3,}/g, '\n\n');
      // Remove trailing spaces from each line
      content = content.split('\n').map(line => line.trimEnd()).join('\n');
      // Remove leading/trailing whitespace
      content = content.trim();
      // Remove blank lines between HTML tags (but keep structure)
      content = content.replace(/>\s*\n\s*</g, '><');
      // Add back single newline between major sections (h4 tags)
      content = content.replace(/<\/h4><h4>/g, '</h4>\n<h4>');
      // Add back single newline between h4 and p
      content = content.replace(/<\/h4><p>/g, '</h4>\n<p>');
      
      return { content };
    } catch (error) {
      console.error("[AgentExecutor] Error generating response:", error);
      return { 
        content: "⚠️ Xin lỗi, tôi đang gặp chút khó khăn khi tạo câu trả lời. Bạn vui lòng thử lại nhé!"
      };
    }
  }
}

export const agentExecutor = new AgentExecutor();
