import { NextRequest, NextResponse } from 'next/server'

// Function to get Auth0 Management API token
async function getManagementToken(): Promise<string> {
  const tokenResponse = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.AUTH0_M2M_CLIENT_ID,
      client_secret: process.env.AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    throw new Error(`Failed to get management token: ${error}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

export async function DELETE(request: NextRequest) {
  try {
    // Get user ID from request body
    const body = await request.json()
    const userId = body.userId
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized - No user ID provided' },
        { status: 401 }
      )
    }

    console.log(`Processing account deletion for user: ${userId}`)

    // Check if we have the required environment variables
    if (!process.env.AUTH0_M2M_CLIENT_ID || !process.env.AUTH0_M2M_CLIENT_SECRET || 
        process.env.AUTH0_M2M_CLIENT_ID === 'your_m2m_client_id_here' ||
        process.env.AUTH0_M2M_CLIENT_SECRET === 'your_m2m_client_secret_here') {
      console.error('Auth0 Management API credentials not configured')
      return NextResponse.json(
        { 
          error: 'Account deletion is not configured. Please set up Auth0 Management API credentials.',
          details: 'See AUTH0_SETUP.md for configuration instructions.'
        },
        { status: 501 } // 501 Not Implemented
      )
    }

    // Step 1: Get Management API access token
    console.log('Getting Auth0 Management API token...')
    const managementToken = await getManagementToken()

    // Step 2: Delete user from Auth0 using Management API
    console.log(`Deleting user ${userId} from Auth0...`)
    const deleteResponse = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text()
      console.error('Auth0 user deletion failed:', {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorText
      })
      
      return NextResponse.json(
        { error: `Failed to delete user from Auth0: ${deleteResponse.status} ${deleteResponse.statusText}` },
        { status: 500 }
      )
    }

    // Step 3: Clean up any user data from your database here
    // Example: await deleteUserDataFromDatabase(userId)
    
    console.log(`✓ Successfully deleted user ${userId} from Auth0`)
    
    return NextResponse.json(
      { message: 'Account successfully deleted from Auth0' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error deleting account:', error)
    
    // Return more specific error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return NextResponse.json(
      { error: `Account deletion failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}