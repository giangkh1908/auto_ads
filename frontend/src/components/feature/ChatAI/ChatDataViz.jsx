import React, { useMemo } from 'react';
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Cell
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, MousePointer, Eye, Activity } from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatCurrency = (value) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatNumber = (value) => {
    return new Intl.NumberFormat('vi-VN').format(value);
};

const MetricCard = ({ title, value, icon: Icon, trend, color }) => (
    <div className="chat-viz-card" style={{ borderLeft: `4px solid ${color}` }}>
        <div className="chat-viz-card-header">
            <span className="chat-viz-card-title">{title}</span>
            {Icon && <Icon size={16} color={color} />}
        </div>
        <div className="chat-viz-card-value">{value}</div>
        {trend && (
            <div className={`chat-viz-card-trend ${trend > 0 ? 'positive' : 'negative'}`}>
                {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(trend)}%
            </div>
        )}
    </div>
);

const ChatDataViz = ({ data, intent }) => {
    if (!data) return null;

    // --- 1. TREND VISUALIZATION ---
    if (intent === 'TREND' || (data.data_points && Array.isArray(data.data_points))) {
        const chartData = data.data_points || [];
        const metricKey = data.metric || 'value';

        if (chartData.length === 0) return null;

        return (
            <div className="chat-viz-container">
                <div className="chat-viz-title">Xu hướng {metricKey}</div>
                <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(str) => new Date(str).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                                style={{ fontSize: '10px' }}
                            />
                            <YAxis
                                hide
                                domain={['auto', 'auto']}
                            />
                            <Tooltip
                                formatter={(value) => [metricKey === 'spend' || metricKey === 'cpc' || metricKey === 'cpm' ? formatCurrency(value) : formatNumber(value), metricKey.toUpperCase()]}
                                labelFormatter={(label) => new Date(label).toLocaleDateString('vi-VN')}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                            />
                            <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorValue)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    // --- 2. COMPARISON & RANKING VISUALIZATION ---
    if (['COMPARE', 'RANKING', 'COMPARE_ENTITIES', 'LIST_ENTITIES'].includes(intent) || (data.ranking && Array.isArray(data.ranking)) || (data.campaigns && Array.isArray(data.campaigns))) {
        let chartData = [];
        let dataKey = 'value';
        let nameKey = 'name';

        if (data.ranking) {
            chartData = data.ranking;
            dataKey = 'value';
        } else if (data.campaigns) {
            // Flatten for comparison if needed, or just take top metric
            chartData = data.campaigns.map(c => ({
                name: c.name,
                value: c.metrics ? (c.metrics.spend || c.metrics.impressions || 0) : 0, // Default to spend/impressions
                ...c.metrics
            }));
        }

        if (chartData.length === 0) return null;

        return (
            <div className="chat-viz-container">
                <div className="chat-viz-title">So sánh hiệu quả</div>
                <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                        <BarChart data={chartData} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                                dataKey={nameKey}
                                type="category"
                                width={100}
                                tick={{ fontSize: 10 }}
                                interval={0}
                                tickFormatter={(val) => val.length > 15 ? val.substring(0, 12) + '...' : val}
                            />
                            <Tooltip
                                formatter={(value) => formatNumber(value)}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    // --- 3. OVERVIEW / TOTAL METRICS ---
    if (['OVERVIEW', 'TOTAL_METRICS'].includes(intent) || data.metrics) {
        const metrics = data.metrics || {};

        // Helper to extract value safely
        const getVal = (key) => metrics[key] || 0;

        return (
            <div className="chat-viz-grid">
                {getVal('spend') > 0 && (
                    <MetricCard
                        title="Chi tiêu"
                        value={formatCurrency(getVal('spend'))}
                        icon={DollarSign}
                        color="#FF8042"
                    />
                )}
                {getVal('impressions') > 0 && (
                    <MetricCard
                        title="Hiển thị"
                        value={formatNumber(getVal('impressions'))}
                        icon={Eye}
                        color="#8884d8"
                    />
                )}
                {getVal('clicks') > 0 && (
                    <MetricCard
                        title="Clicks"
                        value={formatNumber(getVal('clicks'))}
                        icon={MousePointer}
                        color="#00C49F"
                    />
                )}
                {getVal('ctr') > 0 && (
                    <MetricCard
                        title="CTR"
                        value={`${(getVal('ctr') * 100).toFixed(2)}%`}
                        icon={Activity}
                        color="#0088FE"
                    />
                )}
            </div>
        );
    }

    // --- 4. FALLBACK TABLE ---
    // If we have raw data but no specific visualization matched, or for list views
    if (data.campaigns || data.adsets || data.ads) {
        const items = data.campaigns || data.adsets || data.ads || [];
        if (items.length === 0) return null;

        return (
            <div className="chat-viz-container">
                <table className="chat-viz-table">
                    <thead>
                        <tr>
                            <th>Tên</th>
                            <th>Chi tiêu</th>
                            <th>Kết quả</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.slice(0, 5).map((item, idx) => (
                            <tr key={idx}>
                                <td title={item.name}>{item.name.length > 20 ? item.name.substring(0, 18) + '...' : item.name}</td>
                                <td>{item.metrics?.spend ? formatCurrency(item.metrics.spend) : '-'}</td>
                                <td>{item.metrics?.results || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {items.length > 5 && <div className="chat-viz-more">...và {items.length - 5} mục khác</div>}
            </div>
        );
    }

    return null;
};

export default ChatDataViz;
