const http = require('http');
http.get('http://localhost:3000/api/state', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', data.substring(0, 100)));
}).on('error', err => console.error(err.message));
