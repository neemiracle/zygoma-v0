# Auth0 Configuration Guide

This document outlines all the URLs and settings you need to configure in your Auth0 application dashboard for this Next.js project.

## Auth0 Application Settings

### 1. Application Type
- **Required**: Regular Web Application
- **Location**: Auth0 Dashboard > Applications > [Your App] > Settings > Application Type

### 2. Allowed Callback URLs
These are the URLs Auth0 will redirect to after successful authentication:

```
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

**Notes:**
- Use `http://localhost:3000` for local development
- Replace `yourdomain.com` with your production domain
- The `/auth/callback` path is handled automatically by the Auth0 middleware

### 3. Allowed Logout URLs
These are the URLs Auth0 will redirect to after logout:

```
http://localhost:3000
https://yourdomain.com
```

**Notes:**
- Users will be redirected to the home page after logout
- Add both development and production URLs

### 4. Allowed Web Origins
These origins are allowed to make requests to Auth0:

```
http://localhost:3000
https://yourdomain.com
```

**Notes:**
- Required for CORS requests
- Must match your application's URL exactly

### 5. Allowed Origins (CORS)
Same as Allowed Web Origins:

```
http://localhost:3000
https://yourdomain.com
```

## Advanced Settings

### 6. Grant Types
Ensure these grant types are enabled:
- ✅ Authorization Code
- ✅ Refresh Token
- ✅ Implicit (optional, for SPA compatibility)

### 7. Token Settings
- **JsonWebToken Signature Algorithm**: RS256 (recommended)
- **OIDC Conformant**: Enabled (recommended)

## Example Configuration

### Development Environment
```
Allowed Callback URLs: http://localhost:3000/auth/callback
Allowed Logout URLs: http://localhost:3000
Allowed Web Origins: http://localhost:3000
Allowed Origins (CORS): http://localhost:3000
```

### Production Environment (Vercel Example)
```
Allowed Callback URLs: https://yourapp.vercel.app/auth/callback
Allowed Logout URLs: https://yourapp.vercel.app
Allowed Web Origins: https://yourapp.vercel.app
Allowed Origins (CORS): https://yourapp.vercel.app
```

### Both Development and Production
```
Allowed Callback URLs: 
  http://localhost:3000/auth/callback,
  https://yourapp.vercel.app/auth/callback

Allowed Logout URLs:
  http://localhost:3000,
  https://yourapp.vercel.app

Allowed Web Origins:
  http://localhost:3000,
  https://yourapp.vercel.app

Allowed Origins (CORS):
  http://localhost:3000,
  https://yourapp.vercel.app
```

## Environment Variables

Make sure your `.env.local` file contains the correct values from your Auth0 application:

```bash
AUTH0_SECRET=your-auth0-secret
AUTH0_DOMAIN=your-domain.us.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
APP_BASE_URL=http://localhost:3000
```

**Important Notes:**
- `AUTH0_DOMAIN` should NOT include `https://` (just the domain)
- `AUTH0_SECRET` should be a random 32-character string
- Generate `AUTH0_SECRET` with: `openssl rand -hex 32`

## Available Auth Routes

The Auth0 middleware automatically creates these routes:

- `/auth/login` - Initiates login flow
- `/auth/logout` - Initiates logout flow  
- `/auth/callback` - Handles Auth0 callback
- `/auth/me` - Returns user profile (API endpoint)

## Troubleshooting

### Common Issues:

1. **"Callback URL mismatch"**
   - Ensure callback URL in Auth0 matches exactly
   - Check for trailing slashes or protocol mismatches

2. **"Origin not allowed"**
   - Add your domain to Allowed Web Origins
   - Ensure no trailing slashes in the origin URL

3. **"Invalid audience"**
   - Make sure Application Type is "Regular Web Application"
   - Check that OIDC Conformant is enabled

4. **"Access denied"**
   - Verify all required URLs are configured
   - Check that Grant Types include "Authorization Code"

## Security Recommendations

1. **Use HTTPS in production** - Never use HTTP for production URLs
2. **Limit allowed URLs** - Only add the URLs you actually need
3. **Rotate secrets regularly** - Change AUTH0_SECRET periodically
4. **Enable MFA** - Consider enabling multi-factor authentication
5. **Monitor logs** - Check Auth0 logs for suspicious activity

## Testing Your Configuration

1. Start your development server: `pnpm dev`
2. Visit: `http://localhost:3000`
3. Click "Login" or "Get Started"
4. Complete the Auth0 login flow
5. Verify you're redirected back to `/dashboard`

If any step fails, check the Auth0 logs in your dashboard for specific error messages.