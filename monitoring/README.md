# Monitoring System

The Monitoring System provides comprehensive observability for the Agent & Swarm Management Platform through metrics collection, visualization, and alerting.

## 🌟 Features

- Real-time metrics collection
- Performance monitoring
- Resource utilization tracking
- Custom alerting rules
- Metric visualization
- Historical data analysis
- Health checks

## 🏗️ Architecture

### Directory Structure
```
monitoring/
├── prometheus.yml       # Prometheus configuration
├── alert_rules.yml     # Alerting rules
└── recording_rules.yml # Recording rules
```

### Components

#### Prometheus
- Metrics collection
- Time series database
- Query engine
- Alert manager

#### Grafana
- Metric visualization
- Dashboard creation
- Alert management
- Data exploration

## 📊 Metrics

### System Metrics

#### API Metrics
```yaml
# Request metrics
http_requests_total{method="GET", endpoint="/api/v1/agents"}
http_request_duration_seconds{method="POST", endpoint="/api/v1/swarms"}
http_errors_total{method="PATCH", endpoint="/api/v1/tasks"}

# Response metrics
http_response_size_bytes{endpoint="/api/v1/agents"}
http_response_time_seconds{endpoint="/api/v1/swarms"}
```

#### Resource Metrics
```yaml
# Memory usage
process_resident_memory_bytes
process_heap_bytes
process_heap_used_bytes

# CPU usage
process_cpu_seconds_total
process_cpu_user_seconds
process_cpu_system_seconds
```

### Business Metrics

#### Agent Metrics
```yaml
# Agent status
agent_status{id="agent-1", status="active"}
agent_execution_time_seconds{id="agent-1", task_type="research"}
agent_memory_usage_bytes{id="agent-1", provider="redis"}

# Task metrics
agent_tasks_total{id="agent-1", status="completed"}
agent_task_success_rate{id="agent-1"}
```

#### Swarm Metrics
```yaml
# Swarm status
swarm_status{id="swarm-1", topology="hierarchical"}
swarm_agent_count{id="swarm-1"}
swarm_task_distribution{id="swarm-1"}

# Performance metrics
swarm_execution_time_seconds{id="swarm-1"}
swarm_efficiency_ratio{id="swarm-1"}
```

## ⚡ Alert Rules

### System Alerts
```yaml
groups:
  - name: system_alerts
    rules:
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 1e9
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High memory usage detected
          description: Memory usage exceeds 1GB for 5 minutes

      - alert: HighCPUUsage
        expr: rate(process_cpu_seconds_total[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: High CPU usage detected
          description: CPU usage exceeds 80% for 5 minutes
```

### Business Alerts
```yaml
groups:
  - name: business_alerts
    rules:
      - alert: LowAgentSuccessRate
        expr: agent_task_success_rate < 0.9
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: Low agent success rate
          description: Agent success rate below 90% for 15 minutes

      - alert: SwarmInefficiency
        expr: swarm_efficiency_ratio < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: Swarm inefficiency detected
          description: Swarm efficiency below 70% for 10 minutes
```

## 📈 Dashboards

### System Overview
```javascript
// Memory usage panel
{
  "title": "Memory Usage",
  "type": "graph",
  "datasource": "Prometheus",
  "targets": [{
    "expr": "process_resident_memory_bytes",
    "legendFormat": "Memory Usage"
  }],
  "yaxes": [
    { "format": "bytes" },
    { "show": false }
  ]
}

// CPU usage panel
{
  "title": "CPU Usage",
  "type": "graph",
  "datasource": "Prometheus",
  "targets": [{
    "expr": "rate(process_cpu_seconds_total[5m])",
    "legendFormat": "CPU Usage"
  }],
  "yaxes": [
    { "format": "percentunit" },
    { "show": false }
  ]
}
```

### Agent Performance
```javascript
// Task success rate panel
{
  "title": "Agent Success Rate",
  "type": "gauge",
  "datasource": "Prometheus",
  "targets": [{
    "expr": "agent_task_success_rate",
    "legendFormat": "Success Rate"
  }],
  "options": {
    "minValue": 0,
    "maxValue": 1,
    "thresholds": [
      { "value": 0.9, "color": "green" },
      { "value": 0.7, "color": "yellow" },
      { "value": 0, "color": "red" }
    ]
  }
}
```

## 🔧 Configuration

### Prometheus Configuration
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'agent-platform'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scheme: 'http'

rule_files:
  - 'alert_rules.yml'
  - 'recording_rules.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['localhost:9093']
```

## 🚀 Development

### Setup
```bash
# Start Prometheus
docker run -d \
  -p 9090:9090 \
  -v ./prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

# Start Grafana
docker run -d \
  -p 3000:3000 \
  grafana/grafana
```

### Testing
```bash
# Test Prometheus config
promtool check config prometheus.yml

# Test alert rules
promtool check rules alert_rules.yml
```

## 📚 Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Alert Rules Guide](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)