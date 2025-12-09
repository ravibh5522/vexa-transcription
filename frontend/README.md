# Vexa Frontend - User & Admin Interface

A comprehensive web-based interface for managing Vexa meeting transcription bots with separate user and admin portals.

## Features

### User Portal
- **Dashboard**
  - View active bot statistics
  - Monitor total, completed, and failed meetings
  - Real-time bot status display
  
- **Bot Management**
  - Request new bots for Google Meet and Microsoft Teams
  - View active bots with live status
  - Stop running bots
  - Auto-refresh every 30 seconds

- **Transcript Viewer**
  - View real-time transcripts
  - Live WebSocket updates
  - Download transcripts as text files
  - Speaker identification and timestamps

- **Meetings History**
  - Browse all past meetings
  - Filter by status (active, completed, failed)
  - Filter by platform (Google Meet, Teams)
  - Delete completed meetings

- **Settings**
  - View and copy API key
  - Configure webhook URLs for notifications
  - Server connection details

### Admin Portal
- **Admin Dashboard**
  - Total users count
  - All meetings overview
  - Active meetings monitoring
  - System health status

- **User Management**
  - Create new users
  - View all users in table format
  - Access detailed user analytics
  - Generate/revoke API tokens
  - View user meeting statistics and usage patterns

- **System Analytics**
  - Comprehensive user details with meeting stats
  - Usage patterns and peak hours
  - Platform preferences
  - API token management

## Quick Start

### 1. Deployment Options

#### Option A: Static File Server (Recommended)
Simply serve the `frontend` directory with any web server:

```bash
# Python
cd /home/ravi/Desktop/vexa/frontend
python3 -m http.server 8080

# Node.js (http-server)
npx http-server frontend -p 8080

# PHP
php -S localhost:8080 -t frontend
```

Access at: `http://localhost:8080`

#### Option B: Nginx
```nginx
server {
    listen 80;
    server_name vexa-ui.yourdomain.com;
    
    root /home/ravi/Desktop/vexa/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

#### Option C: Add to Docker Compose
Add this service to your `docker-compose.yml`:

```yaml
  vexa-ui:
    image: nginx:alpine
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
    ports:
      - "18080:80"
    networks:
      - vexa_default
    restart: unless-stopped
```

Then access at: `http://your-server:18080`

### 2. User Login

1. Open the frontend in your browser
2. Select "User Login" tab
3. Enter:
   - **API Key**: Your Vexa API key (get from admin)
   - **Server URL**: `http://your-server:18056` (API Gateway)
4. Click "Login as User"

### 3. Admin Login

1. Open the frontend in your browser
2. Select "Admin Login" tab
3. Enter:
   - **Admin Token**: Your `ADMIN_API_TOKEN` from `.env` file
   - **Admin API URL**: `http://your-server:18057` (Admin API)
4. Click "Login as Admin"

## User Guide

### Creating a Bot

1. Click "**+ New Bot**" button
2. Fill in the form:
   - **Platform**: Select Google Meet or Microsoft Teams
   - **Meeting ID**: 
     - Google Meet: Meeting code (e.g., `abc-defg-hij`)
     - Teams: Numeric ID only (e.g., `9387167464734`)
   - **Passcode**: (Teams only) Required passcode from URL
   - **Language**: Optional, auto-detects if not specified
   - **Bot Name**: Optional custom name
3. Click "**Request Bot**"
4. Bot will join the meeting in ~10 seconds

### Viewing Transcripts

**Real-time Viewing:**
1. Click "**View Transcript**" on any active bot
2. Transcript shows speaker, timestamp, and text
3. Click "**Live Updates**" to enable WebSocket streaming
4. Click "**Download**" to save as text file

### Managing Meetings

**Filter Meetings:**
- Use status dropdown: All, Active, Completed, Failed
- Use platform dropdown: All, Google Meet, Teams

**Delete Meeting:**
- Only available for completed/failed meetings
- Deletes all transcripts and anonymizes data
- Action is permanent

### Webhook Configuration

1. Go to **Settings**
2. Enter your webhook URL
3. Click "**Save Webhook**"
4. You'll receive POST notifications when meetings finish

## Admin Guide

### Creating Users

1. Click "**Create User**"
2. Fill in user details:
   - Email (required)
   - Name (optional)
   - Image URL (optional)
   - Max Concurrent Bots (default: 5)
3. Click "**Create User**"
4. **Save the generated API key** - show it to the user

### Managing Users

**View All Users:**
1. Click "**View All Users**"
2. See table with all user accounts
3. Click "**Details**" to view comprehensive analytics

**User Details Include:**
- User profile information
- Meeting statistics (total, completed, failed, active)
- Usage patterns (most used platform, peak hours)
- All API tokens with creation dates
- Token management (generate new, delete existing)

### System Monitoring

**Dashboard Metrics:**
- Total Users: All registered users
- All Meetings: Total meetings across all users
- Active Now: Currently running bots
- System Health: Overall status indicator

**View All Meetings:**
- Click "**View All Meetings**"
- See meetings from all users
- Filter and sort capabilities

## API Endpoints Used

### User Endpoints (Port 18056)
```
POST   /bots                                    # Request bot
GET    /bots/status                             # Active bots
DELETE /bots/{platform}/{meeting_id}            # Stop bot
GET    /transcripts/{platform}/{meeting_id}     # Get transcript
GET    /meetings                                # List meetings
PATCH  /meetings/{platform}/{meeting_id}        # Update meeting
DELETE /meetings/{platform}/{meeting_id}        # Delete meeting
PUT    /user/webhook                            # Set webhook
WS     /ws                                      # WebSocket for live updates
```

### Admin Endpoints (Port 18057)
```
POST   /admin/users                             # Create user
GET    /admin/users                             # List all users
GET    /admin/users/{user_id}                   # Get user details
POST   /admin/users/{user_id}/tokens            # Generate token
DELETE /admin/tokens/{token_id}                 # Delete token
GET    /admin/stats/meetings-users              # All meetings with users
GET    /admin/analytics/users/{id}/details      # User analytics
```

## Configuration

### Changing Default URLs

Edit `index.html` to change default server URLs:

```html
<!-- User Login -->
<input type="text" id="userBaseUrl" value="http://localhost:18056">

<!-- Admin Login -->
<input type="text" id="adminBaseUrl" value="http://localhost:18057">
```

### CORS Configuration

If frontend is on a different domain than the API, configure CORS in your API services:

**services/api-gateway/main.py:**
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Features Breakdown

### Authentication
- API key-based for users
- Admin token-based for admins
- Auto-login from localStorage
- Secure logout with cleanup

### Real-time Updates
- WebSocket support for live transcripts
- Auto-refresh dashboard every 30 seconds
- Toast notifications for all actions

### Data Management
- Local storage for session persistence
- Download transcripts as text files
- Filter and sort capabilities

### Responsive Design
- Mobile-friendly interface
- Adaptive layouts
- Touch-optimized controls

## Troubleshooting

### Login Fails
- Verify server URLs are correct (check ports)
- Ensure API/Admin services are running
- Check API key/token is valid
- Check browser console for CORS errors

### Bots Not Appearing
- Refresh the page
- Check bot was successfully requested
- Verify meeting ID format is correct
- Wait 10-15 seconds for bot to join

### Transcripts Not Loading
- Ensure bot is in "active" status
- Check meeting has started and people are speaking
- Try refreshing the transcript view

### WebSocket Issues
- Verify WebSocket endpoint is accessible
- Check firewall/proxy settings
- Ensure API key has WebSocket permissions

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Responsive design

## Security Notes

- API keys are stored in browser localStorage
- Never commit API keys to version control
- Use HTTPS in production
- Implement rate limiting on API endpoints
- Rotate admin tokens regularly

## License

Same as Vexa project license.
