// Global State
const state = {
    isAdmin: false,
    apiKey: null,
    adminToken: null,
    baseUrl: null,
    adminBaseUrl: null,
    currentUser: null,
    activeBots: [],
    meetings: [],
    transcriptWebSocket: null,
    autoRefreshInterval: null
};

// Utility Functions
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
}

function formatDuration(seconds) {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
}

// API Functions
async function apiRequest(url, options = {}) {
    // Remove trailing slash from URL to prevent double slashes
    url = url.replace(/\/+$/, '');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (state.apiKey && !state.isAdmin) {
        headers['X-API-Key'] = state.apiKey;
    } else if (state.adminToken && state.isAdmin) {
        headers['X-Admin-API-Key'] = state.adminToken;
    }

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// User Login
document.getElementById('userLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const apiKey = document.getElementById('userApiKey').value.trim();
    let baseUrl = document.getElementById('userBaseUrl').value.trim();
    
    // Remove trailing slash
    baseUrl = baseUrl.replace(/\/+$/, '');

    try {
        // Test the API key by fetching bot status
        const response = await fetch(`${baseUrl}/bots/status`, {
            headers: {
                'X-API-Key': apiKey
            }
        });

        if (!response.ok) {
            throw new Error('Invalid API key or server URL');
        }

        state.apiKey = apiKey;
        state.baseUrl = baseUrl;
        state.isAdmin = false;

        localStorage.setItem('userApiKey', apiKey);
        localStorage.setItem('userBaseUrl', baseUrl);

        showToast('Login successful!', 'success');
        showUserDashboard();
        loadUserDashboard();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Admin Login
document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const adminToken = document.getElementById('adminToken').value.trim();
    let adminBaseUrl = document.getElementById('adminBaseUrl').value.trim();
    
    // Remove trailing slash
    adminBaseUrl = adminBaseUrl.replace(/\/+$/, '');

    try {
        // Test the admin token by fetching users
        const response = await fetch(`${adminBaseUrl}/admin/users`, {
            headers: {
                'X-Admin-API-Key': adminToken
            }
        });

        if (!response.ok) {
            throw new Error('Invalid admin token or server URL');
        }

        state.adminToken = adminToken;
        state.adminBaseUrl = adminBaseUrl;
        state.isAdmin = true;

        localStorage.setItem('adminToken', adminToken);
        localStorage.setItem('adminBaseUrl', adminBaseUrl);

        showToast('Admin login successful!', 'success');
        showAdminDashboard();
        loadAdminDashboard();
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Tab Switching in Login
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${tab}LoginForm`).classList.add('active');
    });
});

// Show User Dashboard
function showUserDashboard() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('userDashboard').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    document.getElementById('newBotBtn').classList.remove('hidden');
}

// Show Admin Dashboard
function showAdminDashboard() {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboardScreen').classList.add('active');
    document.getElementById('mainNav').classList.remove('hidden');
    document.getElementById('userDashboard').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    document.getElementById('newBotBtn').classList.add('hidden');
}

// Load User Dashboard
async function loadUserDashboard() {
    showLoading();
    try {
        // Load bot status
        const botsStatus = await apiRequest(`${state.baseUrl}/bots/status`);
        state.activeBots = Array.isArray(botsStatus) ? botsStatus : [];

        // Load meetings
        const meetings = await apiRequest(`${state.baseUrl}/meetings`);
        state.meetings = Array.isArray(meetings) ? meetings : [];

        updateUserStats();
        renderActiveBots();
    } catch (error) {
        showToast('Failed to load dashboard: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Update User Stats
function updateUserStats() {
    document.getElementById('activeBots').textContent = state.activeBots.length;
    document.getElementById('totalMeetings').textContent = state.meetings.length;
    
    const completed = state.meetings.filter(m => m.status === 'completed').length;
    const failed = state.meetings.filter(m => m.status === 'failed').length;
    
    document.getElementById('completedMeetings').textContent = completed;
    document.getElementById('failedMeetings').textContent = failed;
}

// Render Active Bots
function renderActiveBots() {
    const container = document.getElementById('activeBotsList');
    
    if (state.activeBots.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No active bots. Click "New Bot" to start transcribing a meeting.</p>';
        return;
    }

    container.innerHTML = state.activeBots.map(bot => `
        <div class="bot-card">
            <div class="bot-card-header">
                <span class="bot-platform">${bot.platform || 'Unknown'}</span>
                <span class="bot-status ${(bot.status || '').toLowerCase()}">${bot.status || 'Unknown'}</span>
            </div>
            <div class="bot-info">
                <div class="bot-info-item"><strong>Meeting ID:</strong> ${bot.native_meeting_id || 'N/A'}</div>
                <div class="bot-info-item"><strong>Language:</strong> ${bot.language || 'Auto'}</div>
                <div class="bot-info-item"><strong>Started:</strong> ${formatDateTime(bot.start_time)}</div>
            </div>
            <div class="bot-actions">
                <button class="btn btn-secondary" onclick="viewTranscript('${bot.platform}', '${bot.native_meeting_id}')">View Transcript</button>
                <button class="btn btn-danger" onclick="stopBot('${bot.platform}', '${bot.native_meeting_id}')">Stop Bot</button>
            </div>
        </div>
    `).join('');
}

// Load Admin Dashboard
async function loadAdminDashboard() {
    showLoading();
    try {
        const users = await apiRequest(`${state.adminBaseUrl}/admin/users`);
        const meetings = await apiRequest(`${state.adminBaseUrl}/admin/stats/meetings-users?limit=1000`);

        document.getElementById('adminTotalUsers').textContent = users.length;
        document.getElementById('adminTotalMeetings').textContent = meetings.total || 0;
        
        const activeMeetings = meetings.items?.filter(m => 
            ['requested', 'joining', 'awaiting_admission', 'active'].includes(m.status)
        ).length || 0;
        document.getElementById('adminActiveMeetings').textContent = activeMeetings;
    } catch (error) {
        showToast('Failed to load admin dashboard: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Navigation
document.getElementById('dashboardBtn').addEventListener('click', () => {
    switchScreen('dashboardScreen');
    setActiveNav('dashboardBtn');
    if (state.isAdmin) {
        loadAdminDashboard();
    } else {
        loadUserDashboard();
    }
});

document.getElementById('meetingsBtn').addEventListener('click', () => {
    switchScreen('meetingsScreen');
    setActiveNav('meetingsBtn');
    loadMeetings();
});

document.getElementById('settingsBtn').addEventListener('click', () => {
    switchScreen('settingsScreen');
    setActiveNav('settingsBtn');
    loadSettings();
});

document.getElementById('logoutBtn').addEventListener('click', logout);

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function setActiveNav(btnId) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');
}

function logout() {
    localStorage.clear();
    state.apiKey = null;
    state.adminToken = null;
    state.isAdmin = false;
    state.activeBots = [];
    state.meetings = [];
    
    document.getElementById('mainNav').classList.add('hidden');
    switchScreen('loginScreen');
    showToast('Logged out successfully', 'info');
}

// New Bot Modal
document.getElementById('newBotBtn').addEventListener('click', () => {
    openModal('newBotModal');
});

// Platform change handler
document.getElementById('platform').addEventListener('change', (e) => {
    const passcodeGroup = document.getElementById('passcodeGroup');
    const meetingIdHint = document.getElementById('meetingIdHint');
    
    if (e.target.value === 'teams') {
        passcodeGroup.style.display = 'block';
        document.getElementById('passcode').required = true;
        meetingIdHint.textContent = 'Enter numeric meeting ID (e.g., 9387167464734)';
    } else {
        passcodeGroup.style.display = 'none';
        document.getElementById('passcode').required = false;
        meetingIdHint.textContent = 'Enter meeting code from URL (e.g., abc-defg-hij)';
    }
});

// New Bot Form Submit
document.getElementById('newBotForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const platform = document.getElementById('platform').value;
    const nativeMeetingId = document.getElementById('meetingId').value.trim();
    const language = document.getElementById('language').value;
    const botName = document.getElementById('botName').value.trim();
    const passcode = document.getElementById('passcode').value.trim();

    const payload = {
        platform,
        native_meeting_id: nativeMeetingId
    };

    if (language) payload.language = language;
    if (botName) payload.bot_name = botName;
    if (platform === 'teams' && passcode) payload.passcode = passcode;

    try {
        await apiRequest(`${state.baseUrl}/bots`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        showToast('Bot requested successfully! It will join the meeting in ~10 seconds.', 'success');
        closeModal('newBotModal');
        document.getElementById('newBotForm').reset();
        
        // Reload dashboard after 2 seconds
        setTimeout(() => loadUserDashboard(), 2000);
    } catch (error) {
        showToast('Failed to request bot: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Stop Bot
async function stopBot(platform, nativeMeetingId) {
    if (!confirm('Are you sure you want to stop this bot?')) return;

    showLoading();
    try {
        await apiRequest(`${state.baseUrl}/bots/${platform}/${nativeMeetingId}`, {
            method: 'DELETE'
        });

        showToast('Bot stopped successfully', 'success');
        loadUserDashboard();
    } catch (error) {
        showToast('Failed to stop bot: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// View Transcript
async function viewTranscript(platform, nativeMeetingId) {
    showLoading();
    try {
        const transcript = await apiRequest(`${state.baseUrl}/transcripts/${platform}/${nativeMeetingId}`);
        
        const content = document.getElementById('transcriptContent');
        
        if (!transcript.segments || transcript.segments.length === 0) {
            content.innerHTML = '<p style="color: var(--text-secondary);">No transcript available yet. The bot is still joining or waiting for speech.</p>';
        } else {
            content.innerHTML = transcript.segments.map(segment => `
                <div class="transcript-segment">
                    <div class="transcript-speaker">${segment.speaker || 'Unknown Speaker'}</div>
                    <div class="transcript-time">${formatDateTime(segment.absolute_start_time)}</div>
                    <div class="transcript-text">${segment.text}</div>
                </div>
            `).join('');
        }

        openModal('transcriptModal');
        
        // Store current transcript details for live updates
        state.currentTranscript = { platform, nativeMeetingId };
    } catch (error) {
        showToast('Failed to load transcript: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Download Transcript
document.getElementById('downloadTranscriptBtn').addEventListener('click', async () => {
    if (!state.currentTranscript) return;

    const { platform, nativeMeetingId } = state.currentTranscript;
    
    try {
        const transcript = await apiRequest(`${state.baseUrl}/transcripts/${platform}/${nativeMeetingId}`);
        
        const text = transcript.segments.map(s => 
            `[${formatDateTime(s.absolute_start_time)}] ${s.speaker || 'Unknown'}: ${s.text}`
        ).join('\n\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript_${platform}_${nativeMeetingId}_${new Date().toISOString()}.txt`;
        a.click();
        URL.revokeObjectURL(url);

        showToast('Transcript downloaded', 'success');
    } catch (error) {
        showToast('Failed to download transcript: ' + error.message, 'error');
    }
});

// Live Transcript Updates (WebSocket)
document.getElementById('liveTranscriptBtn').addEventListener('click', () => {
    if (!state.currentTranscript) return;

    const { platform, nativeMeetingId } = state.currentTranscript;
    const wsUrl = state.baseUrl.replace('http', 'ws') + '/ws';

    if (state.transcriptWebSocket) {
        state.transcriptWebSocket.close();
        state.transcriptWebSocket = null;
        document.getElementById('liveTranscriptBtn').textContent = 'Live Updates';
        showToast('Live updates stopped', 'info');
        return;
    }

    try {
        const ws = new WebSocket(wsUrl, ['X-API-Key', state.apiKey]);

        ws.onopen = () => {
            ws.send(JSON.stringify({
                action: 'subscribe',
                meetings: [{
                    platform: platform,
                    native_id: nativeMeetingId
                }]
            }));
            document.getElementById('liveTranscriptBtn').textContent = 'Stop Live Updates';
            showToast('Live updates started', 'success');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'transcript_update') {
                viewTranscript(platform, nativeMeetingId);
            }
        };

        ws.onerror = (error) => {
            showToast('WebSocket error', 'error');
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            document.getElementById('liveTranscriptBtn').textContent = 'Live Updates';
            state.transcriptWebSocket = null;
        };

        state.transcriptWebSocket = ws;
    } catch (error) {
        showToast('Failed to start live updates: ' + error.message, 'error');
    }
});

// Load Meetings
async function loadMeetings() {
    showLoading();
    try {
        const meetings = await apiRequest(`${state.baseUrl}/meetings`);
        state.meetings = Array.isArray(meetings) ? meetings : [];
        renderMeetings();
    } catch (error) {
        showToast('Failed to load meetings: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Render Meetings
function renderMeetings() {
    const statusFilter = document.getElementById('statusFilter').value;
    const platformFilter = document.getElementById('platformFilter').value;

    let filtered = state.meetings;

    if (statusFilter !== 'all') {
        filtered = filtered.filter(m => m.status === statusFilter);
    }

    if (platformFilter !== 'all') {
        filtered = filtered.filter(m => m.platform === platformFilter);
    }

    const container = document.getElementById('meetingsList');

    if (filtered.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No meetings found</p>';
        return;
    }

    container.innerHTML = filtered.map(meeting => `
        <div class="meeting-card ${meeting.status}">
            <div class="meeting-header">
                <div>
                    <div class="meeting-title">${meeting.data?.name || 'Meeting'}</div>
                    <div class="meeting-meta">
                        <span>📅 ${formatDateTime(meeting.created_at)}</span>
                        <span>🌐 ${meeting.platform}</span>
                        <span>🔢 ${meeting.native_meeting_id}</span>
                        <span class="bot-status ${meeting.status}">${meeting.status}</span>
                    </div>
                </div>
            </div>
            ${meeting.start_time && meeting.end_time ? `
                <div class="meeting-meta">
                    <span>⏱️ Duration: ${formatDuration((new Date(meeting.end_time) - new Date(meeting.start_time)) / 1000)}</span>
                </div>
            ` : ''}
            <div class="meeting-actions">
                <button class="btn btn-secondary" onclick="viewTranscript('${meeting.platform}', '${meeting.native_meeting_id}')">View Transcript</button>
                ${meeting.status === 'active' ? `
                    <button class="btn btn-danger" onclick="stopBot('${meeting.platform}', '${meeting.native_meeting_id}')">Stop Bot</button>
                ` : ''}
                ${meeting.status === 'completed' || meeting.status === 'failed' ? `
                    <button class="btn btn-danger" onclick="deleteMeeting('${meeting.platform}', '${meeting.native_meeting_id}')">Delete</button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Filter event listeners
document.getElementById('statusFilter').addEventListener('change', renderMeetings);
document.getElementById('platformFilter').addEventListener('change', renderMeetings);

// Delete Meeting
async function deleteMeeting(platform, nativeMeetingId) {
    if (!confirm('This will delete all transcripts and anonymize the meeting data. Continue?')) return;

    showLoading();
    try {
        await apiRequest(`${state.baseUrl}/meetings/${platform}/${nativeMeetingId}`, {
            method: 'DELETE'
        });

        showToast('Meeting deleted successfully', 'success');
        loadMeetings();
    } catch (error) {
        showToast('Failed to delete meeting: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Load Settings
function loadSettings() {
    if (state.isAdmin) {
        document.getElementById('webhookSection').style.display = 'none';
        document.getElementById('displayApiKey').value = state.adminToken;
        document.getElementById('displayServerUrl').value = state.adminBaseUrl;
    } else {
        document.getElementById('webhookSection').style.display = 'block';
        document.getElementById('displayApiKey').value = state.apiKey;
        document.getElementById('displayServerUrl').value = state.baseUrl;
    }
}

// Toggle API Key Visibility
document.getElementById('toggleApiKey').addEventListener('click', () => {
    const input = document.getElementById('displayApiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
});

// Copy API Key
document.getElementById('copyApiKey').addEventListener('click', () => {
    const input = document.getElementById('displayApiKey');
    input.select();
    document.execCommand('copy');
    showToast('API key copied to clipboard', 'success');
});

// Save Webhook
document.getElementById('saveWebhookBtn').addEventListener('click', async () => {
    const webhookUrl = document.getElementById('webhookUrl').value.trim();

    if (!webhookUrl) {
        showToast('Please enter a webhook URL', 'warning');
        return;
    }

    showLoading();
    try {
        await apiRequest(`${state.baseUrl}/user/webhook`, {
            method: 'PUT',
            body: JSON.stringify({ webhook_url: webhookUrl })
        });

        showToast('Webhook URL saved successfully', 'success');
    } catch (error) {
        showToast('Failed to save webhook: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Admin: Create User Button
document.getElementById('createUserBtn').addEventListener('click', () => {
    openModal('createUserModal');
});

// Admin: Create User Form
document.getElementById('createUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const payload = {
        email: document.getElementById('userEmail').value.trim(),
        name: document.getElementById('userName').value.trim() || null,
        image_url: document.getElementById('userImageUrl').value.trim() || null,
        max_concurrent_bots: parseInt(document.getElementById('maxConcurrentBots').value) || 5
    };

    try {
        const user = await apiRequest(`${state.adminBaseUrl}/admin/users`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // Generate API token
        const token = await apiRequest(`${state.adminBaseUrl}/admin/users/${user.id}/tokens`, {
            method: 'POST'
        });

        showToast(`User created! API Key: ${token.token}`, 'success');
        closeModal('createUserModal');
        document.getElementById('createUserForm').reset();
        loadAdminDashboard();

        // Show token to admin
        alert(`User Created!\n\nEmail: ${user.email}\nAPI Key: ${token.token}\n\nPlease save this API key securely.`);
    } catch (error) {
        showToast('Failed to create user: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Admin: View All Users
document.getElementById('viewAllUsersBtn').addEventListener('click', async () => {
    showLoading();
    try {
        const users = await apiRequest(`${state.adminBaseUrl}/admin/users`);

        const html = `
            <h3>All Users (${users.length})</h3>
            <table class="users-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Max Bots</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${u.id}</td>
                            <td>${u.email}</td>
                            <td>${u.name || 'N/A'}</td>
                            <td>${u.max_concurrent_bots}</td>
                            <td>${formatDateTime(u.created_at)}</td>
                            <td>
                                <button class="btn btn-secondary" onclick="viewUserDetails(${u.id})">Details</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('adminContent').innerHTML = html;
    } catch (error) {
        showToast('Failed to load users: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Admin: View User Details
async function viewUserDetails(userId) {
    showLoading();
    try {
        const user = await apiRequest(`${state.adminBaseUrl}/admin/analytics/users/${userId}/details?include_tokens=true&include_meetings=true`);

        const html = `
            <div class="user-details">
                <h4>User Information</h4>
                <p><strong>Email:</strong> ${user.user.email}</p>
                <p><strong>Name:</strong> ${user.user.name || 'N/A'}</p>
                <p><strong>Max Concurrent Bots:</strong> ${user.user.max_concurrent_bots}</p>
                <p><strong>Created:</strong> ${formatDateTime(user.user.created_at)}</p>

                <h4>Statistics</h4>
                <p><strong>Total Meetings:</strong> ${user.meeting_stats.total_meetings}</p>
                <p><strong>Completed:</strong> ${user.meeting_stats.completed_meetings}</p>
                <p><strong>Failed:</strong> ${user.meeting_stats.failed_meetings}</p>
                <p><strong>Active:</strong> ${user.meeting_stats.active_meetings}</p>
                <p><strong>Most Used Platform:</strong> ${user.usage_patterns.most_used_platform || 'N/A'}</p>

                <h4>API Tokens</h4>
                ${user.api_tokens && user.api_tokens.length > 0 ? `
                    <table class="users-table">
                        <thead>
                            <tr>
                                <th>Token</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${user.api_tokens.map(t => `
                                <tr>
                                    <td><code>${t.token.substring(0, 20)}...</code></td>
                                    <td>${formatDateTime(t.created_at)}</td>
                                    <td>
                                        <button class="btn btn-danger" onclick="deleteToken(${t.id})">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>No API tokens</p>'}

                <button class="btn btn-primary mt-2" onclick="generateTokenForUser(${userId})">Generate New Token</button>
            </div>
        `;

        document.getElementById('userDetailsContent').innerHTML = html;
        openModal('userDetailsModal');
    } catch (error) {
        showToast('Failed to load user details: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Admin: Generate Token for User
async function generateTokenForUser(userId) {
    showLoading();
    try {
        const token = await apiRequest(`${state.adminBaseUrl}/admin/users/${userId}/tokens`, {
            method: 'POST'
        });

        alert(`New API Token Generated:\n\n${token.token}\n\nPlease save this securely.`);
        viewUserDetails(userId); // Refresh
    } catch (error) {
        showToast('Failed to generate token: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Admin: Delete Token
async function deleteToken(tokenId) {
    if (!confirm('Are you sure you want to delete this token? This action cannot be undone.')) return;

    showLoading();
    try {
        await apiRequest(`${state.adminBaseUrl}/admin/tokens/${tokenId}`, {
            method: 'DELETE'
        });

        showToast('Token deleted successfully', 'success');
        closeModal('userDetailsModal');
    } catch (error) {
        showToast('Failed to delete token: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// Admin: View All Meetings
document.getElementById('viewAllMeetingsBtn').addEventListener('click', async () => {
    showLoading();
    try {
        const response = await apiRequest(`${state.adminBaseUrl}/admin/stats/meetings-users?limit=500`);
        const meetings = response.items || [];

        const html = `
            <h3>All Meetings (${response.total})</h3>
            <table class="meetings-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Platform</th>
                        <th>Meeting ID</th>
                        <th>User Email</th>
                        <th>Status</th>
                        <th>Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${meetings.map(m => `
                        <tr>
                            <td>${m.id}</td>
                            <td>${m.platform}</td>
                            <td>${m.native_meeting_id}</td>
                            <td>${m.user?.email || 'N/A'}</td>
                            <td><span class="bot-status ${m.status}">${m.status}</span></td>
                            <td>${formatDateTime(m.created_at)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        document.getElementById('adminContent').innerHTML = html;
    } catch (error) {
        showToast('Failed to load meetings: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
});

// Modal Functions
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    
    // Close websocket if closing transcript modal
    if (modalId === 'transcriptModal' && state.transcriptWebSocket) {
        state.transcriptWebSocket.close();
        state.transcriptWebSocket = null;
    }
}

// Close modal when clicking close button
document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        closeModal(modal.id);
    });
});

// Close modal when clicking outside
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal.id);
        }
    });
});

// Auto-login on page load
window.addEventListener('load', () => {
    const savedUserApiKey = localStorage.getItem('userApiKey');
    const savedUserBaseUrl = localStorage.getItem('userBaseUrl');
    const savedAdminToken = localStorage.getItem('adminToken');
    const savedAdminBaseUrl = localStorage.getItem('adminBaseUrl');

    if (savedAdminToken && savedAdminBaseUrl) {
        state.adminToken = savedAdminToken;
        state.adminBaseUrl = savedAdminBaseUrl;
        state.isAdmin = true;
        showAdminDashboard();
        loadAdminDashboard();
    } else if (savedUserApiKey && savedUserBaseUrl) {
        state.apiKey = savedUserApiKey;
        state.baseUrl = savedUserBaseUrl;
        state.isAdmin = false;
        showUserDashboard();
        loadUserDashboard();
    }
});

// Auto-refresh active bots every 30 seconds
setInterval(() => {
    if (state.isAdmin) {
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen && currentScreen.id === 'dashboardScreen') {
            loadAdminDashboard();
        }
    } else if (state.apiKey) {
        const currentScreen = document.querySelector('.screen.active');
        if (currentScreen && currentScreen.id === 'dashboardScreen') {
            loadUserDashboard();
        }
    }
}, 30000);
