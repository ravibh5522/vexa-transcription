// Vexa API Dashboard - Main Application
const app = {
    // Application state
    state: {
        apiKey: localStorage.getItem('vexa_api_key') || '',
        baseUrl: localStorage.getItem('vexa_base_url') || window.location.origin,
        activeBots: [],
        meetings: [],
        currentView: 'dashboard',
        websocket: null,
        wsConnected: false,
        liveTranscriptions: {}, // {meetingId: [segments]}
        selectedMeeting: null,
        autoRefresh: null,
    },

    // Initialize the application
    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.checkConnection();
        
        // Auto-refresh active bots every 10 seconds
        setInterval(() => {
            if (this.state.apiKey && this.state.currentView === 'dashboard') {
                this.refreshActiveBots();
            }
        }, 10000);
    },

    // Load settings from localStorage
    loadSettings() {
        const savedApiKey = localStorage.getItem('vexa_api_key');
        const savedBaseUrl = localStorage.getItem('vexa_base_url');
        
        if (savedApiKey) {
            this.state.apiKey = savedApiKey;
            document.getElementById('apiKey').value = savedApiKey;
        }
        
        if (savedBaseUrl) {
            this.state.baseUrl = savedBaseUrl;
            document.getElementById('baseUrl').value = savedBaseUrl;
        }
    },

    // Save settings to localStorage
    saveSettings() {
        const apiKey = document.getElementById('apiKey').value.trim();
        const baseUrl = document.getElementById('baseUrl').value.trim();
        
        this.state.apiKey = apiKey;
        this.state.baseUrl = baseUrl || window.location.origin;
        
        localStorage.setItem('vexa_api_key', apiKey);
        localStorage.setItem('vexa_base_url', this.state.baseUrl);
        
        this.showNotification('Settings saved successfully!', 'success');
        this.checkConnection();
    },

    // Setup event listeners
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('[data-view]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showView(e.target.dataset.view);
            });
        });

        // Save settings button
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());

        // Create bot form
        document.getElementById('createBotForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.createBot();
        });

        // Refresh buttons
        document.getElementById('refreshBots')?.addEventListener('click', () => this.refreshActiveBots());
        document.getElementById('refreshMeetings')?.addEventListener('click', () => this.loadMeetings());

        // WebSocket toggle
        document.getElementById('connectWs')?.addEventListener('click', () => this.toggleWebSocket());

        // Meeting search
        document.getElementById('meetingSearch')?.addEventListener('input', (e) => this.filterMeetings(e.target.value));

        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });
    },

    // Show specific view
    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => view.classList.add('hidden'));
        document.querySelectorAll('[data-view]').forEach(link => link.classList.remove('active'));
        
        document.getElementById(`${viewName}View`)?.classList.remove('hidden');
        document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
        
        this.state.currentView = viewName;

        // Load view-specific data
        switch(viewName) {
            case 'dashboard':
                this.refreshActiveBots();
                break;
            case 'meetings':
                this.loadMeetings();
                break;
            case 'transcription':
                this.loadTranscriptionView();
                break;
        }
    },

    // Check API connection
    async checkConnection() {
        if (!this.state.apiKey) {
            this.updateConnectionStatus('disconnected', 'No API key configured');
            return;
        }

        try {
            const response = await this.apiRequest('/health');
            if (response) {
                this.updateConnectionStatus('connected', 'Connected to Vexa API');
                this.refreshActiveBots();
            }
        } catch (error) {
            this.updateConnectionStatus('error', `Connection failed: ${error.message}`);
        }
    },

    // Update connection status indicator
    updateConnectionStatus(status, message) {
        const indicator = document.getElementById('connectionStatus');
        const text = document.getElementById('connectionText');
        
        if (indicator) {
            indicator.className = `status-indicator status-${status}`;
        }
        if (text) {
            text.textContent = message;
        }
    },

    // Make API request
    async apiRequest(endpoint, options = {}) {
        const url = `${this.state.baseUrl}${endpoint}`;
        
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.state.apiKey,
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Refresh active bots list
    async refreshActiveBots() {
        if (!this.state.apiKey) return;

        try {
            const botsStatus = await this.apiRequest('/bots/status');
            // API returns {running_bots: [...]} not a direct array
            this.state.activeBots = botsStatus.running_bots || [];
            this.renderActiveBots();
        } catch (error) {
            console.error('Failed to fetch active bots:', error);
            this.showNotification('Failed to fetch active bots: ' + error.message, 'error');
        }
    },

    // Render active bots
    renderActiveBots() {
        const container = document.getElementById('activeBotsList');
        if (!container) return;

        if (this.state.activeBots.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-robot"></i>
                    <p>No active bots</p>
                    <small>Create a new bot to get started</small>
                </div>
            `;
            return;
        }

        container.innerHTML = this.state.activeBots.map(bot => `
            <div class="bot-card" data-bot-id="${bot.container_id || bot.bot_id}">
                <div class="bot-header">
                    <span class="bot-platform platform-${bot.platform?.toLowerCase()}">${bot.platform || 'Unknown'}</span>
                    <span class="bot-status status-${bot.normalized_status || bot.status}">${bot.normalized_status || bot.status}</span>
                </div>
                <div class="bot-info">
                    <p><strong>Meeting ID:</strong> ${bot.native_meeting_id || bot.meeting_id || 'N/A'}</p>
                    <p><strong>Container:</strong> ${bot.container_name || bot.container_id?.substring(0, 12) || 'N/A'}</p>
                    <p><strong>Created:</strong> ${bot.created_at ? new Date(bot.created_at).toLocaleString() : 'N/A'}</p>
                </div>
                <div class="bot-actions">
                    <button class="btn btn-sm btn-primary" onclick="app.viewTranscription('${bot.platform}', '${bot.native_meeting_id || bot.meeting_id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.stopBot('${bot.platform}', '${bot.native_meeting_id || bot.meeting_id}')">
                        <i class="fas fa-stop"></i> Stop
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Create a new bot
    async createBot() {
        const platform = document.getElementById('botPlatform').value;
        const meetingUrl = document.getElementById('meetingUrl').value.trim();
        const botName = document.getElementById('botName').value.trim();

        if (!meetingUrl) {
            this.showNotification('Please enter a meeting URL', 'error');
            return;
        }

        const submitBtn = document.querySelector('#createBotForm button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';

        try {
            const payload = {
                meeting_url: meetingUrl,
                platform: platform
            };
            
            if (botName) {
                payload.bot_name = botName;
            }

            const result = await this.apiRequest('/bots/create', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            this.showNotification(`Bot created successfully! Meeting ID: ${result.native_meeting_id || result.meeting_id}`, 'success');
            document.getElementById('createBotForm').reset();
            
            // Refresh the active bots list
            setTimeout(() => this.refreshActiveBots(), 2000);
        } catch (error) {
            this.showNotification(`Failed to create bot: ${error.message}`, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-plus"></i> Create Bot';
        }
    },

    // Stop a bot
    async stopBot(platform, meetingId) {
        if (!confirm('Are you sure you want to stop this bot?')) return;

        try {
            await this.apiRequest(`/bots/remove/${platform}/${meetingId}`, {
                method: 'DELETE'
            });
            this.showNotification('Bot stopped successfully', 'success');
            this.refreshActiveBots();
        } catch (error) {
            this.showNotification(`Failed to stop bot: ${error.message}`, 'error');
        }
    },

    // Load meetings list
    async loadMeetings() {
        if (!this.state.apiKey) return;

        const container = document.getElementById('meetingsList');
        if (!container) return;

        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading meetings...</div>';

        try {
            const meetings = await this.apiRequest('/meetings');
            this.state.meetings = Array.isArray(meetings) ? meetings : (meetings.meetings || []);
            this.renderMeetings();
        } catch (error) {
            container.innerHTML = `<div class="error-state"><i class="fas fa-exclamation-triangle"></i><p>Failed to load meetings: ${error.message}</p></div>`;
        }
    },

    // Render meetings list
    renderMeetings() {
        const container = document.getElementById('meetingsList');
        if (!container) return;

        if (this.state.meetings.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No meetings found</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.state.meetings.map(meeting => `
            <div class="meeting-card" data-meeting-id="${meeting.native_meeting_id || meeting.id}">
                <div class="meeting-header">
                    <span class="meeting-platform platform-${meeting.platform?.toLowerCase()}">${meeting.platform || 'Unknown'}</span>
                    <span class="meeting-status status-${meeting.status}">${meeting.status}</span>
                </div>
                <div class="meeting-info">
                    <p><strong>Meeting ID:</strong> ${meeting.native_meeting_id || meeting.id}</p>
                    <p><strong>Started:</strong> ${meeting.started_at ? new Date(meeting.started_at).toLocaleString() : 'N/A'}</p>
                    ${meeting.ended_at ? `<p><strong>Ended:</strong> ${new Date(meeting.ended_at).toLocaleString()}</p>` : ''}
                </div>
                <div class="meeting-actions">
                    <button class="btn btn-sm btn-primary" onclick="app.viewTranscription('${meeting.platform}', '${meeting.native_meeting_id || meeting.id}')">
                        <i class="fas fa-file-alt"></i> Transcript
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="app.subscribeToMeeting('${meeting.platform}', '${meeting.native_meeting_id || meeting.id}')">
                        <i class="fas fa-broadcast-tower"></i> Live
                    </button>
                </div>
            </div>
        `).join('');
    },

    // Filter meetings by search term
    filterMeetings(searchTerm) {
        const cards = document.querySelectorAll('.meeting-card');
        searchTerm = searchTerm.toLowerCase();

        cards.forEach(card => {
            const text = card.textContent.toLowerCase();
            card.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    },

    // View transcription for a meeting
    async viewTranscription(platform, meetingId) {
        this.state.selectedMeeting = { platform, meetingId };
        this.showView('transcription');
    },

    // Load transcription view
    async loadTranscriptionView() {
        const container = document.getElementById('transcriptionContent');
        if (!container) return;

        if (!this.state.selectedMeeting) {
            // Try to get from active bots
            if (this.state.activeBots.length > 0) {
                const bot = this.state.activeBots[0];
                this.state.selectedMeeting = {
                    platform: bot.platform,
                    meetingId: bot.native_meeting_id || bot.meeting_id
                };
            } else {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt"></i>
                        <p>No meeting selected</p>
                        <small>Select a meeting from the Meetings tab or start a new bot</small>
                    </div>
                `;
                return;
            }
        }

        const { platform, meetingId } = this.state.selectedMeeting;
        
        // Update header
        const header = document.getElementById('transcriptionHeader');
        if (header) {
            header.innerHTML = `
                <h3><i class="fas fa-file-alt"></i> Transcription: ${platform} - ${meetingId}</h3>
                <div class="transcription-actions">
                    <button class="btn btn-sm btn-primary" onclick="app.refreshTranscription()">
                        <i class="fas fa-sync"></i> Refresh
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="app.subscribeToMeeting('${platform}', '${meetingId}')">
                        <i class="fas fa-broadcast-tower"></i> Live Updates
                    </button>
                    <button class="btn btn-sm btn-success" onclick="app.downloadTranscription()">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
            `;
        }

        await this.refreshTranscription();
    },

    // Refresh transcription
    async refreshTranscription() {
        const container = document.getElementById('transcriptionContent');
        if (!container || !this.state.selectedMeeting) return;

        const { platform, meetingId } = this.state.selectedMeeting;

        container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading transcription...</div>';

        try {
            const response = await this.apiRequest(`/transcripts/${platform}/${meetingId}`);
            const segments = response.segments || [];
            
            if (segments.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-microphone-slash"></i>
                        <p>No transcription available yet</p>
                        <small>Transcription will appear here as the meeting progresses</small>
                    </div>
                `;
                return;
            }

            this.renderTranscription(segments);
        } catch (error) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load transcription: ${error.message}</p>
                    <button class="btn btn-primary" onclick="app.refreshTranscription()">Retry</button>
                </div>
            `;
        }
    },

    // Render transcription segments
    renderTranscription(segments) {
        const container = document.getElementById('transcriptionContent');
        if (!container) return;

        container.innerHTML = `
            <div class="transcription-segments">
                ${segments.map(segment => `
                    <div class="segment">
                        <div class="segment-header">
                            <span class="speaker">${segment.speaker || 'Unknown Speaker'}</span>
                            <span class="timestamp">${this.formatTimestamp(segment.absolute_start_time || segment.start_time || segment.timestamp)}</span>
                        </div>
                        <div class="segment-text">${segment.text || segment.content || ''}</div>
                    </div>
                `).join('')}
            </div>
        `;

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },

    // Format timestamp
    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        // If it's a number (seconds), format as mm:ss
        if (typeof timestamp === 'number') {
            const minutes = Math.floor(timestamp / 60);
            const seconds = Math.floor(timestamp % 60);
            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // If it's a date string, format it
        try {
            return new Date(timestamp).toLocaleTimeString();
        } catch {
            return timestamp;
        }
    },

    // Download transcription
    async downloadTranscription() {
        if (!this.state.selectedMeeting) return;

        const { platform, meetingId } = this.state.selectedMeeting;

        try {
            const response = await this.apiRequest(`/transcripts/${platform}/${meetingId}`);
            const segments = response.segments || [];
            
            // Format as text
            const text = segments.map(s => 
                `[${this.formatTimestamp(s.absolute_start_time || s.start_time)}] ${s.speaker || 'Unknown'}: ${s.text || ''}`
            ).join('\n');

            // Download
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transcript_${platform}_${meetingId}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            this.showNotification('Failed to download transcription: ' + error.message, 'error');
        }
    },

    // WebSocket Management
    toggleWebSocket() {
        if (this.state.wsConnected) {
            this.disconnectWebSocket();
        } else {
            this.connectWebSocket();
        }
    },

    connectWebSocket() {
        if (this.state.websocket) {
            this.state.websocket.close();
        }

        const wsProtocol = this.state.baseUrl.startsWith('https') ? 'wss' : 'ws';
        const wsHost = this.state.baseUrl.replace(/^https?:\/\//, '');
        // Use query param for authentication (not subprotocols)
        const wsUrl = `${wsProtocol}://${wsHost}/ws?api_key=${encodeURIComponent(this.state.apiKey)}`;

        try {
            this.state.websocket = new WebSocket(wsUrl);

            this.state.websocket.onopen = () => {
                this.state.wsConnected = true;
                this.updateWsStatus('connected');
                this.showNotification('WebSocket connected', 'success');
                
                // Auto-subscribe to active meetings
                this.subscribeToActiveMeetings();
            };

            this.state.websocket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWsMessage(data);
                } catch (e) {
                    console.error('Failed to parse WebSocket message:', e);
                }
            };

            this.state.websocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('WebSocket error occurred', 'error');
            };

            this.state.websocket.onclose = () => {
                this.state.wsConnected = false;
                this.updateWsStatus('disconnected');
                this.showNotification('WebSocket disconnected', 'warning');
            };
        } catch (error) {
            this.showNotification('Failed to connect WebSocket: ' + error.message, 'error');
        }
    },

    disconnectWebSocket() {
        if (this.state.websocket) {
            this.state.websocket.close();
            this.state.websocket = null;
        }
        this.state.wsConnected = false;
        this.updateWsStatus('disconnected');
    },

    updateWsStatus(status) {
        const btn = document.getElementById('connectWs');
        const indicator = document.getElementById('wsStatus');
        
        if (btn) {
            btn.innerHTML = status === 'connected' 
                ? '<i class="fas fa-unlink"></i> Disconnect' 
                : '<i class="fas fa-link"></i> Connect';
            btn.classList.toggle('btn-danger', status === 'connected');
            btn.classList.toggle('btn-primary', status !== 'connected');
        }
        
        if (indicator) {
            indicator.className = `ws-indicator ws-${status}`;
            indicator.title = status === 'connected' ? 'WebSocket Connected' : 'WebSocket Disconnected';
        }
    },

    // Subscribe to active meetings
    subscribeToActiveMeetings() {
        if (!this.state.wsConnected || this.state.activeBots.length === 0) return;

        const meetings = this.state.activeBots.map(bot => ({
            platform: bot.platform,
            native_id: bot.native_meeting_id || bot.meeting_id
        }));

        this.sendWsMessage({
            action: 'subscribe',
            meetings: meetings
        });
    },

    // Subscribe to a specific meeting
    subscribeToMeeting(platform, meetingId) {
        if (!this.state.wsConnected) {
            // Connect first, then subscribe
            this.connectWebSocket();
            setTimeout(() => {
                if (this.state.wsConnected) {
                    this.sendWsMessage({
                        action: 'subscribe',
                        meetings: [{ platform, native_id: meetingId }]
                    });
                }
            }, 1000);
        } else {
            this.sendWsMessage({
                action: 'subscribe',
                meetings: [{ platform, native_id: meetingId }]
            });
        }
        
        this.showNotification(`Subscribed to live updates for ${platform}/${meetingId}`, 'success');
    },

    // Send WebSocket message
    sendWsMessage(message) {
        if (this.state.websocket && this.state.wsConnected) {
            this.state.websocket.send(JSON.stringify(message));
        }
    },

    // Handle WebSocket messages
    handleWsMessage(data) {
        console.log('WebSocket message:', data);

        // Handle different message types
        if (data.type === 'transcription' || data.channel?.includes('mutable')) {
            this.handleLiveTranscription(data);
        } else if (data.type === 'status' || data.channel?.includes('status')) {
            this.handleStatusUpdate(data);
        } else if (data.type === 'subscribed') {
            console.log('Successfully subscribed to:', data.meetings);
        } else if (data.segments) {
            // Direct segment data
            this.handleLiveTranscription(data);
        }
    },

    // Handle live transcription updates
    handleLiveTranscription(data) {
        const meetingId = data.meeting_id || data.native_meeting_id;
        const segments = data.segments || [data];

        if (!this.state.liveTranscriptions[meetingId]) {
            this.state.liveTranscriptions[meetingId] = [];
        }

        this.state.liveTranscriptions[meetingId].push(...segments);

        // Update UI if viewing this meeting
        if (this.state.selectedMeeting?.meetingId === meetingId) {
            this.renderTranscription(this.state.liveTranscriptions[meetingId]);
        }

        // Show notification for new transcription
        if (segments.length > 0 && segments[0].text) {
            this.showLiveIndicator(segments[0].speaker, segments[0].text);
        }
    },

    // Handle status updates
    handleStatusUpdate(data) {
        console.log('Status update:', data);
        
        // Refresh active bots on status change
        this.refreshActiveBots();
        
        // Show notification
        if (data.status) {
            this.showNotification(`Bot status: ${data.status}`, 'info');
        }
    },

    // Show live transcription indicator
    showLiveIndicator(speaker, text) {
        const indicator = document.getElementById('liveIndicator');
        if (indicator) {
            indicator.innerHTML = `
                <div class="live-segment">
                    <span class="live-badge"><i class="fas fa-circle"></i> LIVE</span>
                    <strong>${speaker || 'Unknown'}:</strong> ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}
                </div>
            `;
            indicator.classList.remove('hidden');
            
            // Hide after 5 seconds
            setTimeout(() => indicator.classList.add('hidden'), 5000);
        }
    },

    // Show notification
    showNotification(message, type = 'info') {
        const container = document.getElementById('notifications') || this.createNotificationContainer();
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => notification.remove(), 5000);
    },

    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notifications';
        container.className = 'notifications-container';
        document.body.appendChild(container);
        return container;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => app.init());
