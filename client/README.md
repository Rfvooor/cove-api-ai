# Client Interface

The Client Interface provides a real-time web dashboard for managing and monitoring the Agent & Swarm Management Platform. It offers an intuitive interface for creating agents, orchestrating swarms, and tracking system performance.

## 🌟 Features

- Real-time dashboard
- Agent management interface
- Swarm orchestration
- Task monitoring
- System metrics visualization
- WebSocket-based updates
- Responsive design
- Dark/light theme support

## 🏗️ Architecture

### Directory Structure
```
client/
├── app.js          # Application logic
├── index.html      # Main HTML template
└── styles.css      # Tailwind-based styling
```

### Components

#### Dashboard
- System overview
- Real-time metrics
- Performance charts
- Status indicators

#### Agent Management
- Agent creation/editing
- Status monitoring
- Task execution
- Performance metrics

#### Swarm Management
- Swarm creation/editing
- Agent assignment
- Topology visualization
- Task distribution

## 💻 Interface Elements

### Agent Card
```html
<div class="agent-card">
  <div class="flex justify-between items-start mb-4">
    <div>
      <h3 class="text-lg font-semibold">Agent Name</h3>
      <p class="text-sm text-gray-500">Description</p>
    </div>
    <span class="status active">Active</span>
  </div>
  <div class="space-y-2">
    <p class="text-sm"><strong>Model:</strong> GPT-4</p>
    <p class="text-sm"><strong>Memory:</strong> Redis</p>
  </div>
  <div class="flex justify-end space-x-2 mt-4">
    <button class="btn-primary">Execute</button>
    <button class="btn-secondary">Edit</button>
  </div>
</div>
```

### Swarm Card
```html
<div class="swarm-card">
  <div class="flex justify-between items-start mb-4">
    <div>
      <h3 class="text-lg font-semibold">Swarm Name</h3>
      <p class="text-sm text-gray-500">Description</p>
    </div>
    <span class="status active">Active</span>
  </div>
  <div class="space-y-2">
    <p class="text-sm"><strong>Type:</strong> Hierarchical</p>
    <p class="text-sm"><strong>Agents:</strong> 5</p>
  </div>
  <div class="flex justify-end space-x-2 mt-4">
    <button class="btn-primary">Execute</button>
    <button class="btn-secondary">Edit</button>
  </div>
</div>
```

## 🔄 Real-time Updates

### WebSocket Connection
```javascript
const WS_URL = `ws://${window.location.host}/ws`;
let ws;

function initializeWebSocket() {
  ws = new WebSocket(WS_URL);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleRealtimeUpdate(data);
  };

  ws.onclose = () => {
    console.log('WebSocket connection closed. Retrying...');
    setTimeout(initializeWebSocket, 5000);
  };
}
```

### State Management
```javascript
let state = {
  agents: [],
  swarms: [],
  tasks: [],
  tools: [],
  activeTab: 'agents',
  stats: {
    activeAgents: 0,
    activeSwarms: 0,
    tasksCompleted: 0
  }
};

function updateUI() {
  // Update stats
  updateStats();
  
  // Update sections
  updateAgentsSection();
  updateSwarmsSection();
  updateTasksSection();
  updateToolsSection();
  
  // Update charts
  updatePerformanceChart();
  updateMemoryUsageChart();
}
```

## 📊 Charts & Metrics

### Performance Chart
```javascript
const performanceChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Task Success Rate',
      data: [],
      borderColor: '#10b981',
      tension: 0.4,
      fill: false
    }]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: value => `${value}%`
        }
      }
    }
  }
});
```

### Memory Usage Chart
```javascript
const memoryChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Redis', 'PostgreSQL', 'ChromaDB', 'Pinecone'],
    datasets: [{
      label: 'Memory Usage (MB)',
      data: [0, 0, 0, 0],
      backgroundColor: [
        '#3b82f6',
        '#10b981',
        '#f59e0b',
        '#ef4444'
      ]
    }]
  },
  options: {
    responsive: true,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: value => `${value} MB`
        }
      }
    }
  }
});
```

## 🎨 Styling

### Base Styles
```css
:root {
  --primary-color: #3b82f6;
  --secondary-color: #6b7280;
  --success-color: #10b981;
  --danger-color: #ef4444;
  --warning-color: #f59e0b;
}

.btn-primary {
  @apply px-4 py-2 bg-blue-500 text-white rounded-lg 
         hover:bg-blue-600 transition-colors duration-200;
}

.btn-secondary {
  @apply px-4 py-2 bg-gray-500 text-white rounded-lg 
         hover:bg-gray-600 transition-colors duration-200;
}
```

### Responsive Design
```css
@media (max-width: 640px) {
  .modal-content {
    @apply w-11/12;
  }

  .stat-card {
    @apply col-span-1;
  }
}

@media (min-width: 768px) {
  .grid-auto-fit {
    @apply grid-cols-2;
  }
}

@media (min-width: 1024px) {
  .grid-auto-fit {
    @apply grid-cols-3;
  }
}
```

## 🚀 Development

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 🔒 Security

- Input validation
- XSS protection
- CSRF protection
- Secure WebSocket
- Rate limiting

## 🤝 Contributing

1. Review UI/UX guidelines
2. Follow component structure
3. Add tests
4. Update documentation
5. Submit PR

## 📚 Resources

- [UI Guidelines](./docs/ui-guidelines.md)
- [Component Library](./docs/components.md)
- [Chart Documentation](./docs/charts.md)
- [WebSocket Protocol](./docs/websocket.md)