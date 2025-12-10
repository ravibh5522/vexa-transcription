/**
 * Vexa Dashboard - Real-time Meeting Transcription
 * 
 * API Endpoints (via api-gateway):
 * - POST /bots                              - Request new bot
 * - GET /bots/status                        - Get running bots (returns {running_bots: [...]})
 * - DELETE /bots/{platform}/{native_meeting_id} - Stop a bot
 * - PUT /bots/{platform}/{native_meeting_id}/config - Update bot config
 * - GET /meetings                           - List meetings (returns {meetings: [...]})
 * - GET /transcripts/{platform}/{native_meeting_id} - Get transcript (returns {segments: [...], ...})
 * - PATCH /meetings/{platform}/{native_meeting_id} - Update meeting data
 * - DELETE /meetings/{platform}/{native_meeting_id} - Delete meeting data
 * - PUT /user/webhook                       - Set webhook URL
 * 
 * WebSocket /ws:
 * - Auth via query param: ?api_key=XXX or header X-API-Key
 * - Subscribe: {action: "subscribe", meetings: [{platform, native_id}, ...]}
 * - Message types: transcript.mutable, meeting.status, subscribed, error
 */

// Application State
const state = {
    isLoggedIn: false,
    isAdmin: false,
    apiKey: '',
    baseUrl: '',
    adminToken: '',
    adminUrl: '',
    activeBots: [],
    meetings: [],
    currentMeeting: null,
    ws: null,
    wsConnected: false,
    transcriptByAbsStart: {}, // Keyed by absolute_start_time for deduplication
};

// DOM Elements cache
const elements = {};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

function init() {
    cacheElements();
    setupEventListeners();
    loadSavedCredentials();
}

function cacheElements() {
    // Screens
    elements.loginScreen = document.getElementById('loginScreen');
    elements.dashboardScreen = document.getElementById('dashboardScreen');
    elements.meetingsScreen = document.getElementById('meetingsScreen');
    elements.settingsScreen = document.getElementById('settingsScreen');
    
    // Navigation
    elements.mainNav = document.getElementById('mainNav');
    elements.dashboardBtn = document.getElementById('dashboardBtn');
    elements.meetingsBtn = document.getElementById('meetingsBtn');
    elements.settingsBtn = document.getElementById('settingsBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
    
    // Login forms
    elements.userLoginForm = document.getElementById('userLoginForm');
    elements.adminLoginForm = document.getElementById('adminLoginForm');
    elements.userApiKey = document.getElementById('userApiKey');
    elements.userBaseUrl = document.getElementById('userBaseUrl');
    elements.adminToken = document.getElementById('adminToken');
    elements.adminBaseUrl = document.getElementById('adminBaseUrl');
    
    // Dashboard
    elements.dashboardTitle = document.getElementById('dashboardTitle');
    elements.userDashboard = document.getElementById('userDashboard');
    elements.adminDashboard = document.getElementById('adminDashboard');
    elements.activeBots = document.getElementById('activeBots');
    elements.totalMeetings = document.getElementById('totalMeetings');
    elements.completedMeetings = document.getElementById('completedMeetings');
    elements.failedMeetings = document.getElementById('failedMeetings');
    elements.activeBotsList = document.getElementById('activeBotsList');
    elements.newBotBtn = document.getElementById('newBotBtn');
    
    // Meetings
    elements.meetingsList = document.getElementById('meetingsList');
    elements.statusFilter = document.getElementById('statusFilter');
    elements.platformFilter = document.getElementById('platformFilter');
    
    // Settings
    elements.displayApiKey = document.getElementById('displayApiKey');
    elements.displayServerUrl = document.getElementById('displayServerUrl');
    elements.toggleApiKey = document.getElementById('toggleApiKey');
    elements.copyApiKey = document.getElementById('copyApiKey');
    elements.webhookUrl = document.getElementById('webhookUrl');
    elements.saveWebhookBtn = document.getElementById('saveWebhookBtn');
    
    // Modals
    elements.newBotModal = document.getElementById('newBotModal');
    elements.newBotForm = document.getElementById('newBotForm');
    elements.transcriptModal = document.getElementById('transcriptModal');
    elements.transcriptContent = document.getElementById('transcriptContent');
    elements.liveTranscriptBtn = document.getElementById('liveTranscriptBtn');
    elements.downloadTranscriptBtn = document.getElementById('downloadTranscriptBtn');
    elements.createUserModal = document.getElementById('createUserModal');
    elements.createUserForm = document.getElementById('createUserForm');
    
    // New Bot Form fields
    elements.platform = document.getElementById('platform');
    elements.meetingId = document.getElementById('meetingId');
    elements.passcodeGroup = document.getElementById('passcodeGroup');
    elements.passcode = document.getElementById('passcode');
    elements.language = document.getElementById('language');
    elements.botName = document.getElementById('botName');
    
    // Loading and Toast
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.toastContainer = document.getElementById('toastContainer');
}

function setupEventListeners() {
    // Login tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
            e.target.classList.add('active');
            document.getElementById(`${tab}LoginForm`).classList.add('active');
        });
    });
    
    // Login forms
    elements.userLoginForm?.addEventListener('submit', handleUserLogin);
    elements.adminLoginForm?.addEventListener('submit', handleAdminLogin);
    
    // Navigation
    elements.dashboardBtn?.addEventListener('click', () => showScreen('dashboard'));
    elements.meetingsBtn?.addEventListener('click', () => showScreen('meetings'));
    elements.settingsBtn?.addEventListener('click', () => showScreen('settings'));
    elements.logoutBtn?.addEventListener('click', handleLogout);
    
    // New Bot
    elements.newBotBtn?.addEventListener('click', () => openModal('newBotModal'));
    elements.newBotForm?.addEventListener('submit', handleCreateBot);
    elements.platform?.addEventListener('change', handlePlatformChange);
    
    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) modal.classList.remove('active');
        });
    });
    
    // Close modal on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
    
    // Filters
    elements.statusFilter?.addEventListener('change', filterMeetings);
    elements.platformFilter?.addEventListener('change', filterMeetings);
    
    // Settings
    elements.toggleApiKey?.addEventListener('click', toggleApiKeyVisibility);
    elements.copyApiKey?.addEventListener('click', copyApiKeyToClipboard);
    elements.saveWebhookBtn?.addEventListener('click', handleSaveWebhook);
    
    // Transcript modal
    elements.liveTranscriptBtn?.addEventListener('click', toggleLiveTranscript);
    elements.downloadTranscriptBtn?.addEventListener('click', downloadTranscript);
    
    // Admin
    document.getElementById('createUserBtn')?.addEventListener('click', () => openModal('createUserModal'));
    elements.createUserForm?.addEventListener('submit', handleCreateUser);
    document.getElementById('viewAllUsersBtn')?.addEventListener('click', loadAllUsers);
    document.getElementById('viewAllMeetingsBtn')?.addEventListener('click', loadAllMeetings);
}

function loadSavedCredentials() {
    const savedApiKey = localStorage.getItem('vexa_api_key');
    const savedBaseUrl = localStorage.getItem('vexa_base_url');
    const savedAdminToken = localStorage.getItem('vexa_admin_token');
    const savedAdminUrl = localStorage.getItem('vexa_admin_url');
    
    if (savedApiKey && savedBaseUrl) {
        state.apiKey = savedApiKey;
        state.baseUrl = savedBaseUrl;
        state.isLoggedIn = true;
        state.isAdmin = false;
        showApp();
    } else if (savedAdminToken && savedAdminUrl) {
        state.adminToken = savedAdminToken;
        state.adminUrl = savedAdminUrl;
        state.isLoggedIn = true;
        state.isAdmin = true;
        showApp();
    }
}

// ==================== Authentication ====================

async function handleUserLogin(e) {
    e.preventDefault();
    const apiKey = elements.userApiKey.value.trim();
    const baseUrl = elements.userBaseUrl.value.trim().replace(/\/$/, '');
    
    if (!apiKey || !baseUrl) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // Test the connection by fetching bots status
        const response = await apiRequest('GET', '/bots/status', null, apiKey, baseUrl);
        
        // If we get here, credentials are valid
        state.apiKey = apiKey;
        state.baseUrl = baseUrl;
        state.isLoggedIn = true;
        state.isAdmin = false;
        
        localStorage.setItem('vexa_api_key', apiKey);
        localStorage.setItem('vexa_base_url', baseUrl);
        
        showToast('Login successful!', 'success');
        showApp();
    } catch (error) {
        showToast(`Login failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function handleAdminLogin(e) {
    e.preventDefault();
    const adminToken = elements.adminToken.value.trim();
    const adminUrl = elements.adminBaseUrl.value.trim().replace(/\/$/, '');
    
    if (!adminToken || !adminUrl) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // Test admin connection
        const response = await fetch(`${adminUrl}/admin/users`, {
            headers: { 'X-Admin-API-Key': adminToken }
        });
        
        if (!response.ok) {
            throw new Error('Invalid admin credentials');
        }
        
        state.adminToken = adminToken;
        state.adminUrl = adminUrl;
        state.isLoggedIn = true;
        state.isAdmin = true;
        
        localStorage.setItem('vexa_admin_token', adminToken);
        localStorage.setItem('vexa_admin_url', adminUrl);
        
        showToast('Admin login successful!', 'success');
        showApp();
    } catch (error) {
        showToast(`Admin login failed: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function handleLogout() {
    // Disconnect WebSocket
    if (state.ws) {
        state.ws.close();
        state.ws = null;
        state.wsConnected = false;
    }
    
    // Clear state
    state.isLoggedIn = false;
    state.isAdmin = false;
    state.apiKey = '';
    state.baseUrl = '';
    state.adminToken = '';
    state.adminUrl = '';
    state.activeBots = [];
    state.meetings = [];
    
    // Clear storage
    localStorage.removeItem('vexa_api_key');
    localStorage.removeItem('vexa_base_url');
    localStorage.removeItem('vexa_admin_token');
    localStorage.removeItem('vexa_admin_url');
    
    // Clear forms
    elements.userApiKey.value = '';
    elements.adminToken.value = '';
    
    // Show login screen
    showScreen('login');
    elements.mainNav.classList.add('hidden');
    
    showToast('Logged out successfully', 'success');
}

// ==================== API Requests ====================

async function apiRequest(method, endpoint, body = null, apiKey = null, baseUrl = null) {
    const url = `${baseUrl || state.baseUrl}${endpoint}`;
    const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey || state.apiKey
    };
    
    const options = { method, headers };
    
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
    }
    
    return response.json();
}

// ==================== Screen Navigation ====================

function showScreen(screen) {
    // Hide all screens
    elements.loginScreen?.classList.remove('active');
    elements.dashboardScreen?.classList.remove('active');
    elements.meetingsScreen?.classList.remove('active');
    elements.settingsScreen?.classList.remove('active');
    
    // Remove active from nav buttons
    elements.dashboardBtn?.classList.remove('active');
    elements.meetingsBtn?.classList.remove('active');
    elements.settingsBtn?.classList.remove('active');
    
    // Show requested screen
    switch (screen) {
        case 'login':
            elements.loginScreen?.classList.add('active');
            break;
        case 'dashboard':
            elements.dashboardScreen?.classList.add('active');
            elements.dashboardBtn?.classList.add('active');
            loadDashboard();
            break;
        case 'meetings':
            elements.meetingsScreen?.classList.add('active');
            elements.meetingsBtn?.classList.add('active');
            loadMeetings();
            break;
        case 'settings':
            elements.settingsScreen?.classList.add('active');
            elements.settingsBtn?.classList.add('active');
            loadSettings();
            break;
    }
}

function showApp() {
    elements.mainNav.classList.remove('hidden');
    
    if (state.isAdmin) {
        elements.dashboardTitle.textContent = 'Admin Dashboard';
        elements.userDashboard.classList.add('hidden');
        elements.adminDashboard.classList.remove('hidden');
        elements.newBotBtn.classList.add('hidden');
        document.getElementById('webhookSection')?.classList.add('hidden');
    } else {
        elements.dashboardTitle.textContent = 'Dashboard';
        elements.userDashboard.classList.remove('hidden');
        elements.adminDashboard.classList.add('hidden');
        elements.newBotBtn.classList.remove('hidden');
        document.getElementById('webhookSection')?.classList.remove('hidden');
    }
    
    showScreen('dashboard');
}

// ==================== Dashboard ====================

async function loadDashboard() {
    if (state.isAdmin) {
        loadAdminDashboard();
        return;
    }
    
    showLoading();
    
    try {
        // Fetch bots status and meetings in parallel
        const [botsResponse, meetingsResponse] = await Promise.all([
            apiRequest('GET', '/bots/status'),
            apiRequest('GET', '/meetings')
        ]);
        
        // Parse running_bots from response
        state.activeBots = botsResponse.running_bots || [];
        state.meetings = meetingsResponse.meetings || [];
        
        // Update stats
        updateDashboardStats();
        
        // Render active bots
        renderActiveBots();
        
    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showToast(`Failed to load dashboard: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function updateDashboardStats() {
    elements.activeBots.textContent = state.activeBots.length;
    elements.totalMeetings.textContent = state.meetings.length;
    elements.completedMeetings.textContent = state.meetings.filter(m => m.status === 'completed').length;
    elements.failedMeetings.textContent = state.meetings.filter(m => m.status === 'failed').length;
}

function renderActiveBots() {
    if (!elements.activeBotsList) return;
    
    if (state.activeBots.length === 0) {
        elements.activeBotsList.innerHTML = `
            <div class="empty-state">
                <p>No active bots</p>
                <small>Click "New Bot" to start a transcription</small>
            </div>
        `;
        return;
    }
    
    elements.activeBotsList.innerHTML = state.activeBots.map(bot => `
        <div class="bot-card" data-platform="${bot.platform}" data-meeting-id="${bot.native_meeting_id}">
            <div class="bot-info">
                <span class="platform-badge ${bot.platform}">${formatPlatform(bot.platform)}</span>
                <span class="meeting-id">${bot.native_meeting_id}</span>
                <span class="bot-status status-${bot.normalized_status || bot.status}">${bot.normalized_status || bot.status}</span>
            </div>
            <div class="bot-meta">
                ${bot.container_name ? `<small>Container: ${bot.container_name}</small>` : ''}
                ${bot.created_at ? `<small>Started: ${formatDate(bot.created_at)}</small>` : ''}
            </div>
            <div class="bot-actions">
                <button class="btn btn-secondary btn-sm" onclick="viewTranscript('${bot.platform}', '${bot.native_meeting_id}')">
                    View Transcript
                </button>
                <button class="btn btn-danger btn-sm" onclick="stopBot('${bot.platform}', '${bot.native_meeting_id}')">
                    Stop Bot
                </button>
            </div>
        </div>
    `).join('');
}

async function loadAdminDashboard() {
    try {
        const response = await fetch(`${state.adminUrl}/admin/users`, {
            headers: { 'X-Admin-API-Key': state.adminToken }
        });
        
        if (response.ok) {
            const users = await response.json();
            document.getElementById('adminTotalUsers').textContent = users.length;
        }
    } catch (error) {
        console.error('Failed to load admin dashboard:', error);
    }
}

// ==================== Meetings ====================

async function loadMeetings() {
    if (state.isAdmin) return;
    
    showLoading();
    
    try {
        const response = await apiRequest('GET', '/meetings');
        state.meetings = response.meetings || [];
        renderMeetings();
    } catch (error) {
        showToast(`Failed to load meetings: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

function renderMeetings() {
    if (!elements.meetingsList) return;
    
    const statusFilter = elements.statusFilter?.value || 'all';
    const platformFilter = elements.platformFilter?.value || 'all';
    
    let filtered = [...state.meetings];
    
    if (statusFilter !== 'all') {
        filtered = filtered.filter(m => m.status === statusFilter);
    }
    
    if (platformFilter !== 'all') {
        filtered = filtered.filter(m => m.platform === platformFilter);
    }
    
    if (filtered.length === 0) {
        elements.meetingsList.innerHTML = `
            <div class="empty-state">
                <p>No meetings found</p>
            </div>
        `;
        return;
    }
    
    elements.meetingsList.innerHTML = filtered.map(meeting => `
        <div class="meeting-card" data-id="${meeting.id}">
            <div class="meeting-header">
                <span class="platform-badge ${meeting.platform}">${formatPlatform(meeting.platform)}</span>
                <span class="meeting-status status-${meeting.status}">${meeting.status}</span>
            </div>
            <div class="meeting-info">
                <p><strong>Meeting ID:</strong> ${meeting.platform_specific_id || meeting.native_meeting_id}</p>
                ${meeting.data?.name ? `<p><strong>Name:</strong> ${meeting.data.name}</p>` : ''}
                <p><strong>Created:</strong> ${formatDate(meeting.created_at)}</p>
                ${meeting.start_time ? `<p><strong>Started:</strong> ${formatDate(meeting.start_time)}</p>` : ''}
                ${meeting.end_time ? `<p><strong>Ended:</strong> ${formatDate(meeting.end_time)}</p>` : ''}
            </div>
            <div class="meeting-actions">
                <button class="btn btn-primary btn-sm" onclick="viewTranscript('${meeting.platform}', '${meeting.platform_specific_id}')">
                    View Transcript
                </button>
                ${meeting.status === 'active' || meeting.status === 'requested' ? `
                    <button class="btn btn-danger btn-sm" onclick="stopBot('${meeting.platform}', '${meeting.platform_specific_id}')">
                        Stop
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function filterMeetings() {
    renderMeetings();
}

// ==================== Bot Management ====================

function handlePlatformChange() {
    const platform = elements.platform.value;
    const passcodeGroup = elements.passcodeGroup;
    const meetingIdHint = document.getElementById('meetingIdHint');
    
    if (platform === 'teams') {
        passcodeGroup.style.display = 'block';
        elements.passcode.required = true;
        meetingIdHint.textContent = 'Enter numeric meeting ID (e.g., 9387167464734)';
    } else {
        passcodeGroup.style.display = 'none';
        elements.passcode.required = false;
        meetingIdHint.textContent = 'Enter meeting code (e.g., abc-defg-hij)';
    }
}

async function handleCreateBot(e) {
    e.preventDefault();
    
    const platform = elements.platform.value;
    const nativeMeetingId = elements.meetingId.value.trim();
    const passcode = elements.passcode.value.trim();
    const language = elements.language.value;
    const botName = elements.botName.value.trim();
    
    if (!platform || !nativeMeetingId) {
        showToast('Please fill in required fields', 'error');
        return;
    }
    
    if (platform === 'teams' && !passcode) {
        showToast('Passcode is required for Microsoft Teams', 'error');
        return;
    }
    
    const payload = {
        platform: platform,
        native_meeting_id: nativeMeetingId
    };
    
    if (platform === 'teams' && passcode) {
        payload.passcode = passcode;
    }
    
    if (language) {
        payload.language = language;
    }
    
    if (botName) {
        payload.bot_name = botName;
    }
    
    showLoading();
    
    try {
        const response = await apiRequest('POST', '/bots', payload);
        
        showToast('Bot requested successfully!', 'success');
        closeModal('newBotModal');
        elements.newBotForm.reset();
        
        // Refresh dashboard after a delay to allow bot to start
        setTimeout(() => loadDashboard(), 2000);
        
    } catch (error) {
        showToast(`Failed to create bot: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

async function stopBot(platform, nativeMeetingId) {
    if (!confirm(`Are you sure you want to stop the bot for ${platform}/${nativeMeetingId}?`)) {
        return;
    }
    
    showLoading();
    
    try {
        await apiRequest('DELETE', `/bots/${platform}/${nativeMeetingId}`);
        showToast('Bot stop requested', 'success');
        
        // Refresh dashboard
        setTimeout(() => loadDashboard(), 1000);
        
    } catch (error) {
        showToast(`Failed to stop bot: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// ==================== Transcripts ====================

async function viewTranscript(platform, nativeMeetingId) {
    state.currentMeeting = { platform, nativeMeetingId };
    state.transcriptByAbsStart = {}; // Reset transcript cache
    
    openModal('transcriptModal');
    elements.transcriptContent.innerHTML = '<div class="loading-spinner">Loading transcript...</div>';
    
    try {
        const response = await apiRequest('GET', `/transcripts/${platform}/${nativeMeetingId}`);
        const segments = response.segments || [];
        
        // Store segments by absolute_start_time for deduplication
        segments.forEach(seg => {
            if (seg.absolute_start_time) {
                state.transcriptByAbsStart[seg.absolute_start_time] = seg;
            }
        });
        
        renderTranscript();
        
    } catch (error) {
        elements.transcriptContent.innerHTML = `<div class="error-state">Failed to load transcript: ${error.message}</div>`;
    }
}

function renderTranscript() {
    const segments = Object.values(state.transcriptByAbsStart)
        .sort((a, b) => new Date(a.absolute_start_time) - new Date(b.absolute_start_time));
    
    if (segments.length === 0) {
        elements.transcriptContent.innerHTML = `
            <div class="empty-state">
                <p>No transcript available yet</p>
                <small>Transcript will appear here as the meeting progresses</small>
            </div>
        `;
        return;
    }
    
    // Group consecutive segments by speaker
    const groups = groupBySpeaker(segments);
    
    elements.transcriptContent.innerHTML = groups.map(group => `
        <div class="transcript-segment">
            <div class="segment-header">
                <span class="speaker">${group.speaker}</span>
                <span class="time">${formatTime(group.startTime)} - ${formatTime(group.endTime)}</span>
            </div>
            <div class="segment-text">${escapeHtml(group.text)}</div>
        </div>
    `).join('');
    
    // Scroll to bottom
    elements.transcriptContent.scrollTop = elements.transcriptContent.scrollHeight;
}

function groupBySpeaker(segments) {
    const groups = [];
    let currentGroup = null;
    
    for (const segment of segments) {
        const speaker = segment.speaker || 'Unknown';
        const text = (segment.text || '').trim();
        
        if (!text) continue;
        
        if (currentGroup && currentGroup.speaker === speaker) {
            currentGroup.text += ' ' + text;
            currentGroup.endTime = segment.absolute_end_time;
        } else {
            if (currentGroup) {
                groups.push(currentGroup);
            }
            currentGroup = {
                speaker: speaker,
                text: text,
                startTime: segment.absolute_start_time,
                endTime: segment.absolute_end_time
            };
        }
    }
    
    if (currentGroup) {
        groups.push(currentGroup);
    }
    
    return groups;
}

function toggleLiveTranscript() {
    if (state.wsConnected) {
        disconnectWebSocket();
        elements.liveTranscriptBtn.textContent = 'Live Updates';
        elements.liveTranscriptBtn.classList.remove('active');
    } else {
        connectWebSocket();
        elements.liveTranscriptBtn.textContent = 'Stop Live';
        elements.liveTranscriptBtn.classList.add('active');
    }
}

function downloadTranscript() {
    if (!state.currentMeeting) return;
    
    const segments = Object.values(state.transcriptByAbsStart)
        .sort((a, b) => new Date(a.absolute_start_time) - new Date(b.absolute_start_time));
    
    const groups = groupBySpeaker(segments);
    
    const text = groups.map(g => 
        `[${formatTime(g.startTime)}] ${g.speaker}: ${g.text}`
    ).join('\n\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${state.currentMeeting.platform}_${state.currentMeeting.nativeMeetingId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

// ==================== WebSocket ====================

function connectWebSocket() {
    if (!state.currentMeeting) return;
    
    const wsProtocol = state.baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = state.baseUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/ws?api_key=${encodeURIComponent(state.apiKey)}`;
    
    try {
        state.ws = new WebSocket(wsUrl);
        
        state.ws.onopen = () => {
            state.wsConnected = true;
            console.log('WebSocket connected');
            
            // Subscribe to current meeting
            const subscribeMsg = {
                action: 'subscribe',
                meetings: [{
                    platform: state.currentMeeting.platform,
                    native_id: state.currentMeeting.nativeMeetingId
                }]
            };
            state.ws.send(JSON.stringify(subscribeMsg));
        };
        
        state.ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleWebSocketMessage(msg);
            } catch (e) {
                console.error('Failed to parse WS message:', e);
            }
        };
        
        state.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            showToast('WebSocket connection error', 'error');
        };
        
        state.ws.onclose = () => {
            state.wsConnected = false;
            state.ws = null;
            console.log('WebSocket disconnected');
            elements.liveTranscriptBtn.textContent = 'Live Updates';
            elements.liveTranscriptBtn.classList.remove('active');
        };
        
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        showToast('Failed to connect to live updates', 'error');
    }
}

function disconnectWebSocket() {
    if (state.ws) {
        state.ws.close();
        state.ws = null;
    }
    state.wsConnected = false;
}

function handleWebSocketMessage(msg) {
    console.log('WS message:', msg);
    
    switch (msg.type) {
        case 'transcript.mutable':
            handleTranscriptMutable(msg);
            break;
        case 'meeting.status':
            handleMeetingStatus(msg);
            break;
        case 'subscribed':
            console.log('Subscribed to meetings:', msg.meetings);
            break;
        case 'error':
            console.error('WS error:', msg.error);
            showToast(`WebSocket error: ${msg.error}`, 'error');
            break;
    }
}

function handleTranscriptMutable(msg) {
    const segments = msg.payload?.segments || [];
    
    for (const segment of segments) {
        const absStart = segment.absolute_start_time;
        if (!absStart) continue;
        
        const text = (segment.text || '').trim();
        if (!text) continue;
        
        // Check if we should update (newer updated_at wins)
        const existing = state.transcriptByAbsStart[absStart];
        if (existing && existing.updated_at && segment.updated_at) {
            if (new Date(segment.updated_at) < new Date(existing.updated_at)) {
                continue; // Keep existing (it's newer)
            }
        }
        
        state.transcriptByAbsStart[absStart] = segment;
    }
    
    // Re-render transcript
    renderTranscript();
}

function handleMeetingStatus(msg) {
    const status = msg.payload?.status;
    if (status) {
        showToast(`Meeting status: ${status}`, 'info');
        
        // Refresh dashboard if meeting completed/failed
        if (status === 'completed' || status === 'failed') {
            loadDashboard();
        }
    }
}

// ==================== Settings ====================

function loadSettings() {
    if (elements.displayApiKey) {
        elements.displayApiKey.value = state.apiKey;
    }
    if (elements.displayServerUrl) {
        elements.displayServerUrl.value = state.baseUrl;
    }
}

function toggleApiKeyVisibility() {
    const input = elements.displayApiKey;
    input.type = input.type === 'password' ? 'text' : 'password';
}

function copyApiKeyToClipboard() {
    navigator.clipboard.writeText(state.apiKey)
        .then(() => showToast('API key copied to clipboard', 'success'))
        .catch(() => showToast('Failed to copy API key', 'error'));
}

async function handleSaveWebhook() {
    const webhookUrl = elements.webhookUrl.value.trim();
    
    if (!webhookUrl) {
        showToast('Please enter a webhook URL', 'error');
        return;
    }
    
    showLoading();
    
    try {
        await apiRequest('PUT', '/user/webhook', { webhook_url: webhookUrl });
        showToast('Webhook saved successfully', 'success');
    } catch (error) {
        showToast(`Failed to save webhook: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// ==================== Admin Functions ====================

async function handleCreateUser(e) {
    e.preventDefault();
    
    const payload = {
        email: document.getElementById('userEmail').value.trim(),
        name: document.getElementById('userName').value.trim() || undefined,
        image_url: document.getElementById('userImageUrl').value.trim() || undefined,
        max_concurrent_bots: parseInt(document.getElementById('maxConcurrentBots').value) || 5
    };
    
    try {
        const response = await fetch(`${state.adminUrl}/admin/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-API-Key': state.adminToken
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create user');
        }
        
        const user = await response.json();
        showToast(`User created! API Token: ${user.token}`, 'success');
        closeModal('createUserModal');
        elements.createUserForm.reset();
        loadAdminDashboard();
        
    } catch (error) {
        showToast(`Failed to create user: ${error.message}`, 'error');
    }
}

async function loadAllUsers() {
    try {
        const response = await fetch(`${state.adminUrl}/admin/users`, {
            headers: { 'X-Admin-API-Key': state.adminToken }
        });
        
        if (!response.ok) throw new Error('Failed to load users');
        
        const users = await response.json();
        
        const content = document.getElementById('adminContent');
        content.innerHTML = `
            <h3>All Users (${users.length})</h3>
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Max Bots</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${u.id}</td>
                            <td>${u.email}</td>
                            <td>${u.name || '-'}</td>
                            <td>${u.max_concurrent_bots || 'unlimited'}</td>
                            <td>${formatDate(u.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (error) {
        showToast(`Failed to load users: ${error.message}`, 'error');
    }
}

async function loadAllMeetings() {
    // Admin meetings endpoint if available
    const content = document.getElementById('adminContent');
    content.innerHTML = '<p>Meeting admin view not yet implemented</p>';
}

// ==================== Utilities ====================

function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

// Global function for inline onclick handlers
window.closeModal = closeModal;
window.viewTranscript = viewTranscript;
window.stopBot = stopBot;

function showLoading() {
    elements.loadingOverlay?.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay?.classList.add('hidden');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    elements.toastContainer?.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function formatPlatform(platform) {
    const names = {
        'google_meet': 'Google Meet',
        'teams': 'Microsoft Teams'
    };
    return names[platform] || platform;
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        return new Date(dateStr).toLocaleString();
    } catch {
        return dateStr;
    }
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    try {
        return new Date(timeStr).toLocaleTimeString();
    } catch {
        return timeStr;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
