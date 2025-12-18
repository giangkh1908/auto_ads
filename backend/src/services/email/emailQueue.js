/**
 * Email Queue Service
 * 
 * In-memory queue để gửi email bất đồng bộ, giúp:
 * - Không block request khi gửi email
 * - Xử lý nhiều email đồng thời (concurrency control)
 * - Tự động retry khi gặp lỗi
 */

// Queue configuration
const CONFIG = {
  maxConcurrent: 3,           // Số email gửi đồng thời tối đa
  maxRetries: 3,              // Số lần retry tối đa
  retryDelays: [5000, 15000, 30000], // Delay giữa các lần retry (ms)
  processInterval: 100,       // Interval kiểm tra queue (ms)
};

// Queue state
let queue = [];
let processing = 0;
let stats = {
  pending: 0,
  processing: 0,
  sent: 0,
  failed: 0,
};

// Track if queue processor is running
let isProcessorRunning = false;

/**
 * Thêm email job vào queue
 * @param {Function} emailFunction - Async function gửi email
 * @param {Object} metadata - Thông tin về email (để logging)
 */
export const addToQueue = (emailFunction, metadata = {}) => {
  const job = {
    id: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    emailFunction,
    metadata,
    retries: 0,
    createdAt: new Date(),
  };

  queue.push(job);
  stats.pending++;

  console.log(`📧 [EmailQueue] Added to queue: ${metadata.type || 'unknown'} -> ${metadata.to || 'unknown'} (Queue size: ${queue.length})`);

  // Start processor if not running
  if (!isProcessorRunning) {
    startProcessor();
  }
};

/**
 * Xử lý một email job
 * @param {Object} job - Email job từ queue
 */
const processJob = async (job) => {
  processing++;
  stats.processing++;
  stats.pending--;

  try {
    console.log(`📤 [EmailQueue] Sending: ${job.metadata.type || 'unknown'} -> ${job.metadata.to || 'unknown'}`);
    
    await job.emailFunction();
    
    stats.sent++;
    console.log(`✅ [EmailQueue] Sent successfully: ${job.metadata.type || 'unknown'} -> ${job.metadata.to || 'unknown'}`);
  } catch (error) {
    console.error(`❌ [EmailQueue] Failed: ${job.metadata.type || 'unknown'} -> ${job.metadata.to || 'unknown'}`, error.message);

    // Retry logic
    if (job.retries < CONFIG.maxRetries) {
      job.retries++;
      const delay = CONFIG.retryDelays[job.retries - 1] || CONFIG.retryDelays[CONFIG.retryDelays.length - 1];
      
      console.log(`🔄 [EmailQueue] Scheduling retry ${job.retries}/${CONFIG.maxRetries} in ${delay / 1000}s...`);
      
      setTimeout(() => {
        queue.push(job);
        stats.pending++;
      }, delay);
    } else {
      stats.failed++;
      console.error(`💀 [EmailQueue] Max retries exceeded for: ${job.metadata.type || 'unknown'} -> ${job.metadata.to || 'unknown'}`);
    }
  } finally {
    processing--;
    stats.processing--;
  }
};

/**
 * Queue processor - chạy liên tục để xử lý email jobs
 */
const processQueue = async () => {
  // Chỉ xử lý khi có job trong queue và chưa đạt limit
  while (queue.length > 0 && processing < CONFIG.maxConcurrent) {
    const job = queue.shift();
    if (job) {
      // Fire-and-forget: không await để có thể process nhiều job song song
      processJob(job);
    }
  }
};

/**
 * Khởi động queue processor
 */
const startProcessor = () => {
  if (isProcessorRunning) return;
  
  isProcessorRunning = true;
  console.log('🚀 [EmailQueue] Processor started');

  const intervalId = setInterval(() => {
    processQueue();

    // Dừng processor khi queue rỗng và không có job đang xử lý
    if (queue.length === 0 && processing === 0) {
      clearInterval(intervalId);
      isProcessorRunning = false;
      console.log('⏸️ [EmailQueue] Processor stopped (queue empty)');
    }
  }, CONFIG.processInterval);
};

/**
 * Lấy thống kê queue
 * @returns {Object} Queue statistics
 */
export const getQueueStatus = () => ({
  ...stats,
  queueLength: queue.length,
  isRunning: isProcessorRunning,
});

/**
 * Reset statistics (for testing)
 */
export const resetStats = () => {
  stats = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
  };
};

export default {
  addToQueue,
  getQueueStatus,
  resetStats,
};
