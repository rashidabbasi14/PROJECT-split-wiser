const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
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
    // Parse the request body
    const expenseData = JSON.parse(event.body);

    // Convert the expense data to form-encoded format
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(expenseData)) {
      formData.append(key, value);
    }

    const response = await fetch('https://secure.splitwise.com/api/v3.0/create_expense', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
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
    console.error('Error creating expense:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create expense' })
    };
  }
};
