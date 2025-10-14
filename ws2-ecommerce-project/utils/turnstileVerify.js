const fetch = require('node-fetch'); // Only needed if Node < 18

// Function to verify Cloudflare Turnstile response
async function verifyTurnstile(token, ip) {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip
      })
    });
    return await response.json();
  } catch (err) {
    console.error('Turnstile verification error:', err);
    return { success: false };
  }
}

module.exports = verifyTurnstile;