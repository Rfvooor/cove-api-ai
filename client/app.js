// ... (previous code remains the same until line 423) ...

// Chat Interface
let attachedFiles = [];
let currentExecutor = null;
let taskComponents = [];
let sequenceSteps = [];

function initializeChatInterface() {
    const executorTypeSelect = document.getElementById('executorType');
    const executorIdSelect = document.getElementById('executorId');
    const chatForm = document.getElementById('chatForm');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const fileInput = document.getElementById('fileInput');
    const taskBuilderBtn = document.getElementById('taskBuilderBtn');
    const sequencerBtn = document.getElementById('sequencerBtn');

    // Handle executor type change
    executorTypeSelect.addEventListener('change', async () => {
        const type = executorTypeSelect.value;
        const response = await fetch(`${API_BASE_URL}/${type}s`);
        const data = await response.json();
        
        executorIdSelect.innerHTML = '<option value="">Select an executor</option>';
        data.forEach(executor => {
            const option = document.createElement('option');
            option.value = executor.id;
            option.textContent = executor.name;
            executorIdSelect.appendChild(option);
        });
    });

    // Handle executor selection
    executorIdSelect.addEventListener('change', () => {
        currentExecutor = {
            type: executorTypeSelect.value,
            id: executorIdSelect.value
        };
    });

    // Handle file attachments
    attachmentBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        Array.from(fileInput.files).forEach(file => {
            attachedFiles.push(file);
            addAttachmentToList(file);
        });
        fileInput.value = '';
    });

    // Handle chat form submission
    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentExecutor?.id) {
            showNotification('Please select an executor', 'error');
            return;
        }

        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        if (!message && attachedFiles.length === 0) {
            showNotification('Please enter a message or attach files', 'error');
            return;
        }

        // Create form data with message and attachments
        const formData = new FormData();
        formData.append('input', message);
        attachedFiles.forEach(file => {
            formData.append('files', file);
        });

        try {
            // Add user message to chat
            addMessageToChat('user', message, attachedFiles);

            // Execute task
            const response = await fetch(
                `${API_BASE_URL}/${currentExecutor.type}s/${currentExecutor.id}/execute`,
                {
                    method: 'POST',
                    body: formData
                }
            );

            if (!response.ok) throw new Error('Failed to execute task');
            const result = await response.json();

            // Add response to chat
            addMessageToChat('assistant', result.data.output);

            // Clear input and attachments
            messageInput.value = '';
            attachedFiles = [];
            document.getElementById('attachmentList').innerHTML = '';
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // Initialize Task Builder
    taskBuilderBtn.addEventListener('click', () => {
        document.getElementById('taskBuilderModal').classList.remove('hidden');
        initializeTaskBuilder();
    });

    // Initialize Sequencer
    sequencerBtn.addEventListener('click', () => {
        document.getElementById('sequencerModal').classList.remove('hidden');
        initializeSequencer();
    });
}

function addMessageToChat(role, content, attachments = []) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role} ${role === 'user' ? 'ml-auto' : 'mr-auto'} max-w-3/4 bg-white rounded-lg shadow p-4`;

    // Add message content
    const contentP = document.createElement('p');
    contentP.className = 'text-gray-800';
    contentP.textContent = content;
    messageDiv.appendChild(contentP);

    // Add attachments if any
    if (attachments.length > 0) {
        const attachmentsDiv = document.createElement('div');
        attachmentsDiv.className = 'mt-2 space-y-1';
        attachments.forEach(file => {
            const attachmentP = document.createElement('p');
            attachmentP.className = 'text-sm text-blue-600';
            attachmentP.innerHTML = `<i class="fas fa-paperclip mr-1"></i>${file.name}`;
            attachmentsDiv.appendChild(attachmentP);
        });
        messageDiv.appendChild(attachmentsDiv);
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAttachmentToList(file) {
    const attachmentList = document.getElementById('attachmentList');
    const attachmentDiv = document.createElement('div');
    attachmentDiv.className = 'flex items-center space-x-2 bg-gray-100 rounded px-2 py-1';
    attachmentDiv.innerHTML = `
        <span class="text-sm">${file.name}</span>
        <button class="text-red-500 hover:text-red-700" onclick="removeAttachment('${file.name}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    attachmentList.appendChild(attachmentDiv);
}

function removeAttachment(fileName) {
    attachedFiles = attachedFiles.filter(file => file.name !== fileName);
    document.getElementById('attachmentList').innerHTML = '';
    attachedFiles.forEach(file => addAttachmentToList(file));
}

// Task Builder
function initializeTaskBuilder() {
    const taskComponents = document.querySelectorAll('.task-component');
    const taskFlow = document.getElementById('taskFlow');
    const applyTaskBtn = document.getElementById('applyTaskBtn');

    // Initialize drag and drop
    taskComponents.forEach(component => {
        component.addEventListener('dragstart', handleDragStart);
    });

    taskFlow.addEventListener('dragover', handleDragOver);
    taskFlow.addEventListener('drop', handleDrop);

    // Handle apply task
    applyTaskBtn.addEventListener('click', () => {
        const task = buildTaskFromComponents();
        const messageInput = document.getElementById('messageInput');
        messageInput.value = JSON.stringify(task, null, 2);
        document.getElementById('taskBuilderModal').classList.add('hidden');
    });
}

function handleDragStart(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.type);
}

function handleDragOver(e) {
    e.preventDefault();
}

function handleDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData('text/plain');
    addComponentToFlow(type);
}

function addComponentToFlow(type) {
    const taskFlow = document.getElementById('taskFlow');
    const component = document.createElement('div');
    component.className = 'task-component-instance bg-white shadow rounded p-2 mb-2';
    component.innerHTML = `
        <div class="flex justify-between items-center">
            <span><i class="fas fa-${getComponentIcon(type)} mr-2"></i>${type}</span>
            <button onclick="removeComponent(this)" class="text-red-500">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="mt-2">
            ${getComponentConfig(type)}
        </div>
    `;
    taskFlow.appendChild(component);
}

function getComponentIcon(type) {
    const icons = {
        input: 'keyboard',
        process: 'cogs',
        condition: 'code-branch',
        loop: 'redo'
    };
    return icons[type] || 'question';
}

function getComponentConfig(type) {
    switch (type) {
        case 'input':
            return `
                <input type="text" class="form-input w-full" placeholder="Input value">
            `;
        case 'process':
            return `
                <select class="form-select w-full">
                    <option value="transform">Transform</option>
                    <option value="filter">Filter</option>
                    <option value="aggregate">Aggregate</option>
                </select>
            `;
        case 'condition':
            return `
                <input type="text" class="form-input w-full" placeholder="Condition expression">
            `;
        case 'loop':
            return `
                <input type="number" class="form-input w-full" placeholder="Number of iterations">
            `;
        default:
            return '';
    }
}

function removeComponent(button) {
    button.closest('.task-component-instance').remove();
}

function buildTaskFromComponents() {
    const components = document.querySelectorAll('.task-component-instance');
    return Array.from(components).map(component => {
        const type = component.querySelector('span').textContent;
        const config = component.querySelector('input, select')?.value;
        return { type, config };
    });
}

// Sequencer
function initializeSequencer() {
    const addStepBtn = document.getElementById('addStepBtn');
    const applySequenceBtn = document.getElementById('applySequenceBtn');

    addStepBtn.addEventListener('click', addSequenceStep);
    applySequenceBtn.addEventListener('click', () => {
        const sequence = buildSequence();
        const messageInput = document.getElementById('messageInput');
        messageInput.value = JSON.stringify(sequence, null, 2);
        document.getElementById('sequencerModal').classList.add('hidden');
    });

    updateSequenceFlow();
}

function addSequenceStep() {
    const sequenceSteps = document.getElementById('sequenceSteps');
    const stepNumber = sequenceSteps.children.length + 1;
    
    const stepDiv = document.createElement('div');
    stepDiv.className = 'sequence-step';
    stepDiv.innerHTML = `
        <div class="flex items-center space-x-2">
            <span class="step-number">${stepNumber}</span>
            <select class="form-select flex-grow">
                <option value="agent">Agent Task</option>
                <option value="swarm">Swarm Task</option>
                <option value="condition">Condition</option>
                <option value="parallel">Parallel Tasks</option>
            </select>
            <button onclick="removeStep(this)" class="btn-danger">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    
    sequenceSteps.appendChild(stepDiv);
    updateSequenceFlow();
}

function removeStep(button) {
    button.closest('.sequence-step').remove();
    updateStepNumbers();
    updateSequenceFlow();
}

function updateStepNumbers() {
    const steps = document.querySelectorAll('.sequence-step');
    steps.forEach((step, index) => {
        step.querySelector('.step-number').textContent = index + 1;
    });
}

function updateSequenceFlow() {
    const sequenceFlow = document.getElementById('sequenceFlow');
    const steps = document.querySelectorAll('.sequence-step');
    
    sequenceFlow.innerHTML = '';
    steps.forEach((step, index) => {
        const type = step.querySelector('select').value;
        const flowStep = document.createElement('div');
        flowStep.className = 'flow-step flex items-center space-x-2';
        flowStep.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                ${index + 1}
            </div>
            <div class="flex-grow h-1 bg-blue-200"></div>
        `;
        sequenceFlow.appendChild(flowStep);
    });
}

function buildSequence() {
    const steps = document.querySelectorAll('.sequence-step');
    return Array.from(steps).map(step => ({
        type: step.querySelector('select').value,
        number: parseInt(step.querySelector('.step-number').textContent)
    }));
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeWebSocket();
    fetchData();
    setupEventListeners();
    initializeCharts();
    initializeChatInterface();
});