/**
 * Quick test to verify MCP server is accessible
 */
const https = require('https');

// Test the MCP endpoint
const testUrl = 'https://localhost-5066f419.deco.host/mcp';

console.log('🔍 Testing MCP server accessibility...');
console.log('URL:', testUrl);

https.get(testUrl, (res) => {
  console.log('✅ Server responded with status:', res.statusCode);
  console.log('Headers:', Object.keys(res.headers));
  
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('📋 Server info:', {
        tools: parsed.tools?.length || 'N/A',
        workflows: parsed.workflows?.length || 'N/A'
      });
    } catch (e) {
      console.log('📄 Response preview:', data.substring(0, 200) + '...');
    }
  });
}).on('error', (err) => {
  console.error('❌ Server test failed:', err.message);
  console.log('\n💡 Troubleshooting:');
  console.log('1. Check if development server is still running');
  console.log('2. Look for the current URL in the terminal output');
  console.log('3. Verify the tunnel is active');
});