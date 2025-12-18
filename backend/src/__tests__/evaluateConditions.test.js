import { jest } from '@jest/globals';
import {
  createMockRule,
  createMockAdPerformance,
  createMockCampaign,
  createMockAdSet,
  createMockAd,
  createCondition,
} from './helpers/mockData.js';

// Mock Mongoose models before importing the service
const mockAdPerformanceFind = jest.fn();
const mockAdsCampaignFind = jest.fn();
const mockAdsSetFind = jest.fn();
const mockAdsFind = jest.fn();

// Create mock modules
jest.unstable_mockModule('../models/ads/adPerformance.model.js', () => ({
  default: {
    find: mockAdPerformanceFind,
  },
}));

jest.unstable_mockModule('../models/ads/adsCampaign.model.js', () => ({
  default: {
    find: mockAdsCampaignFind,
  },
}));

jest.unstable_mockModule('../models/ads/adsSet.model.js', () => ({
  default: {
    find: mockAdsSetFind,
  },
}));

jest.unstable_mockModule('../models/ads/ads.model.js', () => ({
  default: {
    find: mockAdsFind,
  },
}));

// Import the function after mocking
const { evaluateConditions } = await import('../services/auto/autoRuleService.js');

describe('evaluateConditions', () => {
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  /**
   * evlC001: No conditions (default)
   * Expected: true (no conditions = always TRUE)
   */
  test('evlC001: should return true when no conditions are provided', async () => {
    const rule = createMockRule({
      conditions: [],
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Rule không có conditions')
    );
  });

  /**
   * evlC002: Missing external_account_id
   * Expected: false + log "No external_account_id"
   */
  test('evlC002: should return false when external_account_id is missing', async () => {
    const rule = createMockRule({
      external_account_id: null,
      conditions: [createCondition()],
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Không có external_account_id')
    );
  });

  /**
   * evlC003: No AdPerformance data
   * Expected: false + log "No AdPerformance data"
   */
  test('evlC003: should return false when AdPerformance data is empty', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [createCondition()],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    // Mock campaigns returning data
    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    // Mock AdPerformance returning empty array
    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Không có dữ liệu AdPerformance')
    );
  });

  /**
   * evlC004: GREATER_THAN met
   * Condition: spend > 100, actual spend = 150
   * Expected: true + log "MATCH"
   */
  test('evlC004: should return true when GREATER_THAN condition is met', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 100,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            spend: 150,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('THỎA MÃN')
    );
  });

  /**
   * evlC005: LESS_THAN met
   * Condition: cpm < 50, actual cpm = 30
   * Expected: true + log "MATCH"
   */
  test('evlC005: should return true when LESS_THAN condition is met', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'cpm',
          operator: 'LESS_THAN',
          value: 50,
        }),
      ],
      apply_to_ids: {
        adset_ids: ['507f1f77bcf86cd799439015'],
      },
    });

    mockAdsSetFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockAdSet()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            cpm: 30,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('THỎA MÃN')
    );
  });

  /**
   * evlC006: EQUAL_TO met (with tolerance)
   * Condition: frequency ≈ 2.5, actual frequency = 2.51
   * Expected: true (within tolerance 0.01)
   */
  test('evlC006: should return true when EQUAL_TO condition is met within tolerance', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'frequency',
          operator: 'EQUAL_TO',
          value: 2.5,
        }),
      ],
      apply_to_ids: {
        ad_ids: ['507f1f77bcf86cd799439016'],
      },
    });

    mockAdsFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockAd()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            frequency: 2.51,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
  });

  /**
   * evlC007: Condition not met
   * Condition: spend > 200, actual spend = 100
   * Expected: false + log "NO MATCH"
   */
  test('evlC007: should return false when condition is not met', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 200,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            spend: 100,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(false);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('KHÔNG thỏa mãn')
    );
  });

  /**
   * evlC008: Multiple OR (1 met)
   * Conditions: [spend > 100, cpm < 20], actual: spend = 150, cpm = 50
   * Expected: true (OR: 1/2 met)
   */
  test('evlC008: should return true when one of multiple OR conditions is met', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 100,
        }),
        createCondition({
          metric: 'cpm',
          operator: 'LESS_THAN',
          value: 20,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            spend: 150,
            cpm: 50,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
  });

  /**
   * evlC009: Multiple OR (0 met)
   * Conditions: [spend > 100, cpm < 20], actual: spend = 50, cpm = 50
   * Expected: false (OR: 0/2 met)
   */
  test('evlC009: should return false when none of multiple OR conditions are met', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
       createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 100,
        }),
        createCondition({
          metric: 'cpm',
          operator: 'LESS_THAN',
          value: 20,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            spend: 50,
            cpm: 50,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(false);
  });

  /**
   * evlC010: Unknown metric
   * Condition: invalid_metric > 10
   * Expected: false + log "Unknown metric"
   */
  test('evlC010: should skip condition with unknown metric and return false', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'invalid_metric',
          operator: 'GREATER_THAN',
          value: 10,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(false);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown metric')
    );
  });

  /**
   * evlC011: Null actual value
   * Condition: spend > 10, actual spend = null
   * Expected: false + log "Null value"
   */
  test('evlC011: should return false when actual value is null', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 10,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            spend: null,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(false);
  });

  /**
   * evlC012: Account ID with prefix
   * Rule external_account_id = "act_123", AdPerformance has "123"
   * Expected: true (normalized match)
   */
  test('evlC012: should normalize account ID with act_ prefix', async () => {
    const rule = createMockRule({
      external_account_id: 'act_123',
      conditions: [
        createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 100,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([createMockCampaign()]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123', // No prefix in DB
            spend: 150,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
  });

  /**
   * evlC013: Campaign filter
   * apply_to_ids.campaign_ids resolves to external_campaign_id
   * Expected: true (match found)
   */
  test('evlC013: should match by campaign external_id', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'spend',
          operator: 'GREATER_THAN',
          value: 100,
        }),
      ],
      apply_to_ids: {
        campaign_ids: ['507f1f77bcf86cd799439014'],
      },
    });

    mockAdsCampaignFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockCampaign({
            external_id: 'camp_123',
          }),
        ]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            external_campaign_id: 'camp_123',
            spend: 150,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
  });

  /**
   * evlC014: Adset filter
   * apply_to_ids.adset_ids resolves to external_adset_id
   * Expected: true (match found)
   */
  test('evlC014: should match by adset external_id', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'cpm',
          operator: 'LESS_THAN',
          value: 50,
        }),
      ],
      apply_to_ids: {
        adset_ids: ['507f1f77bcf86cd799439015'],
      },
    });

    mockAdsSetFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdSet({
            external_id: 'adset_456',
          }),
        ]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            external_adset_id: 'adset_456',
            cpm: 30,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
  });

  /**
   * evlC015: Ad filter
   * apply_to_ids.ad_ids resolves to external_ad_id
   * Expected: true (match found)
   */
  test('evlC015: should match by ad external_id', async () => {
    const rule = createMockRule({
      external_account_id: '123',
      conditions: [
        createCondition({
          metric: 'frequency',
          operator: 'EQUAL_TO',
          value: 2.5,
        }),
      ],
      apply_to_ids: {
        ad_ids: ['507f1f77bcf86cd799439016'],
      },
    });

    mockAdsFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAd({
            external_id: 'ad_789',
          }),
        ]),
      }),
    });

    mockAdPerformanceFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          createMockAdPerformance({
            external_account_id: '123',
            external_ad_id: 'ad_789',
            frequency: 2.51,
          }),
        ]),
      }),
    });

    const result = await evaluateConditions(rule);

    expect(result).toBe(true);
  });
});
