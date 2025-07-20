# Auth0 Management API Setup for Account Deletion

⚠️ **IMPORTANT**: The account deletion feature is currently showing an "Unauthorized" error because the Auth0 Management API credentials are not configured.

To enable real account deletion functionality, you need to set up a Machine-to-Machine (M2M) application in Auth0 that can access the Management API.

## Setup Steps

### 1. Create Machine-to-Machine Application

1. Go to your [Auth0 Dashboard](https://manage.auth0.com/) for domain: `neemiracle-tech.us.auth0.com`
2. Navigate to **Applications** in the left sidebar
3. Click **+ Create Application**
4. Choose **Machine to Machine Applications**
5. Give it a name like "STL Viewer Management API"
6. Select the **Auth0 Management API** from the dropdown
7. Click **Authorize**

### 2. Configure Scopes

1. In the scopes section, find and enable:
   - `delete:users` - Required to delete user accounts
   - `read:users` - Optional, for additional user operations
2. Click **Authorize**

### 3. Get Credentials

1. Go to the **Settings** tab of your new M2M application
2. Copy the **Client ID** and **Client Secret**
3. Update your `.env.local` file:

```env
AUTH0_M2M_CLIENT_ID=your_actual_m2m_client_id
AUTH0_M2M_CLIENT_SECRET=your_actual_m2m_client_secret
```

### 4. Test the Setup

1. Restart your Next.js development server
2. Log in to your application
3. Go to Account settings and try to delete your account
4. Check the server logs for confirmation

## API Endpoint

The delete account API is located at `/api/auth/delete-account` and uses the DELETE method.

### How it works:

1. **Authentication**: Verifies the user has a valid session
2. **Management Token**: Obtains an access token for the Auth0 Management API
3. **User Deletion**: Calls the Auth0 Management API to delete the user
4. **Cleanup**: You can add additional cleanup logic (database, files, etc.)
5. **Response**: Returns success/error status

### Error Handling:

- Returns 401 if user is not authenticated
- Returns 500 if Management API credentials are missing
- Returns 500 if Auth0 deletion fails
- Includes detailed error messages in logs

## Security Notes

- The M2M credentials have powerful permissions - keep them secure
- Only enable the minimum required scopes
- Consider adding rate limiting for production use
- Log all deletion attempts for audit purposes

## Production Considerations

- Add database cleanup logic in the API
- Handle user file/data deletion
- Consider soft deletion vs hard deletion
- Implement proper error notifications
- Add email confirmations for deletion requests