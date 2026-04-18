const http = require('http');
const req = http.request('http://localhost:3000/api/incident', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data));
});
req.on('error', err => console.error(err.message));
req.write(JSON.stringify({ lat: 12.9, lng: 77.6, severity: 'high' }));
req.end();
