import { jest } from '@jest/globals';

/**
 * Mock data factory for creating test rule objects
 */
export const createMockRule = ({
  name = 'Test Rule',
  external_account_id = '123456',
  conditions = [],
  apply_to_ids = {},
  action = 'TURN_ON',
  schedule = null,
} = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  name,
  external_account_id,
  conditions,
  apply_to_ids,
  action,
  schedule,
  created_by: '507f1f77bcf86cd799439012',
  subscriber_id: '507f1f77bcf86cd799439012',
});

/**
 * Mock data factory for AdPerformance records
 */
export const createMockAdPerformance = ({
  external_account_id = '123456',
  external_campaign_id = 'camp_123',
  external_adset_id = 'adset_456',
  external_ad_id = 'ad_789',
  spend = 100,
  cpm = 20,
  frequency = 2.5,
  link_clicks = 50,
  impressions = 1000,
  date = new Date('2024-12-06'),
  ...otherMetrics
} = {}) => ({
  _id: '507f1f77bcf86cd799439013',
  external_account_id,
  external_campaign_id,
  external_adset_id,
  external_ad_id,
  campaign_id: '507f1f77bcf86cd799439014',
  set_id: '507f1f77bcf86cd799439015',
  ads_id: '507f1f77bcf86cd799439016',
  spend,
  cpm,
  frequency,
  link_clicks,
  impressions,
  date,
  created_at: new Date('2024-12-06T10:00:00Z'),
  ...otherMetrics,
});

/**
 * Mock data factory for Campaign entities
 */
export const createMockCampaign = ({
  _id = '507f1f77bcf86cd799439014',
  external_id = 'camp_123',
  name = 'Test Campaign',
} = {}) => ({
  _id,
  external_id,
  name,
  deleted_at: null,
});

/**
 * Mock data factory for AdSet entities
 */
export const createMockAdSet = ({
  _id = '507f1f77bcf86cd799439015',
  external_id = 'adset_456',
  name = 'Test AdSet',
} = {}) => ({
  _id,
  external_id,
  name,
  deleted_at: null,
});

/**
 * Mock data factory for Ad entities
 */
export const createMockAd = ({
  _id = '507f1f77bcf86cd799439016',
  external_id = 'ad_789',
  name = 'Test Ad',
} = {}) => ({
  _id,
  external_id,
  name,
  deleted_at: null,
});

/**
 * Create mock condition objects
 */
export const createCondition = ({
  metric = 'spend',
  operator = 'GREATER_THAN',
  value = 100,
  unit = 'USD',
} = {}) => ({
  metric,
  operator,
  value,
  unit,
});

/**
 * Schedule factories
 */
export const createContinuousSchedule = () => ({
  type: 'CONTINUOUS',
});

export const createDailySchedule = ({
  start_time = '08:00',
  end_time = '18:00',
} = {}) => ({
  type: 'DAILY',
  daily_time: {
    start_time,
    end_time,
  },
});

export const createCustomSchedule = ({ days = [] } = {}) => ({
  type: 'CUSTOM',
  custom_schedule: {
    days,
  },
});

export const createCustomDay = ({
  day = 'MONDAY',
  checked = true,
  time_slots = [],
} = {}) => ({
  day,
  checked,
  time_slots,
});

export const createTimeSlot = ({
  start_time = '09:00',
  end_time = '17:00',
} = {}) => ({
  start_time,
  end_time,
});

/**
 * Setup mock Mongoose models
 */
export const setupMockModels = () => {
  const mockFind = jest.fn();
  const mockSelect = jest.fn();
  const mockLean = jest.fn();
  const mockSort = jest.fn();
  const mockLimit = jest.fn();

  // Chain methods
  mockFind.mockReturnValue({
    select: mockSelect,
    lean: mockLean,
    sort: mockSort,
    limit: mockLimit,
  });

  mockSelect.mockReturnValue({
    lean: mockLean,
  });

  mockSort.mockReturnValue({
    lean: mockLean,
  });

  mockLimit.mockReturnValue({
    lean: mockLean,
  });

  return {
    mockFind,
    mockSelect,
    mockLean,
    mockSort,
    mockLimit,
  };
};
