const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Get the authorization header
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (!authHeader) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'No authorization header provided' })
    };
  }

  try {
    const response = await fetch('https://secure.splitwise.com/api/v3.0/get_groups', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error fetching groups:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch groups' })
    };
  }
};
