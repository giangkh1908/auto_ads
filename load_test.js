import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  // Cấu hình 500 Virtual Users (VU)
  stages: [
    { duration: '30s', target: 500 },  // Tăng từ 0 lên 500 users trong 30s
    { duration: '2m', target: 2000 }, // Duy trì 2000 users trong 2 phút
    { duration: '30s', target: 0 },    // Giảm dần về 0
  ],
};

export default function () {
  const url = 'https://api.vibestoneoficial.store/health';
  const res = http.get(url);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1); // Mỗi user chờ 1 giây rồi mới thực hiện request tiếp theo
}
